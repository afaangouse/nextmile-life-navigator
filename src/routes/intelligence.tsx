import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, Page, Panel, Pill, type Tone } from "@/components/nm/bits";
import { RecoveryDialog, TaskDialog } from "@/components/nm/dialogs";
import { AutonomyControls, RecCard } from "@/components/nm/rec-card";
import { Situation } from "@/components/nm/situation";
import { fmtDur, fmtTime, nowMin, relDay, ymd } from "@/lib/nextmile/dates";
import {
  conflicts,
  insights,
  isOpen,
  rankToday,
  sleepMin,
  tasksOn,
  unresolvedMisses,
  wakeMin,
} from "@/lib/nextmile/engine";
import { pageHead } from "@/lib/nextmile/head";
import { app, newTask, useApp, useNow } from "@/lib/nextmile/store";
import type { Task } from "@/lib/nextmile/types";

export const Route = createFileRoute("/intelligence")({
  head: pageHead(
    "Recommendations",
    "See how NEXTMILE reads your situation: conflicts, proposals awaiting approval, missed-task recovery and what it may do on its own.",
  ),
  component: Intelligence,
});

function Intelligence() {
  const s = useApp();
  const now = useNow();
  const today = ymd(now);
  const [missed, setMissed] = useState<Task | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const pending = s.recommendations.filter((r) => r.status === "pending");
  const decided = s.recommendations.filter((r) => r.status !== "pending");
  const latest = decided[0];
  const status: { label: string; tone: Tone } = pending.length
    ? { label: "Waiting for approval", tone: "warning" }
    : latest &&
        latest.decidedAt?.slice(0, 10) === now.toISOString().slice(0, 10) &&
        latest.status === "failed"
      ? { label: "Action failed", tone: "danger" }
      : latest &&
          latest.decidedAt?.slice(0, 10) === now.toISOString().slice(0, 10) &&
          latest.status === "executed"
        ? { label: "Action completed", tone: "success" }
        : { label: "Ready", tone: "success" };
  const issues = conflicts(s, today, now);
  const misses = unresolvedMisses(s, today);
  const ranked = rankToday(s, today);
  const todays = tasksOn(s, today);
  const fixed = todays.filter((t) => t.fixed && isOpen(t));
  const left = Math.max(0, sleepMin(s) - Math.max(nowMin(now), wakeMin(s)));
  const notes = insights(s, now);

  function analyse() {
    const id = app.analyse();
    if (id && s.recommendations.every((r) => r.id !== id)) toast.success("New proposal prepared.");
    else toast("Analysis complete. Nothing new to propose.");
  }

  return (
    <Page
      eyebrow="Suggestions and changes to your plan"
      title="Recommendations"
      actions={
        <>
          <Pill tone={status.tone} className="px-3 py-1.5 text-xs">
            <span className="size-1.5 rounded-full bg-current" />
            {status.label}
          </Pill>
          <Button variant="soft" onClick={analyse}>
            <RefreshCw />
            Analyse now
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel eyebrow="What I know right now" title="Current situation">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                [
                  "Energy",
                  s.day.energy === "low"
                    ? "Low (you told me)"
                    : s.day.energy === "high"
                      ? "High"
                      : "Normal",
                ],
                [
                  "Time left today",
                  s.day.availableMinutes != null
                    ? `${fmtDur(s.day.availableMinutes)} (you told me)`
                    : fmtDur(left),
                ],
                ["Open priorities", String(ranked.length)],
                ["Sleep protected at", fmtTime(s.profile.sleep)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-secondary/50 p-3">
                  <p className="eyebrow">{k}</p>
                  <p className="mt-1.5 text-sm font-medium">{v}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {ranked[0] ? (
                <>
                  Top priority is <span className="text-foreground">“{ranked[0].task.title}”</span>
                  {ranked[0].reasons.length
                    ? ` (${ranked[0].reasons.slice(0, 2).join(", ").toLowerCase()})`
                    : ""}
                  .{" "}
                </>
              ) : (
                "Nothing open remains today. "
              )}
              {fixed.length
                ? `Fixed commitments still ahead: ${fixed.map((f) => `${f.title}${f.startTime ? ` at ${fmtTime(f.startTime)}` : ""}`).join(", ")}. `
                : ""}
              I only know what is recorded here and what you tell me; I can't see your screen,
              location or calendar.
            </p>
            <div className="mt-4 border-t border-border pt-4">
              <Situation
                onRecover={setMissed}
                onUrgent={() => setTask({ ...newTask(today), importance: 5, dueDate: today })}
              />
            </div>
          </Panel>

          <div>
            <div className="mb-3">
              <p className="eyebrow">Proposals</p>
              <h2 className="mt-1 text-base font-semibold">
                Recommendations awaiting your decision
              </h2>
            </div>
            {pending.length ? (
              <div className="space-y-4">
                {pending.map((r) => (
                  <RecCard key={r.id} rec={r} />
                ))}
              </div>
            ) : (
              <Empty
                title="Nothing needs your approval"
                text="When the day stops fitting, or you tell me something changed, a proposal with full reasoning appears here."
              />
            )}
          </div>

          <Panel eyebrow="Without guilt" title="Missed-task recovery">
            {misses.length ? (
              <ul className="space-y-2">
                {misses.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {relDay(t.date, today)}
                        {t.startTime ? `, ${fmtTime(t.startTime)}` : ""} ·{" "}
                        {t.status === "missed" ? "marked missed" : "not completed"}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {t.status !== "missed" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => app.setTaskStatus(t.id, "completed")}
                        >
                          I did it
                        </Button>
                      ) : null}
                      <Button size="sm" variant="soft" onClick={() => setMissed(t)}>
                        What happened?
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No missed tasks are waiting. When something slips, I'll ask what got in the way
                before suggesting anything.
              </p>
            )}
          </Panel>

          <Panel
            eyebrow="Audit trail"
            title="Recent decisions"
            action={
              <Button size="sm" variant="ghost" asChild>
                <Link to="/history">
                  Full history
                  <ArrowRight />
                </Link>
              </Button>
            }
          >
            {decided.length ? (
              <div className="space-y-4 divide-y divide-border [&>*:not(:first-child)]:pt-4">
                {decided.slice(0, 3).map((r) => (
                  <RecCard key={r.id} rec={r} bare />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No decisions yet. Every proposal, approval and rejection will be recorded here.
              </p>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel eyebrow="Today" title="Detected conflicts">
            {issues.length ? (
              <ul className="space-y-3">
                {issues.map((c) => (
                  <li key={c.id} className="flex gap-2.5">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                    <span>
                      <span className="block text-sm">{c.title}</span>
                      <span className="text-xs text-muted-foreground">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No overlaps, overload or sleep conflicts today.
              </p>
            )}
          </Panel>
          <Panel eyebrow="Patterns and risks" title="Insights">
            {notes.length ? (
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id}>
                    <p className="text-sm">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No patterns worth raising yet.</p>
            )}
          </Panel>
          <Panel eyebrow="Your boundaries" title="Autonomy controls">
            <AutonomyControls />
          </Panel>
        </div>
      </div>
      <RecoveryDialog task={missed} onClose={() => setMissed(null)} />
      <TaskDialog task={task} onClose={() => setTask(null)} />
    </Page>
  );
}

import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { LEVEL_LABEL } from "@/lib/nextmile/permissions";
import { app, useApp } from "@/lib/nextmile/store";
import type { Autonomy, Recommendation } from "@/lib/nextmile/types";
import { Pill, type Tone } from "./bits";

const STATUS: Record<Recommendation["status"], { label: string; tone: Tone }> = {
  pending: { label: "Waiting for approval", tone: "warning" },
  executed: { label: "Action completed", tone: "success" },
  rejected: { label: "Rejected", tone: "default" },
  failed: { label: "Action failed", tone: "danger" },
  noted: { label: "No change needed", tone: "primary" },
};

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="eyebrow mb-1.5">{title}</p>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {items.map((x) => (
          <li key={x} className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/70" />
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecCard({ rec, bare }: { rec: Recommendation; bare?: boolean }) {
  const s = useApp();
  const pending = rec.status === "pending";
  const [open, setOpen] = useState(pending || !!bare);
  const [modify, setModify] = useState(false);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [minutes, setMinutes] = useState<Record<string, number>>({});
  const goals = s.goals.filter((g) => rec.affectedGoalIds.includes(g.id));
  const st = STATUS[rec.status];

  function decide(decision: "approve" | "reject") {
    const res = app.decide(
      rec.id,
      decision,
      decision === "approve" && modify ? { enabled, minutes } : undefined,
    );
    if (res.ok) toast.success(res.message);
    else toast.error(res.message);
    setModify(false);
  }

  return (
    <article className={cn(!bare && "panel p-5", pending && !bare && "panel-glow")}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={st.tone}>{st.label}</Pill>
        {rec.actions.length ? (
          <Pill>
            Level {rec.level} · {LEVEL_LABEL[rec.level]}
          </Pill>
        ) : null}
        <Pill>{rec.source === "recovery" ? "Missed-task recovery" : "Day plan"}</Pill>
      </div>
      <button
        type="button"
        className="mt-3 flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div>
          <h3 className="text-base font-semibold">{rec.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{rec.summary}</p>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div>
            <p className="eyebrow mb-1.5">Why</p>
            <p className="text-sm leading-relaxed">{rec.reasoning}</p>
          </div>
          {rec.actions.length ? (
            <div>
              <p className="eyebrow mb-1.5">What changes</p>
              <ul className="space-y-2">
                {rec.actions.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2 text-sm"
                  >
                    {modify ? (
                      <Switch
                        checked={enabled[a.id] ?? a.enabled}
                        onCheckedChange={(v) => setEnabled((p) => ({ ...p, [a.id]: v }))}
                        aria-label={`Include: ${a.summary}`}
                      />
                    ) : null}
                    <span
                      className={cn(
                        "flex-1",
                        !a.enabled && !modify && "text-muted-foreground line-through",
                      )}
                    >
                      {a.summary}
                    </span>
                    {modify && a.minutes != null ? (
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="number"
                          min={5}
                          max={600}
                          step={5}
                          className="field h-8 w-20"
                          value={minutes[a.id] ?? a.minutes}
                          onChange={(e) =>
                            setMinutes((p) => ({ ...p, [a.id]: Number(e.target.value) }))
                          }
                        />
                        min
                      </label>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {goals.length ? (
            <div>
              <p className="eyebrow mb-1.5">Goals affected</p>
              <div className="flex flex-wrap gap-1.5">
                {goals.map((g) => (
                  <Pill key={g.id} tone="primary">
                    {g.title}
                  </Pill>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <List title="Expected benefits" items={rec.benefits} />
            <List title="Trade-offs" items={rec.drawbacks} />
          </div>
          <List title="Alternatives" items={rec.alternatives} />
          {pending ? (
            <div>
              <p className="eyebrow mb-1.5">If you reject</p>
              <p className="text-sm text-muted-foreground">{rec.ifRejected}</p>
            </div>
          ) : rec.outcome ? (
            <div>
              <p className="eyebrow mb-1.5">Outcome</p>
              <p className="text-sm text-muted-foreground">{rec.outcome}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {pending ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="hero" onClick={() => decide("approve")}>
            <Check />
            {modify ? "Approve modified plan" : "Approve"}
          </Button>
          <Button variant="outline" onClick={() => decide("reject")}>
            <X />
            Reject
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setModify((m) => !m);
              setOpen(true);
            }}
          >
            <SlidersHorizontal />
            {modify ? "Cancel changes" : "Modify plan"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

const AUTONOMY: { key: keyof Autonomy; title: string; text: string }[] = [
  {
    key: "reorderToday",
    title: "Rank today's priorities",
    text: "Recalculate the order of today's tasks as things change.",
  },
  {
    key: "shortenSessions",
    title: "Shorten today's sessions",
    text: "Trim lower-importance sessions today without asking. High-importance ones always ask.",
  },
  {
    key: "adjustToday",
    title: "Shift tasks within today",
    text: "Move lower-importance, non-fixed tasks to another time the same day.",
  },
];

export function AutonomyControls() {
  const s = useApp();
  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow mb-2">Level 1 · may run automatically</p>
        <div className="space-y-3">
          {AUTONOMY.map((a) => (
            <div key={a.key} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.text}</p>
              </div>
              <Switch
                checked={s.autonomy[a.key]}
                onCheckedChange={(v) =>
                  app.updateSettings({ autonomy: { ...s.autonomy, [a.key]: v } })
                }
                aria-label={a.title}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Level 2 · always asks:</span> moving tasks
          to another day, changing routines, anything touching important or fixed commitments.
        </p>
        <p className="mt-1.5">
          <span className="font-medium text-foreground">Level 3 · never done by NEXTMILE:</span>{" "}
          deleting goals or data, spending money, sending messages, sharing with outside services.
        </p>
      </div>
    </div>
  );
}

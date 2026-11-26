import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CircleCheck,
  Info,
  MessagesSquare,
  Plus,
  Target,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bar, Empty, Page, Panel, Pill, Ring, TaskRow } from "@/components/nm/bits";
import { GoalDialog, RecoveryDialog, TaskDialog } from "@/components/nm/dialogs";
import { Situation } from "@/components/nm/situation";
import { cn } from "@/lib/utils";
import {
  addDays,
  diffDays,
  fmtDate,
  fmtDur,
  fmtTime,
  nowMin,
  toMin,
  ymd,
} from "@/lib/nextmile/dates";
import {
  briefing,
  completionRate,
  conflicts,
  goalStats,
  insights,
  isOpen,
  rankToday,
  tasksOn,
  unresolvedMisses,
  weekSeries,
} from "@/lib/nextmile/engine";
import { newGoal, newTask, useApp, useNow } from "@/lib/nextmile/store";
import { CATEGORY_LABEL, type Goal, type Task } from "@/lib/nextmile/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Home — NEXTMILE" },
      {
        name: "description",
        content:
          "Your command centre: today's priorities, schedule, goals and what NEXTMILE recommends next.",
      },
      { property: "og:title", content: "Home — NEXTMILE" },
      {
        property: "og:description",
        content:
          "Your command centre: today's priorities, schedule, goals and what NEXTMILE recommends next.",
      },
    ],
  }),
  component: Overview,
});

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="panel p-4">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Overview() {
  const s = useApp();
  const now = useNow();
  const today = ymd(now);
  const [task, setTask] = useState<Task | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [missed, setMissed] = useState<Task | null>(null);

  const brief = briefing(s, now);
  const ranked = rankToday(s, today);
  const todays = tasksOn(s, today);
  const doneToday = todays.filter((t) => t.status === "completed").length;
  const openToday = todays.filter(isOpen).length;
  const deadlines = s.tasks.filter(
    (t) =>
      t.dueDate && isOpen(t) && diffDays(t.dueDate, today) >= 0 && diffDays(t.dueDate, today) <= 7,
  );
  const week = completionRate(s, today, 7);
  const series = weekSeries(s, today);
  const issues = conflicts(s, today, now);
  const notes = insights(s, now);
  const pending = s.recommendations.filter((r) => r.status === "pending");
  const misses = unresolvedMisses(s, today);
  const goals = s.goals.filter((g) => g.status === "active");
  const goalOf = (t: Task) => s.goals.find((g) => g.id === t.goalId);
  const nm = nowMin(now);
  const urgent = () => setTask({ ...newTask(today), importance: 5, dueDate: today });

  return (
    <Page
      eyebrow={fmtDate(today, { weekday: "long", day: "numeric", month: "long" })}
      title={brief.greeting}
    >
      <section className="panel panel-glow relative mb-5 overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-primary/15 blur-3xl" />
        <p className="eyebrow">Daily briefing</p>
        <p className="mt-2 max-w-3xl text-base leading-relaxed sm:text-lg">{brief.text}</p>
        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2.5 text-xs text-muted-foreground">
            Has something changed? Tell me and I'll re-check the day.
          </p>
          <Situation onRecover={setMissed} onUrgent={urgent} />
        </div>
      </section>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Completed" value={String(doneToday)} sub="today" />
        <Stat label="Pending" value={String(openToday)} sub="today" />
        <Stat label="Deadlines" value={String(deadlines.length)} sub="in the next 7 days" />
        <Stat
          label="Week"
          value={`${week.rate}%`}
          sub={`${week.done} of ${week.total} completed`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel
            eyebrow="Ranked by the planner"
            title="Today's priorities"
            action={
              <Button size="sm" variant="soft" onClick={() => setTask(newTask(today))}>
                <Plus />
                Add task
              </Button>
            }
          >
            {ranked.length ? (
              <div className="space-y-0.5">
                {ranked.slice(0, 5).map((r, i) => (
                  <div key={r.task.id} className="flex gap-2">
                    <span className="mt-3 w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <TaskRow
                        task={r.task}
                        goal={goalOf(r.task)}
                        today={today}
                        reasons={r.reasons}
                        onEdit={setTask}
                        onMissed={setMissed}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="Nothing open today"
                text="Add a task, or pull one small action forward from a goal."
              />
            )}
          </Panel>

          <Panel
            eyebrow="Timeline"
            title="Today's schedule"
            action={
              <Button size="sm" variant="ghost" asChild>
                <Link to="/planner">
                  Open planner
                  <ArrowRight />
                </Link>
              </Button>
            }
          >
            {todays.length ? (
              <ol className="relative space-y-1 border-l border-border pl-5">
                {todays.map((t) => {
                  const past = t.startTime != null && toMin(t.startTime) + t.duration < nm;
                  const live =
                    t.startTime != null && toMin(t.startTime) <= nm && !past && isOpen(t);
                  return (
                    <li key={t.id} className="relative">
                      <span
                        className={cn(
                          "absolute -left-[25px] top-4 size-2.5 rounded-full border-2 border-background",
                          t.status === "completed"
                            ? "bg-success"
                            : live
                              ? "bg-primary shadow-[var(--shadow-glow)]"
                              : t.status === "missed"
                                ? "bg-destructive"
                                : "bg-muted-foreground/50",
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setTask(t)}
                        className={cn(
                          "flex w-full items-center gap-4 rounded-lg px-3 py-2 text-left transition-colors hover:bg-secondary/50",
                          live && "bg-primary/8",
                        )}
                      >
                        <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                          {t.startTime ? fmtTime(t.startTime) : "Any time"}
                        </span>
                        <span
                          className={cn(
                            "flex-1 text-sm",
                            (t.status === "completed" ||
                              t.status === "missed" ||
                              t.status === "postponed") &&
                              "text-muted-foreground",
                          )}
                        >
                          {t.title}
                        </span>
                        {live ? (
                          <Pill tone="primary">Now</Pill>
                        ) : t.status !== "not_started" ? (
                          <Pill
                            tone={
                              t.status === "completed"
                                ? "success"
                                : t.status === "missed"
                                  ? "danger"
                                  : "default"
                            }
                          >
                            {t.status.replace("_", " ")}
                          </Pill>
                        ) : null}
                        <span className="hidden font-mono text-xs text-muted-foreground sm:block">
                          {fmtDur(t.duration)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <Empty title="An open day" text="Nothing is scheduled yet." />
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel
            eyebrow="Recommendations"
            title="What I'm seeing"
            action={
              <Button size="sm" variant="ghost" asChild>
                <Link to="/intelligence">
                  Open
                  <ArrowRight />
                </Link>
              </Button>
            }
          >
            <div className="space-y-2.5">
              {pending.map((r) => (
                <Link
                  key={r.id}
                  to="/intelligence"
                  className="block rounded-xl border border-primary/30 bg-primary/10 p-3 transition-colors hover:bg-primary/15"
                >
                  <p className="text-xs font-medium text-primary">
                    Proposal waiting for your approval
                  </p>
                  <p className="mt-1 text-sm">{r.title}</p>
                </Link>
              ))}
              {misses.length ? (
                <button
                  type="button"
                  onClick={() => setMissed(misses[0] ?? null)}
                  className="flex w-full gap-2.5 rounded-xl border border-border p-3 text-left hover:bg-secondary/50"
                >
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                  <span>
                    <span className="block text-sm">
                      {misses.length} missed {misses.length === 1 ? "item needs" : "items need"} a
                      quick conversation
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Start with “{misses[0]?.title}”
                    </span>
                  </span>
                </button>
              ) : null}
              {issues.map((c) => (
                <div key={c.id} className="flex gap-2.5 rounded-xl border border-border p-3">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                  <span>
                    <span className="block text-sm">{c.title}</span>
                    <span className="text-xs text-muted-foreground">{c.detail}</span>
                  </span>
                </div>
              ))}
              {notes.slice(0, 3).map((n) => (
                <div key={n.id} className="flex gap-2.5 rounded-xl border border-border p-3">
                  {n.tone === "good" ? (
                    <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : n.tone === "warn" ? (
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                  ) : (
                    <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                  )}
                  <span>
                    <span className="block text-sm">{n.title}</span>
                    <span className="text-xs text-muted-foreground">{n.detail}</span>
                  </span>
                </div>
              ))}
              {!pending.length && !misses.length && !issues.length && !notes.length ? (
                <p className="text-sm text-muted-foreground">
                  No conflicts or risks detected. The plan is sound.
                </p>
              ) : null}
            </div>
          </Panel>

          <Panel title="Quick actions">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setTask(newTask(today))}>
                <Plus />
                Add task
              </Button>
              <Button variant="outline" onClick={() => setGoal(newGoal(today))}>
                <Target />
                Create goal
              </Button>
              <Button variant="outline" asChild>
                <Link to="/assistant">
                  <MessagesSquare />
                  Ask AI
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/planner">
                  <CalendarClock />
                  Schedule
                </Link>
              </Button>
              <Button
                variant="outline"
                className="col-span-2"
                onClick={() => {
                  const t = misses[0] ?? todays.find((x) => isOpen(x) && !x.fixed);
                  if (t) setMissed(t);
                }}
              >
                <TriangleAlert />
                Report a missed task
              </Button>
            </div>
          </Panel>

          <Panel eyebrow="Last 7 days" title="Progress">
            <div className="flex h-28 items-end gap-2">
              {series.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="relative flex h-20 w-full items-end overflow-hidden rounded-md bg-secondary">
                    <div
                      className="w-full rounded-md bg-gradient-primary transition-[height] duration-700"
                      style={{ height: `${d.total ? (d.done / d.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "font-mono text-[10px]",
                      d.date === today ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {fmtDate(d.date, { weekday: "narrow" })}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Share of each day's plan completed.{" "}
              <Link to="/progress" className="text-primary hover:underline">
                Full review
              </Link>
            </p>
          </Panel>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="eyebrow">Goals</p>
            <h2 className="mt-1 text-base font-semibold">Where you're heading</h2>
          </div>
          <Button size="sm" variant="ghost" asChild>
            <Link to="/goals">
              All goals
              <ArrowRight />
            </Link>
          </Button>
        </div>
        {goals.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {goals.map((g) => {
              const st = goalStats(s, g, today);
              return (
                <Link
                  key={g.id}
                  to="/goals"
                  className="panel flex items-center gap-4 p-4 transition-transform hover:-translate-y-0.5"
                >
                  <Ring value={st.progress} />
                  <div className="min-w-0">
                    <p className="eyebrow">{CATEGORY_LABEL[g.category]}</p>
                    <p className="mt-1 truncate text-sm font-medium">{g.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {st.risk === "on_track"
                        ? `Active ${st.activeDays} of 7 days`
                        : st.risk === "at_risk"
                          ? "Behind its timeline"
                          : "No action this week"}
                    </p>
                    <div className="mt-2">
                      <Bar
                        value={(st.activeDays / 7) * 100}
                        tone={st.risk === "on_track" ? "success" : "warning"}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <Empty
            title="No goals yet"
            text="Goals give the planner something to protect when the day gets tight."
            action={
              <Button variant="hero" onClick={() => setGoal(newGoal(addDays(today, 0)))}>
                Create your first goal
              </Button>
            }
          />
        )}
      </div>

      <TaskDialog task={task} onClose={() => setTask(null)} />
      <GoalDialog goal={goal} onClose={() => setGoal(null)} />
      <RecoveryDialog task={missed} onClose={() => setMissed(null)} />
    </Page>
  );
}

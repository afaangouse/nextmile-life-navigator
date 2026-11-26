import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Archive, Check, Pause, Pencil, Play, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bar, Empty, Page, Pill, Ring } from "@/components/nm/bits";
import { GoalDialog, TaskDialog } from "@/components/nm/dialogs";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDur, relDay, ymd } from "@/lib/nextmile/dates";
import { goalStats, isOpen } from "@/lib/nextmile/engine";
import { pageHead } from "@/lib/nextmile/head";
import { app, newGoal, newTask, useApp, useNow } from "@/lib/nextmile/store";
import { CATEGORY_LABEL, type Goal, type GoalStatus, type Task } from "@/lib/nextmile/types";

export const Route = createFileRoute("/goals")({
  head: pageHead(
    "Goals",
    "Long-term and short-term goals with milestones, linked tasks and an honest read on whether each is on track.",
  ),
  component: Goals,
});

const FILTERS: { key: GoalStatus | "all"; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All" },
];

function Goals() {
  const s = useApp();
  const today = ymd(useNow());
  const [filter, setFilter] = useState<GoalStatus | "all">("active");
  const [goal, setGoal] = useState<Goal | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const list = s.goals.filter((g) => filter === "all" || g.status === filter);

  return (
    <Page
      eyebrow="Life vision → goals → milestones → daily actions"
      title="Goals"
      actions={
        <Button variant="hero" onClick={() => setGoal(newGoal(today))}>
          <Plus />
          New goal
        </Button>
      }
    >
      <div className="mb-5 flex gap-1.5 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs transition-colors",
              filter === f.key
                ? "border-primary/40 bg-primary/12 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}{" "}
            <span className="ml-1 font-mono opacity-70">
              {s.goals.filter((g) => f.key === "all" || g.status === f.key).length}
            </span>
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {list.map((g) => (
            <GoalCard
              key={g.id}
              goal={g}
              today={today}
              onEdit={() => setGoal(g)}
              onAddTask={() => setTask({ ...newTask(today), goalId: g.id, category: g.category })}
            />
          ))}
        </div>
      ) : (
        <Empty
          title={filter === "active" ? "No active goals" : "Nothing here"}
          text="A goal tells the planner what to protect when a day gets tight."
          action={
            <Button variant="hero" onClick={() => setGoal(newGoal(today))}>
              Create a goal
            </Button>
          }
        />
      )}
      <GoalDialog goal={goal} onClose={() => setGoal(null)} />
      <TaskDialog task={task} onClose={() => setTask(null)} />
    </Page>
  );
}

function GoalCard({
  goal: g,
  today,
  onEdit,
  onAddTask,
}: {
  goal: Goal;
  today: string;
  onEdit: () => void;
  onAddTask: () => void;
}) {
  const s = useApp();
  const [ms, setMs] = useState("");
  const st = goalStats(s, g, today);
  const linked = s.tasks
    .filter((t) => t.goalId === g.id && isOpen(t) && t.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const next = linked[0];
  const note =
    g.status !== "active"
      ? `This goal is ${g.status}. Nothing is scheduled against it and nothing has been deleted.`
      : st.risk === "neglected"
        ? "No completed action in the last 7 days. One short session this week is enough to restart it."
        : st.risk === "at_risk"
          ? `${st.progress}% done with about ${st.expected}% of the time gone. Worth adjusting the plan now, while it is still a small correction.`
          : `On track. You acted on it ${st.activeDays} of the last 7 days (${fmtDur(st.doneMinutes)}).`;

  function addMs(e: FormEvent) {
    e.preventDefault();
    if (!ms.trim()) return;
    app.addMilestone(g.id, ms.trim().slice(0, 120));
    setMs("");
  }
  const status = (v: GoalStatus, msg: string) => {
    app.setGoalStatus(g.id, v);
    toast.success(msg);
  };

  return (
    <article className={cn("panel p-5", g.status !== "active" && "opacity-80")}>
      <div className="flex items-start gap-4">
        <Ring value={st.progress} size={60} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            <Pill tone="primary">{CATEGORY_LABEL[g.category]}</Pill>
            <Pill>{g.horizon === "long" ? "Long-term" : "Short-term"}</Pill>
            <Pill>Importance {g.importance}/5</Pill>
            {g.status !== "active" ? (
              <Pill tone="warning">{g.status}</Pill>
            ) : st.risk !== "on_track" ? (
              <Pill tone="warning">
                {st.risk === "at_risk" ? "Behind timeline" : "Needs attention"}
              </Pill>
            ) : (
              <Pill tone="success">On track</Pill>
            )}
          </div>
          <h2 className="mt-2 text-lg font-semibold">{g.title}</h2>
          {g.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{g.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={`Edit ${g.title}`}
          onClick={onEdit}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Pencil className="size-4" />
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between font-mono text-[11px] text-muted-foreground">
          <span>{fmtDate(g.startDate, { day: "numeric", month: "short", year: "2-digit" })}</span>
          <span>
            {st.daysLeft >= 0 ? `${st.daysLeft} days left` : `${-st.daysLeft} days past target`}
          </span>
          <span>{fmtDate(g.targetDate, { day: "numeric", month: "short", year: "2-digit" })}</span>
        </div>
        <div className="relative">
          <Bar value={st.progress} tone={st.risk === "at_risk" ? "warning" : "primary"} />
          <span
            className="absolute -top-1 h-3.5 w-px bg-foreground/60"
            style={{ left: `${st.expected}%` }}
            title="Time elapsed"
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          The marker shows how much of the timeline has passed.
        </p>
      </div>

      <p className="mt-4 rounded-xl border border-primary/20 bg-primary/8 p-3 text-sm">
        <span className="eyebrow mb-1 block text-primary">NEXTMILE's read</span>
        {note}
      </p>

      <div className="mt-4">
        <p className="eyebrow mb-2">Milestones</p>
        <ul className="space-y-1">
          {g.milestones.map((m) => (
            <li key={m.id} className="group flex items-center gap-2.5">
              <button
                type="button"
                aria-label={`Toggle ${m.title}`}
                onClick={() => app.toggleMilestone(g.id, m.id)}
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-md border",
                  m.done
                    ? "border-success bg-success text-background"
                    : "border-input hover:border-primary",
                )}
              >
                {m.done ? <Check className="size-3" strokeWidth={3} /> : null}
              </button>
              <span
                className={cn("flex-1 text-sm", m.done && "text-muted-foreground line-through")}
              >
                {m.title}
              </span>
              <button
                type="button"
                aria-label={`Remove ${m.title}`}
                onClick={() => app.removeMilestone(g.id, m.id)}
                className="rounded p-1 text-muted-foreground opacity-60 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addMs} className="mt-2 flex gap-2">
          <input
            className="field h-9"
            placeholder="Add a milestone"
            value={ms}
            maxLength={120}
            onChange={(e) => setMs(e.target.value)}
          />
          <Button type="submit" size="sm" variant="soft" className="h-9">
            <Plus />
            Add
          </Button>
        </form>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          {next ? (
            <>
              Next action: <span className="text-foreground">{next.title}</span>,{" "}
              {relDay(next.date, today).toLowerCase()} · {linked.length} upcoming
            </>
          ) : (
            "No upcoming actions linked to this goal."
          )}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {g.status === "active" ? (
            <Button size="sm" variant="soft" onClick={onAddTask}>
              <Plus />
              Action
            </Button>
          ) : null}
          {g.status === "active" ? (
            <Button size="sm" variant="ghost" onClick={() => status("paused", "Goal paused")}>
              <Pause />
              Pause
            </Button>
          ) : null}
          {g.status === "paused" ? (
            <Button size="sm" variant="ghost" onClick={() => status("active", "Goal resumed")}>
              <Play />
              Resume
            </Button>
          ) : null}
          {g.status === "archived" ? (
            <Button size="sm" variant="ghost" onClick={() => status("active", "Goal restored")}>
              <RotateCcw />
              Restore
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => status("archived", "Goal archived. Nothing was deleted.")}
            >
              <Archive />
              Archive
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

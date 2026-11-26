import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, Page, Panel, TaskRow } from "@/components/nm/bits";
import { RecoveryDialog, TaskDialog } from "@/components/nm/dialogs";
import { cn } from "@/lib/utils";
import { addDays, fmtDate, fmtDur, relDay, ymd } from "@/lib/nextmile/dates";
import { isOpen, scoreTask, tasksOn } from "@/lib/nextmile/engine";
import { pageHead } from "@/lib/nextmile/head";
import { newTask, useApp, useNow } from "@/lib/nextmile/store";
import { STATUS_LABEL, type Task, type TaskStatus } from "@/lib/nextmile/types";

export const Route = createFileRoute("/tasks")({
  head: pageHead(
    "Tasks",
    "Every task by day or week, ranked by urgency, importance, energy and what it unlocks.",
  ),
  component: Tasks,
});

type Filter = "open" | "all" | TaskStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "all", label: "All" },
  { key: "completed", label: STATUS_LABEL.completed },
  { key: "missed", label: STATUS_LABEL.missed },
  { key: "postponed", label: STATUS_LABEL.postponed },
  { key: "cancelled", label: STATUS_LABEL.cancelled },
];

function Tasks() {
  const s = useApp();
  const today = ymd(useNow());
  const [view, setView] = useState<"day" | "week">("day");
  const [date, setDate] = useState(today);
  const [filter, setFilter] = useState<Filter>("open");
  const [task, setTask] = useState<Task | null>(null);
  const [missed, setMissed] = useState<Task | null>(null);
  const days = view === "day" ? [date] : Array.from({ length: 7 }, (_, i) => addDays(date, i));
  const match = (t: Task) =>
    filter === "all" || (filter === "open" ? isOpen(t) : t.status === filter);
  const step = view === "day" ? 1 : 7;
  const seg = (on: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 text-xs transition-colors",
      on ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <Page
      eyebrow="Connected to your goals"
      title="Tasks"
      actions={
        <Button variant="hero" onClick={() => setTask(newTask(date))}>
          <Plus />
          New task
        </Button>
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border p-0.5">
          <button type="button" className={seg(view === "day")} onClick={() => setView("day")}>
            Day
          </button>
          <button type="button" className={seg(view === "week")} onClick={() => setView("week")}>
            Week
          </button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Earlier"
            onClick={() => setDate(addDays(date, -step))}
          >
            <ChevronLeft />
          </Button>
          <button
            type="button"
            onClick={() => setDate(today)}
            className="min-w-28 rounded-md px-2 py-1.5 text-center text-sm font-medium hover:bg-secondary"
          >
            {view === "day"
              ? relDay(date, today)
              : `${fmtDate(date, { day: "numeric", month: "short" })} – ${fmtDate(addDays(date, 6), { day: "numeric", month: "short" })}`}
          </button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Later"
            onClick={() => setDate(addDays(date, step))}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors",
                filter === f.key
                  ? "border-primary/40 bg-primary/12 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {days.map((d) => {
          const all = tasksOn(s, d);
          const list = all.filter(match).map((t) => ({ t, ...scoreTask(t, s, today) }));
          if (d === today && filter === "open")
            list.sort((a, b) => Number(a.t.fixed) - Number(b.t.fixed) || b.score - a.score);
          if (view === "week" && !list.length) return null;
          return (
            <Panel
              key={d}
              eyebrow={fmtDate(d, { weekday: "long", day: "numeric", month: "long" })}
              title={relDay(d, today)}
              action={
                <span className="font-mono text-xs text-muted-foreground">
                  {all.filter((t) => t.status === "completed").length}/{all.length} done ·{" "}
                  {fmtDur(all.filter(isOpen).reduce((n, t) => n + t.duration, 0))} open
                </span>
              }
            >
              {list.length ? (
                <div className="space-y-0.5">
                  {list.map(({ t, reasons }) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      goal={s.goals.find((g) => g.id === t.goalId)}
                      today={today}
                      onEdit={setTask}
                      onMissed={setMissed}
                      {...(isOpen(t) && !t.fixed && d === today ? { reasons } : {})}
                    />
                  ))}
                </div>
              ) : (
                <Empty
                  title="Nothing matches"
                  text={all.length ? "Try another filter." : "No tasks are planned for this day."}
                  action={
                    <Button variant="soft" onClick={() => setTask(newTask(d))}>
                      <Plus />
                      Add a task
                    </Button>
                  }
                />
              )}
            </Panel>
          );
        })}
        {view === "week" && days.every((d) => !tasksOn(s, d).some(match)) ? (
          <Empty title="Nothing matches this week" text="Try another filter or week." />
        ) : null}
      </div>
      <TaskDialog task={task} onClose={() => setTask(null)} />
      <RecoveryDialog task={missed} onClose={() => setMissed(null)} />
    </Page>
  );
}

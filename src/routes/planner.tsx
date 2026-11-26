import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ChevronLeft, ChevronRight, Coffee, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bar, Page, Panel } from "@/components/nm/bits";
import { RecoveryDialog, TaskDialog } from "@/components/nm/dialogs";
import { Situation } from "@/components/nm/situation";
import { cn } from "@/lib/utils";
import {
  addDays,
  fmtDate,
  fmtDur,
  fmtTime,
  fromMin,
  nowMin,
  relDay,
  toMin,
  ymd,
} from "@/lib/nextmile/dates";
import { capacity, conflicts, dayLoad, sleepMin, tasksOn, wakeMin } from "@/lib/nextmile/engine";
import { pageHead } from "@/lib/nextmile/head";
import { app, newTask, useApp, useNow } from "@/lib/nextmile/store";
import type { Task } from "@/lib/nextmile/types";

export const Route = createFileRoute("/planner")({
  head: pageHead(
    "Planner",
    "A daily and weekly schedule that adapts when you are tired, short on time or something urgent appears.",
  ),
  component: Planner,
});

const HOUR = 56;
const tone = (t: Task) =>
  t.status === "completed"
    ? "border-success/30 bg-success/10 text-muted-foreground"
    : t.status === "missed" || t.status === "postponed" || t.status === "cancelled"
      ? "border-border bg-secondary/40 text-muted-foreground line-through"
      : t.fixed
        ? "border-border bg-secondary text-foreground"
        : "border-primary/35 bg-primary/15 text-foreground";

function Planner() {
  const s = useApp();
  const now = useNow();
  const today = ymd(now);
  const [view, setView] = useState<"day" | "week">("day");
  const [date, setDate] = useState(today);
  const [task, setTask] = useState<Task | null>(null);
  const [missed, setMissed] = useState<Task | null>(null);
  const [confirm, setConfirm] = useState<{ task: Task; date: string; time: string | null } | null>(
    null,
  );

  function request(id: string, d: string, time: string | null) {
    const t = s.tasks.find((x) => x.id === id);
    if (!t || (t.date === d && t.startTime === time)) return;
    if (t.fixed || t.importance >= 4 || t.date !== d) setConfirm({ task: t, date: d, time });
    else {
      app.moveTask(id, d, time);
      toast.success(`Moved to ${time ? fmtTime(time) : "any time"}`);
    }
  }
  const drag = (t: Task) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => e.dataTransfer.setData("text/plain", t.id),
  });
  const drop = (d: string, time: (t: Task | undefined) => string | null) => ({
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      request(id, d, time(s.tasks.find((x) => x.id === id)));
    },
  });

  const startH = Math.floor(wakeMin(s) / 60),
    endH = Math.ceil(sleepMin(s) / 60);
  const list = tasksOn(s, date);
  const timed = list.filter((t) => t.startTime);
  const untimed = list.filter((t) => !t.startTime);
  const lanes: number[] = [];
  const placed = timed.map((t) => {
    const a = toMin(t.startTime!);
    let lane = lanes.findIndex((end) => end <= a);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = a + t.duration;
    return { t, a, lane };
  });
  const live = timed.filter(
    (t) => t.status !== "cancelled" && t.status !== "missed" && t.status !== "postponed",
  );
  const free = Math.max(0, sleepMin(s) - wakeMin(s) - live.reduce((n, t) => n + t.duration, 0));
  const issues = conflicts(s, date, now);
  const breaks: string[] = [];
  let runStart = -1,
    runEnd = -1,
    last: Task | undefined;
  for (const t of live) {
    const a = toMin(t.startTime!);
    if (runEnd >= 0 && a - runEnd < 10) runEnd = Math.max(runEnd, a + t.duration);
    else {
      runStart = a;
      runEnd = a + t.duration;
    }
    if (runEnd - runStart >= 120 && last && breaks.length < 2)
      breaks.push(
        `Take 10 minutes around ${fmtTime(fromMin(a))}, before “${t.title}”. You'll have been going for ${fmtDur(a - runStart)}.`,
      );
    last = t;
  }
  const seg = (on: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 text-xs transition-colors",
      on ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
    );
  const step = view === "day" ? 1 : 7;
  const week = Array.from({ length: 7 }, (_, i) => addDays(date, i));
  const cap = capacity(s);

  return (
    <Page
      eyebrow="Adapts when the day changes"
      title="Planner"
      actions={
        <Button variant="hero" onClick={() => setTask(newTask(date))}>
          <Plus />
          Add to plan
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
            className="min-w-32 rounded-md px-2 py-1.5 text-center text-sm font-medium hover:bg-secondary"
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
        <p className="hidden text-xs text-muted-foreground md:block">
          Drag to reschedule. Important or fixed items ask before they move.
        </p>
      </div>

      {view === "day" ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <Panel
            className="lg:col-span-2"
            eyebrow={fmtDate(date, { weekday: "long", day: "numeric", month: "long" })}
            title="Schedule"
            action={
              <span className="font-mono text-xs text-muted-foreground">
                {fmtDur(free)} unplanned
              </span>
            }
          >
            <div className="relative" style={{ height: (endH - startH) * HOUR }}>
              {Array.from({ length: endH - startH }, (_, i) => (
                <div
                  key={i}
                  className="absolute inset-x-0 border-t border-border/70"
                  style={{ top: i * HOUR, height: HOUR }}
                >
                  <span className="absolute -top-2 left-0 bg-card pr-2 font-mono text-[10px] text-muted-foreground">
                    {fmtTime(fromMin((startH + i) * 60))}
                  </span>
                  {[0, 30].map((m) => (
                    <div
                      key={m}
                      className="absolute inset-x-0 left-16 h-1/2 rounded-md transition-colors hover:bg-secondary/30"
                      style={{ top: m ? "50%" : 0 }}
                      {...drop(date, () => fromMin((startH + i) * 60 + m))}
                      onDoubleClick={() =>
                        setTask({ ...newTask(date), startTime: fromMin((startH + i) * 60 + m) })
                      }
                    />
                  ))}
                </div>
              ))}
              {date === today && nowMin(now) >= startH * 60 && nowMin(now) <= endH * 60 ? (
                <div
                  className="pointer-events-none absolute inset-x-0 left-14 z-20 flex items-center"
                  style={{ top: ((nowMin(now) - startH * 60) / 60) * HOUR }}
                >
                  <span className="size-2 rounded-full bg-primary shadow-[var(--shadow-glow)]" />
                  <span className="h-px flex-1 bg-primary/70" />
                </div>
              ) : null}
              {placed.map(({ t, a, lane }) => (
                <button
                  key={t.id}
                  type="button"
                  {...drag(t)}
                  onClick={() => setTask(t)}
                  className={cn(
                    "absolute z-10 overflow-hidden rounded-lg border px-2.5 py-1 text-left transition-shadow hover:shadow-[var(--shadow-glow)]",
                    tone(t),
                  )}
                  style={{
                    top: ((a - startH * 60) / 60) * HOUR + 1,
                    height: Math.max(24, (t.duration / 60) * HOUR - 2),
                    left: `calc(4rem + ${(lane / lanes.length) * 100}% - ${(lane / lanes.length) * 4}rem)`,
                    width: `calc(${100 / lanes.length}% - ${4 / lanes.length}rem - 4px)`,
                  }}
                >
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    {t.fixed ? <Lock className="size-3 shrink-0" /> : null}
                    <span className="truncate">{t.title}</span>
                  </span>
                  {t.duration >= 45 ? (
                    <span className="block font-mono text-[10px] opacity-70">
                      {fmtTime(t.startTime!)} · {fmtDur(t.duration)}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </Panel>

          <div className="space-y-5">
            {date === today ? (
              <Panel eyebrow="Tell me what changed" title="Today isn't going to plan?">
                <Situation
                  onRecover={setMissed}
                  onUrgent={() => setTask({ ...newTask(today), importance: 5, dueDate: today })}
                />
              </Panel>
            ) : null}
            <Panel eyebrow="Any time" title="Unscheduled">
              <div className="min-h-12 space-y-1.5 rounded-lg" {...drop(date, () => null)}>
                {untimed.length ? (
                  untimed.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      {...drag(t)}
                      onClick={() => setTask(t)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm",
                        tone(t),
                      )}
                    >
                      <span className="truncate">{t.title}</span>
                      <span className="shrink-0 font-mono text-[10px] opacity-70">
                        {fmtDur(t.duration)}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Everything on this day has a time. Drop a task here to free it.
                  </p>
                )}
              </div>
            </Panel>
            <Panel eyebrow="Suggestions" title="From the planner">
              <div className="space-y-2.5 text-sm">
                {issues.map((c) => (
                  <p key={c.id} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                    <span>
                      {c.title}. <span className="text-muted-foreground">{c.detail}</span>
                    </span>
                  </p>
                ))}
                {breaks.map((b) => (
                  <p key={b} className="flex gap-2">
                    <Coffee className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{b}</span>
                  </p>
                ))}
                {!issues.length && !breaks.length ? (
                  <p className="text-muted-foreground">
                    No conflicts on this day, and there is breathing room between blocks.
                  </p>
                ) : null}
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[56rem] grid-cols-7 gap-3">
            {week.map((d) => {
              const load = dayLoad(s, d);
              return (
                <div
                  key={d}
                  className={cn("panel min-h-64 p-3", d === today && "panel-glow")}
                  {...drop(d, (t) => t?.startTime ?? null)}
                >
                  <p className="eyebrow">{fmtDate(d, { weekday: "short" })}</p>
                  <p className="mt-0.5 text-sm font-semibold">
                    {fmtDate(d, { day: "numeric", month: "short" })}
                  </p>
                  <div className="mb-3 mt-2">
                    <Bar value={(load / cap) * 100} tone={load > cap ? "warning" : "primary"} />
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {fmtDur(load)}
                      {load > cap ? " · heavy" : ""}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {tasksOn(s, d).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        {...drag(t)}
                        onClick={() => setTask(t)}
                        className={cn(
                          "block w-full rounded-lg border px-2 py-1.5 text-left",
                          tone(t),
                        )}
                      >
                        <span className="block truncate text-xs font-medium">{t.title}</span>
                        <span className="font-mono text-[10px] opacity-70">
                          {t.startTime ? fmtTime(t.startTime) : "Any time"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={confirm != null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          {confirm ? (
            <>
              <DialogHeader>
                <DialogTitle>Move “{confirm.task.title}”?</DialogTitle>
                <DialogDescription>
                  {confirm.task.fixed
                    ? "This is a fixed commitment. "
                    : confirm.task.importance >= 4
                      ? "This is a high-importance item. "
                      : ""}
                  {confirm.task.date !== confirm.date
                    ? `It would move from ${relDay(confirm.task.date, today).toLowerCase()} to ${relDay(confirm.date, today).toLowerCase()}`
                    : "It would move"}
                  {confirm.time ? ` at ${fmtTime(confirm.time)}` : ""}. Significant changes need
                  your confirmation.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirm(null)}>
                  Keep as it is
                </Button>
                <Button
                  variant="hero"
                  onClick={() => {
                    app.moveTask(confirm.task.id, confirm.date, confirm.time);
                    toast.success("Moved");
                    setConfirm(null);
                  }}
                >
                  Confirm move
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <TaskDialog task={task} onClose={() => setTask(null)} />
      <RecoveryDialog task={missed} onClose={() => setMissed(null)} />
    </Page>
  );
}

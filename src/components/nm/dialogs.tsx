import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { app, useApp } from "@/lib/nextmile/store";
import {
  CATEGORY_LABEL,
  REASON_LABEL,
  STATUS_LABEL,
  type Energy,
  type Goal,
  type GoalCategory,
  type MissReason,
  type Recurrence,
  type Task,
  type TaskStatus,
} from "@/lib/nextmile/types";
import { Field } from "./bits";
import { RecCard } from "./rec-card";

const content = "max-h-[92vh] overflow-y-auto sm:max-w-xl";
const cats = Object.entries(CATEGORY_LABEL) as [GoalCategory, string][];

export function TaskDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  return (
    <Dialog open={task != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={content}>
        {task ? <TaskForm key={task.id || "new"} initial={task} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({ initial, onClose }: { initial: Task; onClose: () => void }) {
  const s = useApp();
  const [t, setT] = useState(initial);
  const [error, setError] = useState("");
  const set = <K extends keyof Task>(k: K, v: Task[K]) => setT((p) => ({ ...p, [k]: v }));
  const others = s.tasks.filter(
    (o) =>
      o.id !== t.id &&
      (o.status === "not_started" || o.status === "in_progress") &&
      o.recurrence === "none",
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    const title = t.title.trim();
    if (!title) return setError("Give the task a title.");
    if (title.length > 120) return setError("Keep the title under 120 characters.");
    if (!t.date) return setError("Choose the day this is planned for.");
    if (!Number.isFinite(t.duration) || t.duration < 5 || t.duration > 600)
      return setError("Duration must be between 5 and 600 minutes.");
    if (t.dueDate && t.dueDate < t.date)
      return setError("The deadline cannot be before the planned day.");
    app.saveTask({ ...t, title });
    toast.success(initial.id ? "Task updated" : "Task added");
    onClose();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{initial.id ? "Edit task" : "New task"}</DialogTitle>
        <DialogDescription>
          Deadline, importance and energy are what the planner uses to rank it.
        </DialogDescription>
      </DialogHeader>
      <Field label="Title">
        <input
          className="field"
          value={t.title}
          maxLength={120}
          autoFocus
          onChange={(e) => set("title", e.target.value)}
        />
      </Field>
      <Field label="Description">
        <textarea
          className="field h-auto py-2"
          rows={2}
          maxLength={500}
          value={t.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Planned day">
          <input
            type="date"
            className="field"
            value={t.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </Field>
        <Field label="Start time">
          <input
            type="time"
            className="field"
            value={t.startTime ?? ""}
            onChange={(e) => set("startTime", e.target.value || null)}
          />
        </Field>
        <Field label="Minutes">
          <input
            type="number"
            min={5}
            max={600}
            step={5}
            className="field"
            value={t.duration}
            onChange={(e) => set("duration", Number(e.target.value))}
          />
        </Field>
        <Field label="Deadline (optional)">
          <input
            type="date"
            className="field"
            value={t.dueDate ?? ""}
            onChange={(e) => set("dueDate", e.target.value || null)}
          />
        </Field>
        <Field label="Importance">
          <select
            className="field"
            value={t.importance}
            onChange={(e) => set("importance", Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "· minor" : n === 5 ? "· critical" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Energy needed">
          <select
            className="field"
            value={t.energy}
            onChange={(e) => set("energy", e.target.value as Energy)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </Field>
        <Field label="Category">
          <select
            className="field"
            value={t.category}
            onChange={(e) => set("category", e.target.value as GoalCategory)}
          >
            {cats.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Linked goal">
          <select
            className="field"
            value={t.goalId ?? ""}
            onChange={(e) => set("goalId", e.target.value || null)}
          >
            <option value="">None</option>
            {s.goals
              .filter((g) => g.status !== "archived")
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Repeats">
          <select
            className="field"
            value={t.recurrence}
            onChange={(e) => set("recurrence", e.target.value as Recurrence)}
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Every day</option>
            <option value="weekdays">Weekdays</option>
            <option value="weekly">Every week</option>
          </select>
        </Field>
        <Field label="Status">
          <select
            className="field"
            value={t.status}
            onChange={(e) => set("status", e.target.value as TaskStatus)}
          >
            {(Object.entries(STATUS_LABEL) as [TaskStatus, string][]).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Waits for" className="col-span-2">
          <select
            className="field"
            value={t.dependsOn[0] ?? ""}
            onChange={(e) => set("dependsOn", e.target.value ? [e.target.value] : [])}
          >
            <option value="">Nothing</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          className="mt-1 accent-[var(--primary)]"
          checked={t.fixed}
          onChange={(e) => set("fixed", e.target.checked)}
        />
        <span>
          Fixed commitment
          <span className="block text-xs text-muted-foreground">
            The planner works around it and never proposes moving it.
          </span>
        </span>
      </label>
      <Field label="Notes">
        <textarea
          className="field h-auto py-2"
          rows={2}
          maxLength={1000}
          value={t.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="hero">
          {initial.id ? "Save changes" : "Add task"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function GoalDialog({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  return (
    <Dialog open={goal != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={content}>
        {goal ? <GoalForm key={goal.id || "new"} initial={goal} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function GoalForm({ initial, onClose }: { initial: Goal; onClose: () => void }) {
  const [g, setG] = useState(initial);
  const [error, setError] = useState("");
  const set = <K extends keyof Goal>(k: K, v: Goal[K]) => setG((p) => ({ ...p, [k]: v }));
  function submit(e: FormEvent) {
    e.preventDefault();
    const title = g.title.trim();
    if (!title) return setError("Give the goal a title.");
    if (g.targetDate <= g.startDate)
      return setError("The target date must be after the start date.");
    if (g.progress < 0 || g.progress > 100) return setError("Progress must be between 0 and 100.");
    app.saveGoal({ ...g, title });
    toast.success(initial.id ? "Goal updated" : "Goal created");
    onClose();
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{initial.id ? "Edit goal" : "New goal"}</DialogTitle>
        <DialogDescription>
          Add milestones afterwards; progress then follows them automatically.
        </DialogDescription>
      </DialogHeader>
      <Field label="Title">
        <input
          className="field"
          value={g.title}
          maxLength={120}
          autoFocus
          onChange={(e) => set("title", e.target.value)}
        />
      </Field>
      <Field label="Description">
        <textarea
          className="field h-auto py-2"
          rows={2}
          maxLength={500}
          value={g.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select
            className="field"
            value={g.category}
            onChange={(e) => set("category", e.target.value as GoalCategory)}
          >
            {cats.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Horizon">
          <select
            className="field"
            value={g.horizon}
            onChange={(e) => set("horizon", e.target.value as Goal["horizon"])}
          >
            <option value="long">Long-term</option>
            <option value="short">Short-term</option>
          </select>
        </Field>
        <Field label="Start date">
          <input
            type="date"
            className="field"
            value={g.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </Field>
        <Field label="Target date">
          <input
            type="date"
            className="field"
            value={g.targetDate}
            onChange={(e) => set("targetDate", e.target.value)}
          />
        </Field>
        <Field label="Importance">
          <select
            className="field"
            value={g.importance}
            onChange={(e) => set("importance", Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        {g.milestones.length === 0 ? (
          <Field label="Progress %">
            <input
              type="number"
              min={0}
              max={100}
              className="field"
              value={g.progress}
              onChange={(e) => set("progress", Number(e.target.value))}
            />
          </Field>
        ) : null}
      </div>
      <Field label="Notes">
        <textarea
          className="field h-auto py-2"
          rows={2}
          maxLength={1000}
          value={g.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="hero">
          {initial.id ? "Save changes" : "Create goal"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** The recovery conversation: ask what happened, then show a plan that fits the cause. */
export function RecoveryDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  return (
    <Dialog open={task != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={content}>
        {task ? <RecoveryFlow key={task.id} task={task} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function RecoveryFlow({ task, onClose }: { task: Task; onClose: () => void }) {
  const s = useApp();
  const [reason, setReason] = useState<MissReason | null>(null);
  const [note, setNote] = useState("");
  const [recId, setRecId] = useState<string | null>(null);
  const rec = s.recommendations.find((r) => r.id === recId);
  if (rec) {
    return (
      <div className="space-y-4">
        <DialogHeader>
          <DialogTitle>Here is what I'd do</DialogTitle>
          <DialogDescription>Nothing changes until you decide.</DialogDescription>
        </DialogHeader>
        <RecCard rec={rec} bare />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>What got in the way?</DialogTitle>
        <DialogDescription>
          “{task.title}” did not happen. That is information, not a verdict. The cause decides the
          fix.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.entries(REASON_LABEL) as [MissReason, string][]).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setReason(k)}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
              reason === k
                ? "border-primary bg-primary/12 text-foreground"
                : "border-border text-muted-foreground hover:border-input hover:text-foreground",
            )}
          >
            {l}
          </button>
        ))}
      </div>
      <Field label="Anything to add? (optional)">
        <textarea
          className="field h-auto py-2"
          rows={2}
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Not now
        </Button>
        <Button
          variant="hero"
          disabled={!reason}
          onClick={() => {
            if (reason) setRecId(app.recover(task.id, reason, note));
          }}
        >
          Work out a plan
        </Button>
      </DialogFooter>
    </div>
  );
}

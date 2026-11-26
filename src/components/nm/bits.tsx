import type { ReactNode } from "react";
import { Check, Pencil, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDur, fmtTime, relDay } from "@/lib/nextmile/dates";
import { app } from "@/lib/nextmile/store";
import { STATUS_LABEL, type Goal, type Task } from "@/lib/nextmile/types";

export function Page({
  eyebrow,
  title,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl animate-rise px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 lg:mb-8">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-1.5 text-2xl font-semibold sm:text-3xl">{title}</h1>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function Panel({
  title,
  eyebrow,
  action,
  className,
  children,
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("panel p-5", className)}>
      {title || action ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
            {title ? <h2 className="text-base font-semibold">{title}</h2> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

const TONES = {
  default: "border-border bg-secondary text-muted-foreground",
  primary: "border-primary/25 bg-primary/12 text-primary",
  success: "border-success/25 bg-success/12 text-success",
  warning: "border-warning/25 bg-warning/12 text-warning",
  danger: "border-destructive/30 bg-destructive/12 text-destructive",
} as const;
export type Tone = keyof typeof TONES;

export function Pill({
  tone = "default",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Ring({ value, size = 52 }: { value: number; size?: number }) {
  const r = (size - 6) / 2,
    c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={5}
          className="stroke-secondary"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, value) / 100)}
          className="stroke-primary transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-mono text-[11px] font-medium">
        {value}%
      </span>
    </div>
  );
}

export function Bar({
  value,
  tone = "primary",
}: {
  value: number;
  tone?: "primary" | "success" | "warning";
}) {
  const fill = { primary: "bg-gradient-primary", success: "bg-success", warning: "bg-warning" }[
    tone
  ];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className={cn("h-full rounded-full transition-[width] duration-700", fill)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

const STATUS_TONE: Record<Task["status"], Tone> = {
  not_started: "default",
  in_progress: "primary",
  completed: "success",
  postponed: "warning",
  missed: "danger",
  cancelled: "default",
};
export const StatusPill = ({ status }: { status: Task["status"] }) => (
  <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>
);

export function TaskRow({
  task,
  goal,
  today,
  onEdit,
  onMissed,
  reasons,
  showDate,
}: {
  task: Task;
  goal?: Goal | undefined;
  today: string;
  onEdit?: (t: Task) => void;
  onMissed?: (t: Task) => void;
  reasons?: string[];
  showDate?: boolean;
}) {
  const done = task.status === "completed";
  const open = task.status === "not_started" || task.status === "in_progress";
  return (
    <div className="group flex items-start gap-3 rounded-xl border border-transparent px-2 py-2.5 transition-colors hover:border-border hover:bg-secondary/40">
      <button
        type="button"
        aria-label={done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
        onClick={() => app.setTaskStatus(task.id, done ? "not_started" : "completed")}
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border transition-all",
          done
            ? "border-success bg-success text-background"
            : "border-input hover:border-primary hover:shadow-[var(--shadow-glow)]",
        )}
      >
        {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={cn("text-sm font-medium", done && "text-muted-foreground line-through")}>
            {task.title}
          </p>
          {task.fixed ? (
            <Pill>
              <Lock className="size-3" />
              Fixed
            </Pill>
          ) : null}
          {!open && !done ? <StatusPill status={task.status} /> : null}
          {task.dueDate && open ? (
            <Pill tone="warning">Due {relDay(task.dueDate, today).toLowerCase()}</Pill>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {[
            showDate ? relDay(task.date, today) : null,
            task.startTime ? fmtTime(task.startTime) : "Any time",
            fmtDur(task.duration),
            goal?.title,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {reasons?.length ? (
          <p className="mt-1 text-xs text-primary/90">{reasons.slice(0, 3).join(" · ")}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onMissed && open ? (
          <button
            type="button"
            onClick={() => onMissed(task)}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Missed
          </button>
        ) : null}
        {onEdit ? (
          <button
            type="button"
            aria-label={`Edit ${task.title}`}
            onClick={() => onEdit(task)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

// Permission enforcement. The planner proposes; this module decides what may run.
import type { ActionType, Autonomy, Level, ProposedAction, Task } from "./types";

/** Baseline level for each action type. Level 3 can never run automatically. */
export const BASE_LEVEL: Record<ActionType, Level> = {
  shorten_task: 2,
  skip_task: 2,
  move_task: 2,
  retime_series: 2,
  delete_data: 3,
  external_action: 3,
};

export function levelOf(
  action: ProposedAction,
  task: Task | null,
  autonomy: Autonomy,
  today: string,
): Level {
  const base = BASE_LEVEL[action.type];
  if (base === 3) return 3;
  if (!task || task.fixed || task.importance >= 4) return base;
  if (action.type === "shorten_task" && autonomy.shortenSessions && task.date === today) return 1;
  if (
    action.type === "move_task" &&
    autonomy.adjustToday &&
    action.date === today &&
    task.date === today
  )
    return 1;
  return base;
}

export function authorize(level: Level, ctx: { approved: boolean; explicitConfirm: boolean }) {
  if (level === 1) return { ok: true as const };
  if (level === 2) {
    return ctx.approved
      ? { ok: true as const }
      : { ok: false as const, reason: "This change needs your approval first." };
  }
  return ctx.approved && ctx.explicitConfirm
    ? { ok: true as const }
    : { ok: false as const, reason: "This action always needs your explicit confirmation." };
}

export const LEVEL_LABEL: Record<Level, string> = {
  1: "Automatic",
  2: "Needs approval",
  3: "Explicit confirmation",
};

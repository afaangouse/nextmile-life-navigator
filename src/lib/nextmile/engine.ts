// Planning engine: pure functions over AppState. No storage, no UI.
import {
  addDays,
  diffDays,
  fmtDur,
  fmtTime,
  fromMin,
  nowMin,
  relDay,
  toMin,
  uid,
  ymd,
  parseYmd,
} from "./dates";
import { levelOf } from "./permissions";
import type {
  AppState,
  Goal,
  Level,
  MissReason,
  ProposedAction,
  Recommendation,
  Task,
} from "./types";

export const isOpen = (t: Task) => t.status === "not_started" || t.status === "in_progress";
const counts = (t: Task) =>
  t.status !== "cancelled" && t.status !== "missed" && t.status !== "postponed";
const ceil15 = (n: number) => Math.ceil(n / 15) * 15;
const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

export const goalProgress = (g: Goal) =>
  g.milestones.length
    ? Math.round((g.milestones.filter((m) => m.done).length / g.milestones.length) * 100)
    : g.progress;

export const tasksOn = (s: AppState, date: string) =>
  s.tasks
    .filter((t) => t.date === date)
    .sort((a, b) => (a.startTime ?? "99").localeCompare(b.startTime ?? "99"));

export const wakeMin = (s: AppState) => toMin(s.profile.wake);
export const sleepMin = (s: AppState) => {
  const m = toMin(s.profile.sleep);
  return m <= wakeMin(s) ? m + 1440 : m;
};

/* ---------- Priority ---------- */

export function scoreTask(t: Task, s: AppState, today: string) {
  const reasons: string[] = [];
  let score = 0;
  const due = diffDays(t.dueDate ?? t.date, today);
  if (t.dueDate) {
    if (due <= 0) {
      score += 40;
      reasons.push("Due today");
    } else if (due === 1) {
      score += 34;
      reasons.push("Due tomorrow");
    } else if (due <= 3) {
      score += 20;
      reasons.push(`Due in ${due} days`);
    } else score += 8;
  } else score += due <= 0 ? 14 : 4;
  score += t.importance * 7;
  if (t.importance >= 4) reasons.push("High importance");
  const g = s.goals.find((x) => x.id === t.goalId);
  if (g && g.status === "active") {
    score += g.importance * 3 + (g.horizon === "long" ? 3 : 0);
    reasons.push(`Moves “${g.title}” forward`);
  }
  const unblocks = s.tasks.filter((o) => o.dependsOn.includes(t.id) && isOpen(o)).length;
  if (unblocks) {
    score += 6 * unblocks;
    reasons.push(`Unblocks ${unblocks} other task${unblocks > 1 ? "s" : ""}`);
  }
  const blocked = t.dependsOn.some((id) => {
    const d = s.tasks.find((o) => o.id === id);
    return d != null && d.status !== "completed";
  });
  if (blocked) {
    score -= 25;
    reasons.push("Waiting on another task");
  }
  if (s.day.energy === "low" && t.energy === "high") {
    score -= 18;
    reasons.push("Heavy for your current energy");
  }
  if (s.day.energy === "low" && t.energy === "low") score += 4;
  return { score, reasons };
}

export function rankToday(s: AppState, today: string) {
  return tasksOn(s, today)
    .filter((t) => isOpen(t) && !t.fixed)
    .map((task) => ({ task, ...scoreTask(task, s, today) }))
    .sort((a, b) => b.score - a.score);
}

/* ---------- Time ---------- */

export const dayLoad = (s: AppState, date: string) =>
  tasksOn(s, date)
    .filter(counts)
    .reduce((n, t) => n + t.duration, 0);
export const capacity = (s: AppState) => Math.round((sleepMin(s) - wakeMin(s)) * 0.7);

export function findSlot(s: AppState, date: string, duration: number, from: number): string | null {
  const end = sleepMin(s) - 45;
  let cur = Math.max(wakeMin(s) + 30, ceil15(from));
  const busy = tasksOn(s, date)
    .filter((t) => t.startTime && counts(t))
    .map((t) => [toMin(t.startTime!), toMin(t.startTime!) + t.duration] as const)
    .sort((a, b) => a[0] - b[0]);
  for (const [a, b] of busy) {
    if (a - cur >= duration && cur + duration <= end) return fromMin(cur);
    cur = Math.max(cur, ceil15(b));
  }
  return cur + duration <= end ? fromMin(cur) : null;
}

export function findNextSlot(s: AppState, fromDate: string, duration: number, from: number | null) {
  for (let i = 0; i < 7; i++) {
    const date = addDays(fromDate, i);
    if (dayLoad(s, date) + duration > capacity(s)) continue;
    const startTime = findSlot(s, date, duration, i === 0 && from != null ? from : 0);
    if (startTime) return { date, startTime };
  }
  return null;
}

/* ---------- Conflicts ---------- */

export interface Conflict {
  id: string;
  kind: "overlap" | "sleep" | "overload" | "energy";
  title: string;
  detail: string;
}

export function conflicts(s: AppState, date: string, now: Date): Conflict[] {
  const out: Conflict[] = [];
  const today = ymd(now);
  const live = tasksOn(s, date).filter((t) => (date === today ? isOpen(t) : counts(t)));
  const timed = live.filter((t) => t.startTime);
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i]!,
        b = timed[j]!;
      if (toMin(b.startTime!) < toMin(a.startTime!) + a.duration) {
        out.push({
          id: `ov-${a.id}-${b.id}`,
          kind: "overlap",
          title: "Two things at the same time",
          detail: `“${a.title}” and “${b.title}” overlap around ${fmtTime(b.startTime!)}.`,
        });
      }
    }
  }
  for (const t of timed) {
    if (toMin(t.startTime!) + t.duration > sleepMin(s)) {
      out.push({
        id: `sl-${t.id}`,
        kind: "sleep",
        title: "Runs into your sleep",
        detail: `“${t.title}” would end after your ${fmtTime(s.profile.sleep)} sleep time.`,
      });
    }
  }
  const load = live.reduce((n, t) => n + t.duration, 0);
  const room =
    date === today ? sleepMin(s) - Math.max(nowMin(now), wakeMin(s)) : sleepMin(s) - wakeMin(s);
  if (load > room - 45 && live.length > 0) {
    out.push({
      id: `ld-${date}`,
      kind: "overload",
      title: "More planned than the day can hold",
      detail: `${fmtDur(load)} of commitments remain, with about ${fmtDur(Math.max(0, room - 45))} before wind-down.`,
    });
  }
  if (date === today && s.day.energy === "low") {
    const heavy = live.filter((t) => t.energy === "high" && !t.fixed);
    if (heavy.length) {
      out.push({
        id: `en-${date}`,
        kind: "energy",
        title: "Demanding work on a low-energy day",
        detail: `${heavy.map((t) => `“${t.title}”`).join(", ")} needs more energy than you reported having.`,
      });
    }
  }
  return out;
}

/* ---------- Recommendations ---------- */

export type RecDraft = Omit<
  Recommendation,
  "id" | "status" | "createdAt" | "decidedAt" | "outcome" | "level"
>;

const action = (
  a: Partial<ProposedAction> & Pick<ProposedAction, "type" | "summary">,
): ProposedAction => ({
  id: uid(),
  taskId: null,
  seriesId: null,
  minutes: null,
  date: null,
  startTime: null,
  enabled: true,
  ...a,
});

export function recLevel(actions: ProposedAction[], s: AppState, today: string): Level {
  let level: Level = 1;
  for (const a of actions) {
    if (!a.enabled) continue;
    const l = levelOf(a, s.tasks.find((t) => t.id === a.taskId) ?? null, s.autonomy, today);
    if (l > level) level = l;
  }
  return level;
}

export function finalize(d: RecDraft, s: AppState, now: Date): Recommendation {
  return {
    ...d,
    id: uid(),
    level: recLevel(d.actions, s, ymd(now)),
    status: d.actions.length ? "pending" : "noted",
    createdAt: now.toISOString(),
    decidedAt: null,
    outcome: d.actions.length ? null : "No schedule change was needed.",
  };
}

/** Rebalances the rest of today around deadlines, energy, available time and sleep. */
export function planDay(s: AppState, now: Date): RecDraft | null {
  const today = ymd(now);
  const ranked = rankToday(s, today).map((r) => r.task);
  if (!ranked.length) return null;
  const sleep = sleepMin(s);
  const start = Math.max(nowMin(now), wakeMin(s));
  let budget = sleep - 45 - start;
  const fixed = tasksOn(s, today).filter((t) => t.fixed && isOpen(t) && t.startTime);
  for (const f of fixed) {
    const a = toMin(f.startTime!);
    budget -= Math.max(0, Math.min(a + f.duration, sleep) - Math.max(a, start));
  }
  const avail = s.day.availableMinutes;
  if (avail != null) budget = Math.min(budget, avail);
  budget = Math.max(0, budget);
  const low = s.day.energy === "low";
  const wanted = ranked.reduce((n, t) => n + t.duration, 0);
  const tight = wanted > budget;
  if (!low && avail == null && !tight) return null;

  const actions: ProposedAction[] = [];
  const lines: string[] = [];
  const benefits: string[] = [];
  const drawbacks: string[] = [];
  const affected = new Set<string>();
  let hasDeadline = false;
  let shortGoal: Goal | null = null;

  for (const t of ranked) {
    const deadline = t.dueDate != null && diffDays(t.dueDate, today) <= 1;
    if (t.goalId) affected.add(t.goalId);
    if (low && t.energy === "high" && !deadline) {
      actions.push(action({ type: "skip_task", taskId: t.id, summary: `Skip “${t.title}” today` }));
      lines.push(
        `“${t.title}” is physically demanding. On a low-energy day I'd drop it rather than squeeze it in late, because recovery is what protects tomorrow.`,
      );
      drawbacks.push(`“${t.title}” does not happen today.`);
      continue;
    }
    const want = deadline ? t.duration : low || tight ? Math.min(t.duration, 25) : t.duration;
    if (budget >= want) {
      budget -= want;
      if (deadline) {
        hasDeadline = true;
        lines.push(
          `“${t.title}” comes first: it is due ${relDay(t.dueDate!, today).toLowerCase()} and keeps its full ${fmtDur(t.duration)}.`,
        );
        benefits.push(`“${t.title}” is finished before its deadline.`);
      } else if (want < t.duration) {
        actions.push(
          action({
            type: "shorten_task",
            taskId: t.id,
            minutes: want,
            summary: `Shorten “${t.title}” to ${want} min`,
          }),
        );
        lines.push(
          `“${t.title}” shrinks from ${fmtDur(t.duration)} to ${want} minutes. That is the smallest session that still keeps the habit alive.`,
        );
        drawbacks.push(`“${t.title}” gets ${t.duration - want} fewer minutes today.`);
        const g = s.goals.find((x) => x.id === t.goalId);
        if (g && g.horizon === "long") shortGoal = g;
      }
    } else if (deadline) {
      hasDeadline = true;
      budget = 0;
      lines.push(
        `“${t.title}” is due ${relDay(t.dueDate!, today).toLowerCase()} and will not fully fit before wind-down. It still goes first; everything else makes room for it.`,
      );
      drawbacks.push(`“${t.title}” may run past your usual wind-down.`);
    } else {
      const slot = findNextSlot(s, addDays(today, 1), t.duration, null);
      if (slot) {
        actions.push(
          action({
            type: "move_task",
            taskId: t.id,
            date: slot.date,
            startTime: slot.startTime,
            summary: `Move “${t.title}” to ${relDay(slot.date, today)}, ${fmtTime(slot.startTime)}`,
          }),
        );
        lines.push(
          `“${t.title}” moves to ${relDay(slot.date, today).toLowerCase()} at ${fmtTime(slot.startTime)}, the first day with real room for it.`,
        );
        drawbacks.push(`“${t.title}” moves to ${relDay(slot.date, today).toLowerCase()}.`);
      } else {
        actions.push(
          action({ type: "skip_task", taskId: t.id, summary: `Set “${t.title}” aside for now` }),
        );
        lines.push(
          `“${t.title}” has no realistic slot this week, so I'd set it aside rather than overload another day.`,
        );
        drawbacks.push(`“${t.title}” is left unscheduled.`);
      }
    }
  }
  if (!actions.length) return null;
  if (shortGoal && hasDeadline)
    lines.push(
      `“${shortGoal.title}” is still a priority. Today it yields to an immediate deadline, and the short session keeps your consistency intact.`,
    );
  if (fixed.length)
    lines.push(
      `Your fixed commitments (${fixed.map((f) => f.title).join(", ")}) stay exactly where they are.`,
    );
  lines.push(`Sleep stays at ${fmtTime(s.profile.sleep)}.`);
  if (low) benefits.push("Recovery is protected, which protects tomorrow's plan.");
  if (actions.some((a) => a.type === "shorten_task"))
    benefits.push("Consistency on your long-term goals continues with a short session.");
  benefits.push(`You are in bed by ${fmtTime(s.profile.sleep)}.`);

  return {
    key: `day:${today}:${s.day.energy}:${avail ?? "-"}`,
    source: "day_plan",
    title:
      avail != null
        ? `Fit today into ${fmtDur(avail)}`
        : low
          ? "Rebalance today around your energy"
          : "Today's plan no longer fits",
    summary: actions.map((a) => a.summary).join(" · "),
    reasoning: lines.join(" "),
    affectedGoalIds: [...affected],
    benefits,
    drawbacks,
    alternatives: [
      tight
        ? "Keep the full plan and accept finishing after your sleep time."
        : "Keep the full plan as it is and see how the evening goes.",
      "Drop the shortened sessions entirely and restart tomorrow.",
      "Use Modify plan to keep only the changes you agree with.",
    ],
    ifRejected:
      "Nothing changes. Today's schedule stays as planned, and I will not raise this proposal again unless your situation changes.",
    actions,
  };
}

const REASON_INTRO: Record<MissReason, string> = {
  exhaustion:
    "This looks like a recovery problem, not a discipline problem. The day asked more of your body than the plan assumed.",
  unexpected_work:
    "Something unplanned took the time. That is a disruption, not a flaw in you or the plan.",
  lack_time: "The day simply did not have room for this.",
  underestimated: "The plan gave this less time than it really needs.",
  procrastination:
    "Avoidance usually means a task feels too big or too vague to start. The fix is a smaller first step, not more pressure.",
  conflict: "Two commitments wanted the same time, and one had to give.",
  other: "Understood.",
};

export function seriesMisses(s: AppState, t: Task, today: string) {
  if (!t.seriesId) return t.status === "missed" ? 1 : 0;
  return s.tasks.filter((o) => {
    const age = diffDays(today, o.date);
    return (
      o.seriesId === t.seriesId && (o.status === "missed" || o.id === t.id) && age >= 0 && age <= 14
    );
  }).length;
}

/** Builds a recovery proposal for one missed task, based on why it was missed. */
export function recoveryPlan(
  s: AppState,
  taskId: string,
  reason: MissReason,
  now: Date,
): RecDraft | null {
  const t = s.tasks.find((x) => x.id === taskId);
  if (!t) return null;
  const today = ymd(now);
  const recurring = t.recurrence !== "none" && t.seriesId != null;
  const misses = seriesMisses(s, t, today);
  const pattern = recurring && misses >= 2;
  const next = s.tasks
    .filter((o) => o.seriesId != null && o.seriesId === t.seriesId && isOpen(o) && o.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextText = next
    ? `Your next session is ${relDay(next.date, today).toLowerCase()}${next.startTime ? ` at ${fmtTime(next.startTime)}` : ""} and stays as planned.`
    : "";
  const actions: ProposedAction[] = [];
  const lines = [REASON_INTRO[reason]];
  const benefits: string[] = [];
  const drawbacks: string[] = [];
  let title = `Recover “${t.title}”`;

  if (pattern) {
    const minutes =
      reason === "underestimated"
        ? round5(t.duration * 1.3)
        : round5(Math.max(15, t.duration * 0.65));
    actions.push(
      action({
        type: "retime_series",
        seriesId: t.seriesId,
        minutes,
        summary: `Set upcoming “${t.title}” sessions to ${minutes} min`,
      }),
    );
    title = `Redesign your “${t.title}” routine`;
    lines.push(
      `This is miss number ${misses} in two weeks, which tells me the plan itself is the problem. Repeating it unchanged would repeat the result, so I'd change the routine instead of asking you to try harder.`,
    );
    lines.push(
      reason === "underestimated"
        ? `Upcoming sessions get ${minutes} minutes so the block matches what the work really takes.`
        : `Upcoming sessions drop to ${minutes} minutes: a version you can actually keep, which we can grow once it holds for a week.`,
    );
    lines.push("There is no catch-up session for what was missed.");
    benefits.push(
      "A routine you can keep beats an ideal one you keep missing.",
      "No extra load lands on tomorrow.",
    );
    drawbacks.push(
      reason === "underestimated"
        ? "Each session takes more of your day."
        : "Each session does less than originally planned.",
    );
  } else if (recurring && reason === "exhaustion") {
    lines.push(`I would not schedule a catch-up. ${nextText}`);
    benefits.push("Recovery now, routine intact tomorrow.");
  } else {
    const dur =
      reason === "underestimated"
        ? round5(t.duration * 1.3)
        : reason === "procrastination"
          ? Math.min(t.duration, 15)
          : recurring
            ? Math.min(t.duration, 20)
            : t.duration;
    const from = nowMin(now) + 15;
    const slot = recurring
      ? (() => {
          const st = findSlot(s, today, dur, from);
          return st ? { date: today, startTime: st } : null;
        })()
      : reason === "exhaustion"
        ? findNextSlot(s, addDays(today, 1), dur, null)
        : findNextSlot(s, today, dur, from);
    if (slot) {
      actions.push(
        action({
          type: "move_task",
          taskId: t.id,
          date: slot.date,
          startTime: slot.startTime,
          minutes: dur,
          summary: `Do “${t.title}” ${relDay(slot.date, today).toLowerCase()} at ${fmtTime(slot.startTime)} for ${dur} min`,
        }),
      );
      lines.push(
        dur < t.duration
          ? `Rather than the full ${fmtDur(t.duration)}, I'd do a ${dur}-minute version ${relDay(slot.date, today).toLowerCase()} at ${fmtTime(slot.startTime)}. It is small enough to start and enough to keep the thread.`
          : `The first realistic opening is ${relDay(slot.date, today).toLowerCase()} at ${fmtTime(slot.startTime)}, on a day that still has room for ${fmtDur(dur)}.`,
      );
      benefits.push("Nothing else on your schedule is displaced.");
      if (dur < t.duration)
        drawbacks.push(`Only ${dur} of the planned ${t.duration} minutes get done.`);
      if (t.dueDate && slot.date > t.dueDate)
        drawbacks.push(`This lands after its ${relDay(t.dueDate, today).toLowerCase()} deadline.`);
    } else {
      lines.push(
        recurring
          ? `There is no sensible room left today, so I'd let this one go. ${nextText}`
          : "The coming days are already full, and I'd rather not overload them. Place it yourself in the Planner when you see room.",
      );
      benefits.push("No day gets overloaded to make up for this.");
    }
  }
  return {
    key: `recovery:${t.id}`,
    source: "recovery",
    title,
    summary: actions.length ? actions.map((a) => a.summary).join(" · ") : "No catch-up needed",
    reasoning: lines.join(" "),
    affectedGoalIds: t.goalId ? [t.goalId] : [],
    benefits,
    drawbacks,
    alternatives: [
      "Let it go entirely and restart at the next planned session.",
      "Pick a different time yourself in the Planner.",
    ],
    ifRejected:
      "The task stays marked as missed and nothing is rescheduled. Nothing is held against you.",
    actions,
  };
}

/** Missed or silently lapsed tasks from the last week that have not been talked through. */
export function unresolvedMisses(s: AppState, today: string) {
  const handled = new Set(s.recommendations.map((r) => r.key));
  return s.tasks.filter((t) => {
    const age = diffDays(today, t.date);
    if (age < 0 || age > 7 || handled.has(`recovery:${t.id}`)) return false;
    return (t.status === "missed" && t.missReason == null) || (isOpen(t) && age > 0 && !t.fixed);
  });
}

/* ---------- Analytics ---------- */

export function weekSeries(s: AppState, today: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    const all = tasksOn(s, date).filter((t) => t.status !== "cancelled");
    return { date, total: all.length, done: all.filter((t) => t.status === "completed").length };
  });
}

export function completionRate(s: AppState, today: string, days: number) {
  let total = 0,
    done = 0;
  for (const t of s.tasks) {
    const age = diffDays(today, t.date);
    if (age < 0 || age >= days || t.status === "cancelled") continue;
    if (age === 0 && isOpen(t)) continue;
    total++;
    if (t.status === "completed") done++;
  }
  return { total, done, rate: total ? Math.round((done / total) * 100) : 0 };
}

export type Risk = "on_track" | "at_risk" | "neglected";
export function goalStats(s: AppState, g: Goal, today: string) {
  const linked = s.tasks.filter((t) => t.goalId === g.id);
  const week = linked.filter((t) => {
    const a = diffDays(today, t.date);
    return a >= 0 && a < 7;
  });
  const doneWeek = week.filter((t) => t.status === "completed");
  const activeDays = new Set(doneWeek.map((t) => t.date)).size;
  const span = Math.max(1, diffDays(g.targetDate, g.startDate));
  const expected = Math.min(
    100,
    Math.max(0, Math.round((diffDays(today, g.startDate) / span) * 100)),
  );
  const progress = goalProgress(g);
  const risk: Risk =
    g.status !== "active"
      ? "on_track"
      : activeDays === 0
        ? "neglected"
        : progress < expected - 15
          ? "at_risk"
          : "on_track";
  return {
    progress,
    expected,
    activeDays,
    risk,
    doneMinutes: doneWeek.reduce((n, t) => n + t.duration, 0),
    missedWeek: week.filter((t) => t.status === "missed").length,
    daysLeft: diffDays(g.targetDate, today),
  };
}

export interface Insight {
  id: string;
  tone: "warn" | "info" | "good";
  title: string;
  detail: string;
}

export function insights(s: AppState, now: Date): Insight[] {
  const today = ymd(now);
  const out: Insight[] = [];
  for (const g of s.goals.filter((x) => x.status === "active")) {
    const st = goalStats(s, g, today);
    if (st.risk === "neglected")
      out.push({
        id: `n-${g.id}`,
        tone: "warn",
        title: `“${g.title}” had no action this week`,
        detail: "A single short session would restart it. Small and soon beats large and later.",
      });
    else if (st.risk === "at_risk")
      out.push({
        id: `r-${g.id}`,
        tone: "warn",
        title: `“${g.title}” is behind its timeline`,
        detail: `${st.progress}% done against about ${st.expected}% of the time elapsed, with ${st.daysLeft} days left. Worth a look before it becomes urgent.`,
      });
    else if (st.activeDays >= 4)
      out.push({
        id: `g-${g.id}`,
        tone: "good",
        title: `Steady on “${g.title}”`,
        detail: `You acted on it ${st.activeDays} of the last 7 days.`,
      });
  }
  const seen = new Set<string>();
  for (const t of s.tasks) {
    if (!t.seriesId || seen.has(t.seriesId) || t.status !== "missed") continue;
    seen.add(t.seriesId);
    const n = seriesMisses(s, t, today);
    if (n >= 2)
      out.push({
        id: `p-${t.seriesId}`,
        tone: "warn",
        title: `“${t.title}” was missed ${n} times in two weeks`,
        detail:
          "That points at the schedule, not at you. Tell me what got in the way and I'll redesign it.",
      });
  }
  const mins = new Map<string, number>();
  let all = 0;
  for (const t of s.tasks) {
    const d = diffDays(t.date, today);
    if (d < 0 || d > 6 || !t.goalId || !counts(t)) continue;
    mins.set(t.goalId, (mins.get(t.goalId) ?? 0) + t.duration);
    all += t.duration;
  }
  for (const [id, m] of mins) {
    const g = s.goals.find((x) => x.id === id);
    if (g && mins.size > 1 && m / all > 0.75)
      out.push({
        id: `b-${id}`,
        tone: "info",
        title: "This week leans heavily on one goal",
        detail: `“${g.title}” takes ${Math.round((m / all) * 100)}% of your planned goal time for the next 7 days.`,
      });
  }
  return out;
}

export function briefing(s: AppState, now: Date) {
  const today = ymd(now);
  const h = now.getHours();
  const part = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const ranked = rankToday(s, today);
  const done = tasksOn(s, today).filter((t) => t.status === "completed").length;
  const lines: string[] = [];
  if (!ranked.length)
    lines.push(
      done
        ? `Everything planned for today is done (${done} completed). The rest of the day is yours.`
        : "Nothing is scheduled for today. Add a task or ask me to plan the day.",
    );
  else {
    lines.push(
      `You have ${ranked.length} open ${ranked.length === 1 ? "priority" : "priorities"} today${done ? ` and ${done} already done` : ""}.`,
    );
    const top = ranked[0]!;
    lines.push(
      `I'd start with “${top.task.title}”${top.reasons[0] ? ` (${top.reasons[0].toLowerCase()})` : ""}.`,
    );
  }
  const nm = nowMin(now);
  const nextFixed = tasksOn(s, today).find(
    (t) => t.fixed && isOpen(t) && t.startTime && toMin(t.startTime) + t.duration > nm,
  );
  if (nextFixed)
    lines.push(`Next fixed commitment: ${nextFixed.title} at ${fmtTime(nextFixed.startTime!)}.`);
  const c = conflicts(s, today, now);
  if (c.length)
    lines.push(
      `I see ${c.length} ${c.length === 1 ? "issue" : "issues"} with the current plan; a proposal is waiting where needed.`,
    );
  else if (ranked.length) lines.push("The plan fits the time you have.");
  return { greeting: `${part}, ${s.profile.name.split(" ")[0] || "there"}`, text: lines.join(" ") };
}

export function weeklyReview(s: AppState, now: Date) {
  const today = ymd(now);
  const rate = completionRate(s, today, 7);
  const active = s.goals.filter((g) => g.status === "active");
  const stats = active.map((g) => ({ g, st: goalStats(s, g, today) }));
  const moved = stats.filter((x) => x.st.activeDays > 0);
  const lines = [
    `You completed ${rate.done} of ${rate.total} planned items in the last 7 days (${rate.rate}%).`,
    active.length
      ? `You made progress on ${moved.length} of your ${active.length} active goals.`
      : "You have no active goals yet.",
  ];
  for (const { g, st } of stats) {
    if (st.missedWeek >= 2)
      lines.push(
        `“${g.title}” was disrupted ${st.missedWeek} times. I'd adjust the frequency or length rather than add catch-up sessions.`,
      );
    else if (st.activeDays === 0)
      lines.push(
        `“${g.title}” had no completed action. One short session this week is enough to restart it.`,
      );
  }
  return lines;
}

/* ---------- Recurrence ---------- */

export function ensureRecurring(s: AppState, today: string) {
  const latest = new Map<string, Task>();
  for (const t of s.tasks) {
    if (!t.seriesId || t.recurrence === "none") continue;
    const cur = latest.get(t.seriesId);
    if (!cur || t.date > cur.date) latest.set(t.seriesId, t);
  }
  const limit = addDays(today, 6);
  for (const [seriesId, last] of latest) {
    const step = last.recurrence === "weekly" ? 7 : 1;
    for (let d = addDays(last.date, step); d <= limit; d = addDays(d, step)) {
      const dow = parseYmd(d).getDay();
      if (d < today || (last.recurrence === "weekdays" && (dow === 0 || dow === 6))) continue;
      if (s.tasks.some((t) => t.seriesId === seriesId && t.date === d)) continue;
      s.tasks.push({
        ...last,
        id: uid(),
        date: d,
        dueDate: null,
        status: "not_started",
        missReason: null,
        completedAt: null,
        notes: "",
        dependsOn: [],
      });
    }
  }
}

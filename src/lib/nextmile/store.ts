// Data access layer. Screens read and write only through this module, so swapping
// browser storage for a database later does not touch the interface.
import { useEffect, useState, useSyncExternalStore } from "react";
import { uid, ymd } from "./dates";
import { respond } from "./assistant";
import { ensureRecurring, planDay, recoveryPlan } from "./engine";
import { addRecommendation, decide as decideRec, log, type Mods } from "./exec";
import { emptyState, seedState } from "./seed";
import type {
  AppState,
  Autonomy,
  CheckinPrefs,
  DayContext,
  Goal,
  GoalStatus,
  MissReason,
  Profile,
  Task,
  TaskStatus,
} from "./types";

const KEY = "nextmile:v1";
const SERVER = emptyState("1970-01-01");
let state: AppState | null = null;
const listeners = new Set<() => void>();

function prepare(s: AppState, now: Date) {
  const today = ymd(now);
  if (s.day.date !== today) s.day = { date: today, energy: "medium", availableMinutes: null };
  ensureRecurring(s, today);
  return s;
}

function load(): AppState {
  const now = new Date();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.version === 1) return prepare(parsed, now);
    }
  } catch {
    /* fall through to sample data */
  }
  return prepare(seedState(now), now);
}

function get(): AppState {
  if (typeof window === "undefined") return SERVER;
  if (!state) {
    state = load();
    save();
  }
  return state;
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}
function mutate<T>(fn: (s: AppState, now: Date) => T): T {
  const draft = structuredClone(get());
  const out = fn(draft, new Date());
  state = draft;
  save();
  listeners.forEach((l) => l());
  return out;
}

export function useApp(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    get,
    () => SERVER,
  );
}

/** Current time, refreshed every minute, so screens stay accurate while open. */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export const newGoal = (today: string): Goal => ({
  id: "",
  title: "",
  description: "",
  category: "personal",
  horizon: "long",
  startDate: today,
  targetDate: today,
  importance: 3,
  progress: 0,
  milestones: [],
  notes: "",
  status: "active",
  proactive: true,
});
export const newTask = (date: string): Task => ({
  id: "",
  title: "",
  description: "",
  date,
  dueDate: null,
  startTime: null,
  duration: 30,
  importance: 3,
  energy: "medium",
  category: "personal",
  goalId: null,
  recurrence: "none",
  seriesId: null,
  status: "not_started",
  notes: "",
  dependsOn: [],
  fixed: false,
  missReason: null,
  completedAt: null,
});

export const app = {
  saveGoal: (g: Goal) =>
    mutate((s, now) => {
      const i = s.goals.findIndex((x) => x.id === g.id);
      if (i >= 0) s.goals[i] = g;
      else {
        s.goals.push({ ...g, id: uid() });
        log(s, "you", "Goal created", g.title, now);
      }
    }),
  setGoalStatus: (id: string, status: GoalStatus) =>
    mutate((s, now) => {
      const g = s.goals.find((x) => x.id === id);
      if (!g) return;
      g.status = status;
      log(s, "you", `Goal ${status === "active" ? "resumed" : status}`, g.title, now);
    }),
  addMilestone: (goalId: string, title: string) =>
    mutate((s) => {
      s.goals.find((x) => x.id === goalId)?.milestones.push({ id: uid(), title, done: false });
    }),
  toggleMilestone: (goalId: string, id: string) =>
    mutate((s, now) => {
      const g = s.goals.find((x) => x.id === goalId);
      const m = g?.milestones.find((x) => x.id === id);
      if (!g || !m) return;
      m.done = !m.done;
      log(
        s,
        "you",
        m.done ? "Milestone reached" : "Milestone reopened",
        `${m.title} (${g.title})`,
        now,
      );
    }),
  removeMilestone: (goalId: string, id: string) =>
    mutate((s) => {
      const g = s.goals.find((x) => x.id === goalId);
      if (g) g.milestones = g.milestones.filter((m) => m.id !== id);
    }),
  saveTask: (t: Task) =>
    mutate((s, now) => {
      const next = { ...t };
      if (next.recurrence !== "none" && !next.seriesId) next.seriesId = uid();
      if (next.recurrence === "none") next.seriesId = null;
      const i = s.tasks.findIndex((x) => x.id === next.id);
      if (i >= 0) s.tasks[i] = next;
      else s.tasks.push({ ...next, id: uid() });
      ensureRecurring(s, ymd(now));
    }),
  setTaskStatus: (id: string, status: TaskStatus) =>
    mutate((s, now) => {
      const t = s.tasks.find((x) => x.id === id);
      if (!t) return;
      t.status = status;
      t.completedAt = status === "completed" ? now.toISOString() : null;
      if (status !== "missed") t.missReason = null;
      if (status === "missed" || status === "cancelled")
        log(s, "you", `Task ${status}`, t.title, now);
    }),
  moveTask: (id: string, date: string, startTime: string | null) =>
    mutate((s, now) => {
      const t = s.tasks.find((x) => x.id === id);
      if (!t) return;
      if (t.fixed || t.importance >= 4 || t.date !== date)
        log(
          s,
          "you",
          "Task rescheduled",
          `${t.title} → ${date}${startTime ? ` ${startTime}` : ""}`,
          now,
        );
      t.date = date;
      t.startTime = startTime;
      if (t.status === "missed" || t.status === "postponed") t.status = "not_started";
    }),
  /** Re-checks today against deadlines, energy and time. Returns the proposal id, if any. */
  analyse: () => mutate((s, now) => addRecommendation(s, planDay(s, now), now)?.id ?? null),
  report: (patch: Partial<DayContext>) =>
    mutate((s, now) => {
      s.day = { ...s.day, ...patch };
      log(
        s,
        "you",
        "Situation reported",
        `Energy ${s.day.energy}${s.day.availableMinutes != null ? `, ${s.day.availableMinutes} minutes available` : ""}`,
        now,
      );
      return addRecommendation(s, planDay(s, now), now)?.id ?? null;
    }),
  recover: (taskId: string, reason: MissReason, note: string) =>
    mutate((s, now) => {
      const t = s.tasks.find((x) => x.id === taskId);
      if (!t) return null;
      t.status = "missed";
      t.missReason = reason;
      t.completedAt = null;
      if (note.trim()) t.notes = [t.notes, `Missed: ${note.trim()}`].filter(Boolean).join("\n");
      log(s, "you", "Missed task explained", `${t.title}: ${reason.replace("_", " ")}`, now);
      return addRecommendation(s, recoveryPlan(s, taskId, reason, now), now)?.id ?? null;
    }),
  decide: (recId: string, decision: "approve" | "reject", mods?: Mods) =>
    mutate((s, now) => decideRec(s, recId, decision, now, mods)),
  ask: (text: string) =>
    mutate((s, now) => {
      s.chat.push({ id: uid(), role: "user", text, at: now.toISOString(), recommendationId: null });
      if (/tired|exhaust/i.test(text)) s.day.energy = "low";
      const r = respond(s, text, now);
      let recId: string | null = null;
      let reply = r.text;
      if (r.plan) {
        const rec = addRecommendation(s, planDay(s, now), now);
        if (rec) recId = rec.id;
        else if (/rearrange|reschedule|replan|tired|exhaust|deadline|urgent/i.test(text))
          reply += " The current plan already fits, so I have no changes to propose.";
      }
      s.chat.push({
        id: uid(),
        role: "assistant",
        text: reply,
        at: new Date(now.getTime() + 1).toISOString(),
        recommendationId: recId,
      });
    }),
  clearChat: () =>
    mutate((s) => {
      s.chat = [];
    }),
  updateSettings: (patch: { profile?: Profile; checkins?: CheckinPrefs; autonomy?: Autonomy }) =>
    mutate((s, now) => {
      if (patch.profile) s.profile = patch.profile;
      if (patch.checkins) s.checkins = patch.checkins;
      if (patch.autonomy) {
        s.autonomy = patch.autonomy;
        log(
          s,
          "you",
          "Autonomy changed",
          Object.entries(patch.autonomy)
            .map(([k, v]) => `${k}: ${v ? "on" : "off"}`)
            .join(", "),
          now,
        );
      }
    }),
  setGoalProactive: (id: string, on: boolean) =>
    mutate((s) => {
      const g = s.goals.find((x) => x.id === id);
      if (g) g.proactive = on;
    }),
  exportJson: () => JSON.stringify(get(), null, 2),
  resetSample: () =>
    mutate((s, now) => {
      Object.assign(s, prepare(seedState(now), now));
    }),
  clearAll: () =>
    mutate((s, now) => {
      const keep = { profile: s.profile, checkins: s.checkins, autonomy: s.autonomy };
      Object.assign(s, emptyState(ymd(now)), keep);
    }),
};

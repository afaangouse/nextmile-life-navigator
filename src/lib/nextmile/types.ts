export type GoalCategory =
  "academic" | "career" | "fitness" | "financial" | "personal" | "skill" | "health" | "other";
export type GoalStatus = "active" | "paused" | "archived" | "completed";
export type Energy = "low" | "medium" | "high";

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  horizon: "long" | "short";
  startDate: string;
  targetDate: string;
  importance: number; // 1-5
  progress: number; // used when there are no milestones
  milestones: Milestone[];
  notes: string;
  status: GoalStatus;
  proactive: boolean;
}

export type TaskStatus =
  "not_started" | "in_progress" | "completed" | "postponed" | "missed" | "cancelled";
export type Recurrence = "none" | "daily" | "weekdays" | "weekly";
export type MissReason =
  | "unexpected_work"
  | "exhaustion"
  | "lack_time"
  | "underestimated"
  | "procrastination"
  | "conflict"
  | "other";

export interface Task {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD the task is planned for
  dueDate: string | null; // hard deadline, if any
  startTime: string | null; // HH:MM
  duration: number; // minutes
  importance: number; // 1-5
  energy: Energy;
  category: GoalCategory;
  goalId: string | null;
  recurrence: Recurrence;
  seriesId: string | null;
  status: TaskStatus;
  notes: string;
  dependsOn: string[];
  fixed: boolean; // a commitment the planner must not move
  missReason: MissReason | null;
  completedAt: string | null;
}

export type ActionType =
  "shorten_task" | "skip_task" | "move_task" | "retime_series" | "delete_data" | "external_action";
export type Level = 1 | 2 | 3;

export interface ProposedAction {
  id: string;
  type: ActionType;
  taskId: string | null;
  seriesId: string | null;
  summary: string;
  minutes: number | null;
  date: string | null;
  startTime: string | null;
  enabled: boolean;
}

export type RecStatus = "pending" | "executed" | "rejected" | "failed" | "noted";

export interface Recommendation {
  id: string;
  key: string;
  source: "day_plan" | "recovery";
  title: string;
  summary: string;
  reasoning: string;
  affectedGoalIds: string[];
  benefits: string[];
  drawbacks: string[];
  alternatives: string[];
  ifRejected: string;
  actions: ProposedAction[];
  level: Level;
  status: RecStatus;
  createdAt: string;
  decidedAt: string | null;
  outcome: string | null;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: "you" | "nextmile";
  kind: string;
  detail: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  recommendationId: string | null;
}

export interface Profile {
  name: string;
  timezone: string;
  workStart: string;
  workEnd: string;
  wake: string;
  sleep: string;
}

export interface CheckinPrefs {
  morning: string;
  evening: string;
  weeklyDay: number; // 0 = Sunday
  reminders: "off" | "important" | "all";
  quietStart: string;
  quietEnd: string;
}

export interface Autonomy {
  reorderToday: boolean;
  shortenSessions: boolean;
  adjustToday: boolean;
}

export interface DayContext {
  date: string;
  energy: Energy;
  availableMinutes: number | null;
}

export interface AppState {
  version: 1;
  profile: Profile;
  checkins: CheckinPrefs;
  autonomy: Autonomy;
  day: DayContext;
  goals: Goal[];
  tasks: Task[];
  recommendations: Recommendation[];
  audit: AuditEntry[];
  chat: ChatMessage[];
}

export const CATEGORY_LABEL: Record<GoalCategory, string> = {
  academic: "Academic",
  career: "Career",
  fitness: "Fitness",
  financial: "Financial",
  personal: "Personal",
  skill: "Skill",
  health: "Health",
  other: "Other",
};
export const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  postponed: "Postponed",
  missed: "Missed",
  cancelled: "Cancelled",
};
export const REASON_LABEL: Record<MissReason, string> = {
  unexpected_work: "Unexpected work",
  exhaustion: "Physical exhaustion",
  lack_time: "Lack of time",
  underestimated: "Underestimated the duration",
  procrastination: "Procrastination or avoidance",
  conflict: "Schedule conflict",
  other: "Other",
};

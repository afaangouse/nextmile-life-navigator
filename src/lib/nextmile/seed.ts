// Sample data: the student scenario from the product brief, dated relative to today.
import { addDays, uid, ymd } from "./dates";
import type { AppState, Goal, Task } from "./types";

const task = (p: Partial<Task> & Pick<Task, "title" | "date">): Task => ({
  id: uid(),
  description: "",
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
  ...p,
});
const ms = (title: string, done = false) => ({ id: uid(), title, done });

export function emptyState(today: string): AppState {
  return {
    version: 1,
    profile: {
      name: "",
      timezone: "UTC",
      workStart: "09:00",
      workEnd: "17:00",
      wake: "06:30",
      sleep: "23:00",
    },
    checkins: {
      morning: "07:00",
      evening: "21:30",
      weeklyDay: 0,
      reminders: "important",
      quietStart: "22:30",
      quietEnd: "06:30",
    },
    autonomy: { reorderToday: true, shortenSessions: false, adjustToday: false },
    day: { date: today, energy: "medium", availableMinutes: null },
    goals: [],
    tasks: [],
    recommendations: [],
    audit: [],
    chat: [],
  };
}

export function seedState(now: Date): AppState {
  const t = ymd(now);
  const d = (n: number) => addDays(t, n);
  const s = emptyState(t);
  s.profile.name = "Gouse Afaan";
  try {
    s.profile.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* keep UTC */
  }

  const gate: Goal = {
    id: uid(),
    title: "Get into an IIT through GATE",
    description: "Clear GATE with a rank that opens an M.Tech seat at an IIT.",
    category: "academic",
    horizon: "long",
    startDate: d(-120),
    targetDate: d(240),
    importance: 5,
    progress: 0,
    milestones: [
      ms("Complete engineering fundamentals", true),
      ms("Finish the GATE syllabus"),
      ms("Complete previous-year questions"),
      ms("Take mock examinations"),
      ms("Improve examination performance"),
    ],
    notes: "Signals & Systems and Networks are the weakest subjects.",
    status: "active",
    proactive: true,
  };
  const fit: Goal = {
    id: uid(),
    title: "Build strength and stamina",
    description: "Train consistently and get match-fit for the cricket season.",
    category: "fitness",
    horizon: "long",
    startDate: d(-45),
    targetDate: d(135),
    importance: 4,
    progress: 0,
    milestones: [
      ms("Settle into a weekly routine", true),
      ms("Eight straight weeks of training"),
      ms("Run 5 km under 27 minutes"),
      ms("Bench press body weight"),
    ],
    notes: "",
    status: "active",
    proactive: true,
  };
  const college: Goal = {
    id: uid(),
    title: "Finish semester 6 above 8.5 CGPA",
    description: "Stay on top of assignments, labs and internals.",
    category: "academic",
    horizon: "short",
    startDate: d(-60),
    targetDate: d(60),
    importance: 5,
    progress: 0,
    milestones: [
      ms("Internal exams 1", true),
      ms("All lab records submitted", true),
      ms("Internal exams 2"),
      ms("End-semester exams"),
    ],
    notes: "",
    status: "active",
    proactive: true,
  };
  const fund: Goal = {
    id: uid(),
    title: "Save a ₹50,000 emergency fund",
    description: "Set aside part of the monthly stipend.",
    category: "financial",
    horizon: "long",
    startDate: d(-90),
    targetDate: d(275),
    importance: 3,
    progress: 35,
    milestones: [],
    notes: "",
    status: "active",
    proactive: false,
  };
  s.goals = [gate, fit, college, fund];

  const gym = {
    title: "Gym: strength session",
    startTime: "07:00",
    duration: 60,
    importance: 3,
    energy: "high" as const,
    category: "fitness" as const,
    goalId: fit.id,
    recurrence: "daily" as const,
    seriesId: uid(),
  };
  const study = {
    title: "GATE study: Signals & Systems",
    startTime: "19:30",
    duration: 90,
    importance: 4,
    category: "academic" as const,
    goalId: gate.id,
    recurrence: "daily" as const,
    seriesId: uid(),
  };
  const lectures = {
    title: "College lectures",
    startTime: "10:00",
    duration: 300,
    importance: 5,
    category: "academic" as const,
    goalId: college.id,
    fixed: true,
    recurrence: "weekdays" as const,
    seriesId: uid(),
  };
  const cricket = {
    title: "Cricket practice",
    startTime: "16:00",
    duration: 120,
    importance: 4,
    energy: "high" as const,
    category: "personal" as const,
    fixed: true,
  };
  const done = (n: number) => ({
    status: "completed" as const,
    completedAt: `${d(n)}T12:00:00.000Z`,
  });

  const mock = task({
    title: "GATE mock test 1",
    date: d(5),
    startTime: "09:00",
    duration: 180,
    importance: 4,
    energy: "high",
    category: "academic",
    goalId: gate.id,
  });
  s.tasks = [
    task({ ...gym, date: d(-4), status: "missed", missReason: "lack_time" }),
    task({ ...gym, date: d(-3), ...done(-3) }),
    task({ ...gym, date: d(-2), status: "missed", missReason: "exhaustion" }),
    task({ ...gym, date: d(-1), ...done(-1) }),
    task({ ...gym, date: t, status: "missed" }),
    task({ ...study, date: d(-5), ...done(-5) }),
    task({ ...study, date: d(-4), ...done(-4) }),
    task({ ...study, date: d(-3), status: "missed", missReason: "unexpected_work" }),
    task({ ...study, date: d(-2), ...done(-2) }),
    task({ ...study, date: d(-1), ...done(-1) }),
    task({ ...study, date: t }),
    task({ ...lectures, date: d(-1), ...done(-1) }),
    task({ ...lectures, date: t }),
    task({ ...cricket, date: d(-2), ...done(-2) }),
    task({ ...cricket, date: t }),
    task({ ...cricket, date: d(2) }),
    task({
      title: "DBMS assignment: normalisation",
      description: "Problems 1 to 8, handwritten submission.",
      date: t,
      dueDate: d(1),
      startTime: "21:00",
      duration: 90,
      importance: 5,
      category: "academic",
      goalId: college.id,
    }),
    task({
      title: "Review this month's budget",
      date: t,
      duration: 20,
      importance: 2,
      energy: "low",
      category: "financial",
      goalId: fund.id,
    }),
    task({
      title: "Lab record: Networks",
      date: d(-2),
      duration: 45,
      importance: 4,
      category: "academic",
      goalId: college.id,
      ...done(-2),
    }),
    task({
      title: "Previous-year questions: Networks",
      date: d(2),
      startTime: "19:30",
      duration: 60,
      importance: 4,
      category: "academic",
      goalId: gate.id,
      dependsOn: [],
    }),
    task({
      title: "Pay hostel fee",
      date: d(3),
      dueDate: d(3),
      duration: 15,
      importance: 4,
      energy: "low",
      category: "financial",
    }),
    mock,
    task({
      title: "Analyse mock test 1 mistakes",
      date: d(6),
      duration: 60,
      importance: 4,
      category: "academic",
      goalId: gate.id,
      dependsOn: [mock.id],
    }),
  ];
  return s;
}

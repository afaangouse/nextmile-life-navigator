// Rule-based assistant: answers from the planning engine and your data.
// A language model is not connected yet, so it handles a known set of questions.
import { addDays, diffDays, fmtDur, fmtTime, relDay, ymd } from "./dates";
import {
  capacity,
  completionRate,
  conflicts,
  dayLoad,
  goalStats,
  rankToday,
  unresolvedMisses,
  weeklyReview,
} from "./engine";
import type { AppState } from "./types";

export const SUGGESTED = [
  "What should I focus on today?",
  "Am I overloading myself?",
  "Am I progressing towards my goals?",
  "Why am I falling behind?",
  "Rearrange my schedule",
  "Help me recover from a bad week",
  "How much time should I allocate to each goal?",
  "Analyse my productivity this month",
];

export function respond(s: AppState, input: string, now: Date): { text: string; plan: boolean } {
  const q = input.toLowerCase();
  const today = ymd(now);
  const has = (...w: string[]) => w.some((x) => q.includes(x));
  const active = s.goals.filter((g) => g.status === "active");

  if (
    has("rearrange", "reschedule", "redesign", "tired", "exhaust", "deadline", "urgent", "replan")
  ) {
    return {
      plan: true,
      text: has("tired", "exhaust")
        ? "Understood. I've set today's energy to low and reworked the rest of the day around recovery and what truly cannot wait."
        : "I've checked the rest of today against your deadlines, energy and sleep time.",
    };
  }
  if (has("overload", "too much", "burn")) {
    const cap = capacity(s);
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((d) => ({
      d,
      load: dayLoad(s, d),
    }));
    const heavy = days.filter((x) => x.load > cap);
    const c = conflicts(s, today, now);
    return {
      plan: c.length > 0,
      text: heavy.length
        ? `Yes, on ${heavy.length} of the next 7 days. ${heavy.map((x) => `${relDay(x.d, today)} carries ${fmtDur(x.load)}`).join("; ")}, against roughly ${fmtDur(cap)} that leaves room for meals, travel and rest. I'd thin those days rather than push through them.`
        : `Not by the numbers. Your heaviest day this week carries ${fmtDur(Math.max(...days.map((x) => x.load)))} against a sustainable ${fmtDur(cap)}.${c.length ? " Today does have a conflict, so I've prepared a proposal." : ""}`,
    };
  }
  if (has("falling behind", "behind", "why am i")) {
    const misses = s.tasks.filter(
      (t) => t.status === "missed" && diffDays(today, t.date) <= 14 && diffDays(today, t.date) >= 0,
    );
    if (!misses.length)
      return {
        plan: false,
        text: "I don't see evidence that you are. Nothing was missed in the last two weeks.",
      };
    const by = new Map<string, number>();
    for (const m of misses) by.set(m.title, (by.get(m.title) ?? 0) + 1);
    const reasons = new Map<string, number>();
    for (const m of misses)
      if (m.missReason) reasons.set(m.missReason, (reasons.get(m.missReason) ?? 0) + 1);
    const top = [...by].sort((a, b) => b[1] - a[1])[0]!;
    const why = [...reasons].sort((a, b) => b[1] - a[1])[0];
    return {
      plan: false,
      text: `${misses.length} items were missed in the last two weeks. Most of them are “${top[0]}” (${top[1]} times).${why ? ` The reason you gave most often was ${why[0].replace("_", " ")}.` : " I don't yet know why; I only know what you tell me."} When the same thing slips repeatedly, the schedule is usually the problem, not the person. Open a missed item in Recommendations and I'll redesign it.`,
    };
  }
  if (has("progress", "goals")) {
    if (!active.length)
      return { plan: false, text: "You have no active goals yet. Create one and I can track it." };
    const parts = active.map((g) => {
      const st = goalStats(s, g, today);
      const tag =
        st.risk === "on_track"
          ? "on track"
          : st.risk === "at_risk"
            ? "behind its timeline"
            : "no action this week";
      return `“${g.title}”: ${st.progress}% (${tag}, active ${st.activeDays} of the last 7 days)`;
    });
    return { plan: false, text: `Here is where each goal stands. ${parts.join(". ")}.` };
  }
  if (has("bad week", "recover")) {
    const un = unresolvedMisses(s, today);
    return {
      plan: false,
      text: `${weeklyReview(s, now).join(" ")} ${un.length ? `${un.length} missed ${un.length === 1 ? "item still needs" : "items still need"} a quick conversation in Recommendations so I can plan around the real cause.` : "Nothing is waiting on you."} There is no backlog to pay off. We restart from today.`,
    };
  }
  if (has("allocate", "how much time")) {
    if (!active.length)
      return { plan: false, text: "Create a goal first and I can suggest a split." };
    const weight = active.reduce((n, g) => n + g.importance, 0);
    const pool = 14 * 60;
    return {
      plan: false,
      text: `Assuming about 14 focused hours a week outside fixed commitments, weighted by the importance you set: ${active.map((g) => `“${g.title}” ${fmtDur(Math.round(((g.importance / weight) * pool) / 15) * 15)}`).join(", ")}. No goal drops to zero; neglected goals cost more to restart than to maintain.`,
    };
  }
  if (has("month", "productiv", "analy")) {
    const m = completionRate(s, today, 30),
      w = completionRate(s, today, 7);
    return {
      plan: false,
      text: `In the last 30 days you completed ${m.done} of ${m.total} planned items (${m.rate}%). The last 7 days: ${w.done} of ${w.total} (${w.rate}%). I can only see what is recorded here, so anything done outside NEXTMILE is not counted.`,
    };
  }
  if (has("focus", "right now", "most important", "today", "priorit", "what should")) {
    const ranked = rankToday(s, today);
    if (!ranked.length)
      return {
        plan: false,
        text: "Nothing open is scheduled for today. Rest, or pull one small action forward from a goal.",
      };
    const top = ranked[0]!;
    const rest = ranked.slice(1, 3).map((r) => `“${r.task.title}”`);
    return {
      plan: conflicts(s, today, now).length > 0,
      text: `Start with “${top.task.title}”${top.task.startTime ? ` (planned for ${fmtTime(top.task.startTime)}, ${fmtDur(top.task.duration)})` : ` (${fmtDur(top.task.duration)})`}. Why: ${top.reasons.join(", ").toLowerCase() || "it carries the most weight today"}.${rest.length ? ` After that: ${rest.join(", then ")}.` : ""}`,
    };
  }
  return {
    plan: false,
    text: "I can't answer that reliably yet. At this stage I work from the planning engine, not a language model, so I handle a set of questions about your priorities, workload, goals, missed tasks and schedule. Try one of the suggestions below.",
  };
}

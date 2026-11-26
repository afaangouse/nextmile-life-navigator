import { describe, expect, it } from "vitest";
import { addDays, ymd } from "./dates";
import { planDay, rankToday, recoveryPlan } from "./engine";
import { addRecommendation, decide } from "./exec";
import { BASE_LEVEL, authorize } from "./permissions";
import { seedState } from "./seed";

// 2:00 PM on a Wednesday: assignment due tomorrow, GATE study, cricket, gym already missed.
const now = new Date(2026, 10, 25, 14, 0);
const today = ymd(now);
const tired = () => {
  const s = seedState(now);
  s.day.energy = "low";
  return s;
};
const byTitle = (s: ReturnType<typeof seedState>, part: string, date = today) =>
  s.tasks.find((t) => t.title.includes(part) && t.date === date)!;

describe("priorities", () => {
  it("ranks the assignment due tomorrow above the GATE session", () => {
    const ranked = rankToday(seedState(now), today).map((r) => r.task.title);
    expect(ranked[0]).toContain("DBMS assignment");
    expect(ranked.indexOf(ranked.find((t) => t.includes("GATE"))!)).toBeGreaterThan(0);
  });
});

describe("exhausted evening", () => {
  it("shortens GATE study to 25 minutes and leaves the assignment and cricket alone", () => {
    const s = tired();
    const plan = planDay(s, now)!;
    const gate = plan.actions.find((a) => a.taskId === byTitle(s, "GATE study").id)!;
    expect(gate.type).toBe("shorten_task");
    expect(gate.minutes).toBe(25);
    const untouched = [byTitle(s, "DBMS").id, byTitle(s, "Cricket").id];
    expect(plan.actions.some((a) => untouched.includes(a.taskId ?? ""))).toBe(false);
  });

  it("drops a demanding workout instead of rescheduling it late", () => {
    const s = tired();
    const gym = byTitle(s, "Gym");
    gym.status = "not_started";
    gym.startTime = "22:00";
    const a = planDay(s, now)!.actions.find((x) => x.taskId === gym.id)!;
    expect(a.type).toBe("skip_task");
  });

  it("changes nothing until approved, and applies once", () => {
    const s = tired();
    const rec = addRecommendation(s, planDay(s, now), now)!;
    expect(rec.status).toBe("pending");
    expect(byTitle(s, "GATE study").duration).toBe(90);
    expect(decide(s, rec.id, "approve", now).ok).toBe(true);
    expect(byTitle(s, "GATE study").duration).toBe(25);
    expect(decide(s, rec.id, "approve", now).ok).toBe(false);
  });

  it("changes nothing when rejected", () => {
    const s = tired();
    const rec = addRecommendation(s, planDay(s, now), now)!;
    decide(s, rec.id, "reject", now);
    expect(byTitle(s, "GATE study").duration).toBe(90);
    expect(rec.status).toBe("rejected");
  });
});

describe("missed-task recovery", () => {
  it("redesigns a routine missed repeatedly instead of adding a catch-up", () => {
    const s = seedState(now);
    const plan = recoveryPlan(s, byTitle(s, "Gym").id, "exhaustion", now)!;
    expect(plan.actions.map((a) => a.type)).toEqual(["retime_series"]);
    expect(plan.actions[0]!.minutes).toBeLessThan(60);
  });

  it("never moves a one-off missed task onto the same exhausted day", () => {
    const s = seedState(now);
    const t = byTitle(s, "budget");
    const move = recoveryPlan(s, t.id, "exhaustion", now)!.actions[0]!;
    expect(move.type).toBe("move_task");
    expect(move.date! >= addDays(today, 1)).toBe(true);
  });
});

describe("permissions", () => {
  it("never lets deleting data or outside actions run without explicit confirmation", () => {
    expect(BASE_LEVEL.delete_data).toBe(3);
    expect(BASE_LEVEL.external_action).toBe(3);
    expect(authorize(3, { approved: true, explicitConfirm: false }).ok).toBe(false);
  });
  it("refuses approval-level changes that were not approved", () => {
    expect(authorize(2, { approved: false, explicitConfirm: false }).ok).toBe(false);
  });
});

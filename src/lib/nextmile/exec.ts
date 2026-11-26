// State transitions for recommendations. These mutate the state they are given;
// the store hands them a private copy. Permission checks happen here, not in the UI.
import { ymd, uid } from "./dates";
import { finalize, isOpen, recLevel, type RecDraft } from "./engine";
import { authorize, levelOf } from "./permissions";
import type { AppState, AuditEntry, ProposedAction, Recommendation } from "./types";

export function log(
  s: AppState,
  actor: AuditEntry["actor"],
  kind: string,
  detail: string,
  now: Date,
) {
  s.audit.unshift({ id: uid(), at: now.toISOString(), actor, kind, detail });
  if (s.audit.length > 400) s.audit.length = 400;
}

function validate(s: AppState, a: ProposedAction, approved: boolean, today: string) {
  const task = s.tasks.find((t) => t.id === a.taskId) ?? null;
  const auth = authorize(levelOf(a, task, s.autonomy, today), { approved, explicitConfirm: false });
  if (!auth.ok) throw new Error(auth.reason);
  if (a.minutes != null && (!Number.isFinite(a.minutes) || a.minutes < 5 || a.minutes > 600))
    throw new Error("A session length must be between 5 and 600 minutes.");
  if (a.type === "retime_series") {
    if (!a.seriesId || a.minutes == null)
      throw new Error("The routine to change could not be identified.");
    if (!s.tasks.some((t) => t.seriesId === a.seriesId && isOpen(t) && t.date >= today))
      throw new Error("That routine has no upcoming sessions to change.");
    return;
  }
  if (a.type === "delete_data" || a.type === "external_action")
    throw new Error("NEXTMILE cannot perform this kind of action.");
  if (!task) throw new Error("A task in this proposal no longer exists.");
  if (task.status === "completed" || task.status === "cancelled")
    throw new Error(`“${task.title}” is already ${task.status}.`);
  if (a.type === "shorten_task" && a.minutes == null) throw new Error("No new length was given.");
  if (a.type === "move_task" && (!a.date || !a.startTime))
    throw new Error("No new time was given.");
}

function apply(s: AppState, a: ProposedAction, today: string) {
  if (a.type === "retime_series") {
    for (const t of s.tasks)
      if (t.seriesId === a.seriesId && isOpen(t) && t.date >= today) t.duration = a.minutes!;
    return;
  }
  const t = s.tasks.find((x) => x.id === a.taskId)!;
  if (a.type === "shorten_task") t.duration = a.minutes!;
  if (a.type === "skip_task") t.status = "postponed";
  if (a.type === "move_task") {
    t.date = a.date!;
    t.startTime = a.startTime!;
    t.status = "not_started";
    if (a.minutes != null) t.duration = a.minutes;
  }
}

function execute(s: AppState, rec: Recommendation, approved: boolean, now: Date) {
  const today = ymd(now);
  const todo = rec.actions.filter((a) => a.enabled);
  try {
    for (const a of todo) validate(s, a, approved, today); // all-or-nothing
    for (const a of todo) apply(s, a, today);
    rec.status = "executed";
    rec.outcome = `${todo.length} change${todo.length === 1 ? "" : "s"} applied: ${todo.map((a) => a.summary).join("; ")}.`;
    log(
      s,
      "nextmile",
      approved ? "Plan applied" : "Applied automatically",
      `${rec.title}. ${rec.outcome}`,
      now,
    );
  } catch (e) {
    rec.status = "failed";
    rec.outcome = e instanceof Error ? e.message : "The change could not be applied.";
    log(s, "nextmile", "Plan failed", `${rec.title}. ${rec.outcome}`, now);
  }
  rec.decidedAt = now.toISOString();
}

/** Adds a proposal unless one with the same key exists. Level 1 proposals run at once. */
export function addRecommendation(
  s: AppState,
  draft: RecDraft | null,
  now: Date,
): Recommendation | null {
  if (!draft) return null;
  const existing = s.recommendations.find((r) => r.key === draft.key);
  if (existing) return existing;
  const rec = finalize(draft, s, now);
  s.recommendations.unshift(rec);
  log(
    s,
    "nextmile",
    rec.status === "noted" ? "Assessment" : "Proposal prepared",
    `${rec.title}: ${rec.summary}`,
    now,
  );
  if (rec.status === "pending" && rec.level === 1) execute(s, rec, false, now);
  return rec;
}

export interface Mods {
  enabled: Record<string, boolean>;
  minutes: Record<string, number>;
}

/** Records your decision. A proposal can be decided only once, so nothing runs twice. */
export function decide(
  s: AppState,
  recId: string,
  decision: "approve" | "reject",
  now: Date,
  mods?: Mods,
) {
  const rec = s.recommendations.find((r) => r.id === recId);
  if (!rec) return { ok: false, message: "That proposal no longer exists." };
  if (rec.status !== "pending") return { ok: false, message: "That proposal was already decided." };
  const done = () => (rec.status as string) === "executed";
  if (decision === "reject") {
    rec.status = "rejected";
    rec.decidedAt = now.toISOString();
    rec.outcome = "Rejected. No changes were made.";
    log(s, "you", "Proposal rejected", rec.title, now);
    return { ok: true, message: "Rejected. Nothing was changed." };
  }
  if (mods) {
    for (const a of rec.actions) {
      a.enabled = mods.enabled[a.id] ?? a.enabled;
      const m = mods.minutes[a.id];
      if (m != null && a.minutes != null) {
        a.summary = a.summary.replace(`${a.minutes} min`, `${m} min`);
        a.minutes = m;
      }
    }
  }
  if (!rec.actions.some((a) => a.enabled))
    return { ok: false, message: "Keep at least one change, or reject the proposal." };
  rec.level = recLevel(rec.actions, s, ymd(now));
  log(s, "you", mods ? "Proposal approved with changes" : "Proposal approved", rec.title, now);
  execute(s, rec, true, now);
  return done()
    ? { ok: true, message: "Approved and applied." }
    : { ok: false, message: rec.outcome ?? "The change could not be applied." };
}

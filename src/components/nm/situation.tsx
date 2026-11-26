import { toast } from "sonner";
import { BatteryLow, Clock, Dumbbell, RotateCcw, Zap } from "lucide-react";
import { ymd } from "@/lib/nextmile/dates";
import { isOpen, tasksOn } from "@/lib/nextmile/engine";
import { app, useApp } from "@/lib/nextmile/store";
import type { Task } from "@/lib/nextmile/types";

const chip =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 [&_svg]:size-3.5 [&_svg]:text-primary";

/** Lets you tell NEXTMILE what changed; the planner then re-checks the day. */
export function Situation({
  onRecover,
  onUrgent,
}: {
  onRecover: (t: Task) => void;
  onUrgent: () => void;
}) {
  const s = useApp();
  const changed = s.day.energy === "low" || s.day.availableMinutes != null;
  const done = (id: string | null) =>
    id
      ? toast.success("I've prepared a proposal for today.", {
          description: "Review it in the Intelligence centre.",
        })
      : toast("Today's plan still fits. No changes needed.");
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={chip} onClick={() => done(app.report({ energy: "low" }))}>
        <BatteryLow />
        I'm tired
      </button>
      <button
        type="button"
        className={chip}
        onClick={() => done(app.report({ availableMinutes: 30 }))}
      >
        <Clock />I only have 30 minutes
      </button>
      <button
        type="button"
        className={chip}
        onClick={() => {
          const t = tasksOn(s, ymd(new Date())).find(
            (x) => x.category === "fitness" && isOpen(x) && !x.fixed,
          );
          if (t) onRecover(t);
          else toast("There is no open workout planned for today.");
        }}
      >
        <Dumbbell />I can't make today's workout
      </button>
      <button type="button" className={chip} onClick={onUrgent}>
        <Zap />
        Something urgent came up
      </button>
      {changed ? (
        <button
          type="button"
          className={chip}
          onClick={() => {
            app.report({ energy: "medium", availableMinutes: null });
            toast("Back to a normal day.");
          }}
        >
          <RotateCcw />
          Back to normal
        </button>
      ) : null}
    </div>
  );
}

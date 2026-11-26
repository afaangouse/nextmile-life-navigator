import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Field, Page, Panel, Pill } from "@/components/nm/bits";
import { AutonomyControls } from "@/components/nm/rec-card";
import { pageHead } from "@/lib/nextmile/head";
import { app, useApp } from "@/lib/nextmile/store";

export const Route = createFileRoute("/settings")({
  head: pageHead(
    "Settings",
    "Your profile, daily rhythm, check-in times, what NEXTMILE may do on its own, and your data.",
  ),
  component: Settings,
});

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SOON = [
  [
    "Accounts and sign-in",
    "Email and password sign-in, with your data stored privately per account. Until then everything stays in this browser.",
  ],
  [
    "Language-model assistant",
    "Open-ended conversation and richer reasoning. Today the assistant runs on the built-in planning engine.",
  ],
  [
    "Background reminders",
    "Briefings and reminders delivered while the app is closed. The times below are saved but nothing is sent yet.",
  ],
  [
    "Calendar, screen-time and wearables",
    "Not connected. NEXTMILE only knows what you enter here.",
  ],
];

function Settings() {
  const s = useApp();
  const [p, setP] = useState(s.profile);
  const [c, setC] = useState(s.checkins);
  const [confirm, setConfirm] = useState<"reset" | "clear" | null>(null);

  function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!p.name.trim()) {
      toast.error("Enter your name.");
      return;
    }
    if (p.wake === p.sleep) {
      toast.error("Wake-up and sleep times cannot be the same.");
      return;
    }
    app.updateSettings({ profile: { ...p, name: p.name.trim() } });
    toast.success("Profile saved");
  }
  function saveCheckins(e: FormEvent) {
    e.preventDefault();
    app.updateSettings({ checkins: c });
    toast.success("Check-in preferences saved");
  }
  function exportData() {
    const url = URL.createObjectURL(new Blob([app.exportJson()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "nextmile-data.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Your data was downloaded");
  }

  return (
    <Page eyebrow="Preferences, permissions and data" title="Settings">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel eyebrow="You" title="Profile and daily rhythm">
          <form onSubmit={saveProfile} className="space-y-3">
            <Field label="Name">
              <input
                className="field"
                value={p.name}
                maxLength={80}
                onChange={(e) => setP({ ...p, name: e.target.value })}
              />
            </Field>
            <Field label="Timezone" hint="Detected from this device.">
              <input
                className="field"
                value={p.timezone}
                maxLength={60}
                onChange={(e) => setP({ ...p, timezone: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Wake-up">
                <input
                  type="time"
                  className="field"
                  value={p.wake}
                  onChange={(e) => setP({ ...p, wake: e.target.value })}
                />
              </Field>
              <Field label="Sleep" hint="The planner never schedules past this.">
                <input
                  type="time"
                  className="field"
                  value={p.sleep}
                  onChange={(e) => setP({ ...p, sleep: e.target.value })}
                />
              </Field>
              <Field label="Working hours from">
                <input
                  type="time"
                  className="field"
                  value={p.workStart}
                  onChange={(e) => setP({ ...p, workStart: e.target.value })}
                />
              </Field>
              <Field label="Working hours to">
                <input
                  type="time"
                  className="field"
                  value={p.workEnd}
                  onChange={(e) => setP({ ...p, workEnd: e.target.value })}
                />
              </Field>
            </div>
            <Button type="submit" variant="hero">
              Save profile
            </Button>
          </form>
        </Panel>

        <Panel
          eyebrow="Proactive check-ins"
          title="Briefings and reminders"
          action={<Pill tone="warning">Saved, not yet sent</Pill>}
        >
          <form onSubmit={saveCheckins} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Morning briefing">
                <input
                  type="time"
                  className="field"
                  value={c.morning}
                  onChange={(e) => setC({ ...c, morning: e.target.value })}
                />
              </Field>
              <Field label="Evening review">
                <input
                  type="time"
                  className="field"
                  value={c.evening}
                  onChange={(e) => setC({ ...c, evening: e.target.value })}
                />
              </Field>
              <Field label="Weekly review day">
                <select
                  className="field"
                  value={c.weeklyDay}
                  onChange={(e) => setC({ ...c, weeklyDay: Number(e.target.value) })}
                >
                  {DAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reminders">
                <select
                  className="field"
                  value={c.reminders}
                  onChange={(e) => setC({ ...c, reminders: e.target.value as typeof c.reminders })}
                >
                  <option value="off">Off</option>
                  <option value="important">Important items only</option>
                  <option value="all">Everything</option>
                </select>
              </Field>
              <Field label="Quiet hours from">
                <input
                  type="time"
                  className="field"
                  value={c.quietStart}
                  onChange={(e) => setC({ ...c, quietStart: e.target.value })}
                />
              </Field>
              <Field label="Quiet hours to">
                <input
                  type="time"
                  className="field"
                  value={c.quietEnd}
                  onChange={(e) => setC({ ...c, quietEnd: e.target.value })}
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              The briefing on the Overview updates whenever you open NEXTMILE. Reminders that reach
              you while it is closed need the accounts stage first, so none are sent today.
            </p>
            <Button type="submit" variant="hero">
              Save check-ins
            </Button>
          </form>
          {s.goals.filter((g) => g.status === "active").length ? (
            <div className="mt-5 border-t border-border pt-4">
              <p className="eyebrow mb-3">Goals that get proactive attention</p>
              <div className="space-y-2.5">
                {s.goals
                  .filter((g) => g.status === "active")
                  .map((g) => (
                    <div key={g.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm">{g.title}</span>
                      <Switch
                        checked={g.proactive}
                        onCheckedChange={(v) => app.setGoalProactive(g.id, v)}
                        aria-label={`Proactive attention for ${g.title}`}
                      />
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
        </Panel>

        <Panel eyebrow="What NEXTMILE may do alone" title="AI autonomy">
          <AutonomyControls />
        </Panel>

        <Panel eyebrow="Yours to keep" title="Data">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Export everything</p>
                <p className="text-xs text-muted-foreground">
                  Goals, tasks, decisions and the activity log as one file.
                </p>
              </div>
              <Button variant="outline" onClick={exportData}>
                <Download />
                Export
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Restore sample data</p>
                <p className="text-xs text-muted-foreground">
                  Replaces what is here with the example student schedule.
                </p>
              </div>
              <Button variant="outline" onClick={() => setConfirm("reset")}>
                <RotateCcw />
                Restore
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Start empty</p>
                <p className="text-xs text-muted-foreground">
                  Removes all goals, tasks and history from this browser. Settings stay.
                </p>
              </div>
              <Button variant="destructive" onClick={() => setConfirm("clear")}>
                <Trash2 />
                Clear
              </Button>
            </div>
          </div>
        </Panel>

        <Panel className="lg:col-span-2" eyebrow="Honest status" title="Not connected yet">
          <ul className="grid gap-4 sm:grid-cols-2">
            {SOON.map(([t, d]) => (
              <li key={t} className="rounded-xl border border-border p-3">
                <p className="flex items-center justify-between gap-2 text-sm font-medium">
                  {t}
                  <Pill>Planned</Pill>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{d}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Dialog open={confirm != null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "clear"
                ? "Remove all goals, tasks and history?"
                : "Replace your data with the sample?"}
            </DialogTitle>
            <DialogDescription>
              This cannot be undone. Export first if you want a copy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm === "clear") app.clearAll();
                else app.resetSample();
                toast.success(
                  confirm === "clear" ? "Everything was cleared" : "Sample data restored",
                );
                setConfirm(null);
              }}
            >
              {confirm === "clear" ? "Yes, clear everything" : "Yes, replace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

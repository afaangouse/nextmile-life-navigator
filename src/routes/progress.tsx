import { createFileRoute } from "@tanstack/react-router";
import { Bar, Empty, Page, Panel, Pill } from "@/components/nm/bits";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDur, ymd } from "@/lib/nextmile/dates";
import {
  completionRate,
  goalStats,
  insights,
  weekSeries,
  weeklyReview,
} from "@/lib/nextmile/engine";
import { pageHead } from "@/lib/nextmile/head";
import { useApp, useNow } from "@/lib/nextmile/store";

export const Route = createFileRoute("/progress")({
  head: pageHead(
    "Progress",
    "Weekly and monthly progress, goal consistency and early warnings for goals drifting off their timeline.",
  ),
  component: Progress,
});

function Progress() {
  const s = useApp();
  const now = useNow();
  const today = ymd(now);
  const series = weekSeries(s, today);
  const w = completionRate(s, today, 7),
    m = completionRate(s, today, 30);
  const review = weeklyReview(s, now);
  const goals = s.goals.filter((g) => g.status === "active");
  const notes = insights(s, now);
  const missed = s.tasks.filter((t) => t.status === "missed").length;

  return (
    <Page eyebrow="Sustainable progress, not maximum output" title="Progress">
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2" eyebrow="Last 7 days" title="Daily completion">
          <div className="flex h-44 items-end gap-2 sm:gap-4">
            {series.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {d.done}/{d.total}
                </span>
                <div className="flex h-28 w-full items-end overflow-hidden rounded-lg bg-secondary">
                  <div
                    className="w-full rounded-lg bg-gradient-primary transition-[height] duration-700"
                    style={{ height: `${d.total ? (d.done / d.total) * 100 : 0}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "font-mono text-[10px]",
                    d.date === today ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {fmtDate(d.date, { weekday: "short" })}
                </span>
              </div>
            ))}
          </div>
        </Panel>
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          {[
            ["This week", `${w.rate}%`, `${w.done} of ${w.total}`],
            ["30 days", `${m.rate}%`, `${m.done} of ${m.total}`],
            ["Missed", String(missed), "recorded, none held against you"],
          ].map(([k, v, sub]) => (
            <div key={k} className="panel p-4">
              <p className="eyebrow">{k}</p>
              <p className="mt-2 font-display text-2xl font-semibold">{v}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>

        <Panel className="lg:col-span-2" eyebrow="Consistency and risk" title="Goals">
          {goals.length ? (
            <div className="space-y-5">
              {goals.map((g) => {
                const st = goalStats(s, g, today);
                return (
                  <div key={g.id}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{g.title}</p>
                      <Pill tone={st.risk === "on_track" ? "success" : "warning"}>
                        {st.risk === "on_track"
                          ? "On track"
                          : st.risk === "at_risk"
                            ? "Behind timeline"
                            : "No action this week"}
                      </Pill>
                    </div>
                    <div className="relative">
                      <Bar
                        value={st.progress}
                        tone={st.risk === "at_risk" ? "warning" : "primary"}
                      />
                      <span
                        className="absolute -top-1 h-3.5 w-px bg-foreground/60"
                        style={{ left: `${st.expected}%` }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {st.progress}% done · {st.expected}% of time elapsed
                      </span>
                      <span className="flex items-center gap-1.5">
                        Active days
                        <span className="flex gap-0.5">
                          {Array.from({ length: 7 }, (_, i) => (
                            <span
                              key={i}
                              className={cn(
                                "size-2 rounded-sm",
                                i < st.activeDays ? "bg-primary" : "bg-secondary",
                              )}
                            />
                          ))}
                        </span>
                      </span>
                      <span>{fmtDur(st.doneMinutes)} this week</span>
                      {st.missedWeek ? <span>{st.missedWeek} missed</span> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty
              title="No active goals"
              text="Progress appears here once a goal has linked actions."
            />
          )}
        </Panel>

        <div className="space-y-5">
          <Panel eyebrow="Generated from your records" title="Weekly review">
            <div className="space-y-2.5 text-sm leading-relaxed">
              {review.map((l) => (
                <p key={l}>{l}</p>
              ))}
            </div>
          </Panel>
          {notes.length ? (
            <Panel eyebrow="Worth knowing" title="Patterns">
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id}>
                    <p className="text-sm">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.detail}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </Page>
  );
}

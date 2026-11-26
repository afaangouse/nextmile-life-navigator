import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Empty, Page, Panel, Pill } from "@/components/nm/bits";
import { RecCard } from "@/components/nm/rec-card";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDur } from "@/lib/nextmile/dates";
import { pageHead } from "@/lib/nextmile/head";
import { useApp } from "@/lib/nextmile/store";

export const Route = createFileRoute("/history")({
  head: pageHead(
    "History",
    "Completed tasks, every recommendation you approved or rejected, and a full activity log.",
  ),
  component: HistoryPage,
});

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const TABS = [
  ["decisions", "Decisions"],
  ["completed", "Completed tasks"],
  ["log", "Activity log"],
] as const;

function HistoryPage() {
  const s = useApp();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("decisions");
  const decided = s.recommendations.filter((r) => r.status !== "pending");
  const completed = s.tasks
    .filter((t) => t.status === "completed")
    .sort((a, b) => (b.completedAt ?? b.date).localeCompare(a.completedAt ?? a.date));

  return (
    <Page eyebrow="Nothing happens without a record" title="History">
      <div className="mb-5 flex gap-1.5 overflow-x-auto">
        {TABS.map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs transition-colors",
              tab === k
                ? "border-primary/40 bg-primary/12 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === "decisions" ? (
        decided.length ? (
          <div className="space-y-4">
            {decided.map((r) => (
              <div key={r.id}>
                <p className="mb-1.5 font-mono text-[11px] text-muted-foreground">
                  {when(r.decidedAt ?? r.createdAt)}
                </p>
                <RecCard rec={r} />
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="No decisions yet"
            text="Proposals you approve, modify or reject are kept here with their reasoning and outcome."
          />
        )
      ) : null}
      {tab === "completed" ? (
        completed.length ? (
          <Panel>
            <ul className="divide-y divide-border">
              {completed.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="text-sm">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        fmtDate(t.date),
                        fmtDur(t.duration),
                        s.goals.find((g) => g.id === t.goalId)?.title,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Pill tone="success">Completed</Pill>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <Empty title="Nothing completed yet" text="Completed tasks collect here." />
        )
      ) : null}
      {tab === "log" ? (
        s.audit.length ? (
          <Panel>
            <ol className="space-y-3">
              {s.audit.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="w-28 shrink-0 font-mono text-[11px] text-muted-foreground">
                    {when(a.at)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm">
                      <Pill tone={a.actor === "nextmile" ? "primary" : "default"} className="mr-2">
                        {a.actor === "nextmile" ? "NEXTMILE" : "You"}
                      </Pill>
                      {a.kind}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        ) : (
          <Empty
            title="The log is empty"
            text="Important actions by you and by NEXTMILE are recorded here as they happen."
          />
        )
      ) : null}
    </Page>
  );
}

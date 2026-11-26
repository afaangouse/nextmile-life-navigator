import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/nm/bits";
import { RecCard } from "@/components/nm/rec-card";
import { cn } from "@/lib/utils";
import { SUGGESTED } from "@/lib/nextmile/assistant";
import { pageHead } from "@/lib/nextmile/head";
import { app, useApp } from "@/lib/nextmile/store";

export const Route = createFileRoute("/assistant")({
  head: pageHead(
    "AI Assistant",
    "Ask what to focus on, whether you're overloaded or how to recover a bad week, answered from your own goals and schedule.",
  ),
  component: Assistant,
});

function Mark() {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-primary font-display text-[11px] font-bold text-primary-foreground">
      N
    </span>
  );
}

function Assistant() {
  const s = useApp();
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [s.chat.length]);

  function send(q: string) {
    const v = q.trim().slice(0, 500);
    if (!v) return;
    app.ask(v);
    setText("");
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(text);
  };

  return (
    <Page
      eyebrow="Strategic, calm, grounded in your data"
      title="AI Assistant"
      actions={
        s.chat.length ? (
          <Button variant="ghost" size="sm" onClick={() => app.clearChat()}>
            <Trash2 />
            Clear conversation
          </Button>
        ) : undefined
      }
    >
      <div className="mx-auto max-w-3xl">
        <p className="mb-5 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Current stage:</span> answers come from
          NEXTMILE's planning engine reading your goals, tasks and schedule. Open-ended conversation
          arrives when the language model is connected, so for now I handle the questions below and
          say so when I can't answer.
        </p>

        <div className="space-y-5">
          {s.chat.length === 0 ? (
            <div className="flex gap-3">
              <Mark />
              <div className="text-sm leading-relaxed">
                <p>
                  I have your goals, today's schedule and the last few weeks of activity in view.
                  Ask me where to put your attention, or tell me what changed.
                </p>
              </div>
            </div>
          ) : null}
          {s.chat.map((m) => {
            const rec = s.recommendations.find((r) => r.id === m.recommendationId);
            return m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {m.text}
                </p>
              </div>
            ) : (
              <div key={m.id} className="flex animate-rise gap-3">
                <Mark />
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="text-sm leading-relaxed">{m.text}</p>
                  {rec ? <RecCard rec={rec} /> : null}
                </div>
              </div>
            );
          })}
          <div ref={end} />
        </div>

        <div
          className={cn(
            "mt-6 flex flex-wrap gap-2",
            s.chat.length > 0 && "border-t border-border pt-4",
          )}
        >
          {SUGGESTED.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              className="rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {q}
            </button>
          ))}
        </div>

        <form
          onSubmit={submit}
          className="sticky bottom-20 mt-4 flex items-end gap-2 rounded-2xl border border-input bg-card/95 p-2 shadow-[var(--shadow-panel)] backdrop-blur focus-within:border-ring lg:bottom-6"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={1}
            maxLength={500}
            placeholder="Ask about your priorities, workload or goals"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button
            type="submit"
            size="icon"
            variant="hero"
            aria-label="Send"
            disabled={!text.trim()}
            className="size-10 shrink-0 rounded-xl"
          >
            <ArrowUp />
          </Button>
        </form>
      </div>
    </Page>
  );
}

import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  BrainCircuit,
  CalendarClock,
  History,
  LayoutDashboard,
  ListChecks,
  Menu,
  MessagesSquare,
  Settings,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { useApp } from "@/lib/nextmile/store";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/planner", label: "Planner", icon: CalendarClock },
  { to: "/assistant", label: "AI Assistant", icon: MessagesSquare },
  { to: "/intelligence", label: "AI Intelligence", icon: BrainCircuit },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;
const BOTTOM = [NAV[0], NAV[2], NAV[3], NAV[4]];

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-gradient-primary shadow-[var(--shadow-glow)]">
        <svg
          viewBox="0 0 24 24"
          className="size-4.5 text-primary-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 19V6l9 12V5" />
          <path d="M17 8l3-3-3-3" transform="translate(-1 3)" />
        </svg>
      </span>
      <span className="font-display text-[15px] font-semibold tracking-[0.18em]">NEXTMILE</span>
    </div>
  );
}

const item =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-foreground [&_svg]:size-4 data-[status=active]:[&_svg]:text-primary";

export function AppShell({ children }: { children: ReactNode }) {
  const s = useApp();
  const [menu, setMenu] = useState(false);
  const pending = s.recommendations.filter((r) => r.status === "pending").length;
  const links = (onClick?: () => void) =>
    NAV.map((n) => (
      <Link
        key={n.to}
        to={n.to}
        activeOptions={{ exact: n.to === "/" }}
        className={item}
        onClick={onClick}
      >
        <n.icon />
        <span className="flex-1">{n.label}</span>
        {n.to === "/intelligence" && pending ? (
          <span className="rounded-full bg-primary px-1.5 font-mono text-[10px] font-semibold text-primary-foreground">
            {pending}
          </span>
        ) : null}
      </Link>
    ));

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar/90 px-4 py-6 backdrop-blur lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">{links()}</nav>
        <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3">
          <p className="eyebrow">Planning engine</p>
          <p className="mt-1.5 flex items-center gap-2 text-sm">
            <span className={`size-2 rounded-full ${pending ? "bg-warning" : "bg-success"}`} />
            {pending ? "Waiting for approval" : "Ready"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Sample data, saved in this browser.</p>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMenu(true)}
          className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
        >
          <Menu className="size-5" />
        </button>
      </header>

      {menu ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setMenu(false)}
          />
          <div className="absolute inset-y-0 right-0 w-72 max-w-[85vw] animate-rise border-l border-border bg-sidebar p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="eyebrow">Navigate</p>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenu(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">{links(() => setMenu(false))}</nav>
          </div>
        </div>
      ) : null}

      <main>{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {BOTTOM.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.to === "/" }}
            className="flex flex-col items-center gap-1 py-2.5 text-[10px] text-muted-foreground data-[status=active]:text-primary [&_svg]:size-5"
          >
            <n.icon />
            {n.label.replace("AI ", "")}
          </Link>
        ))}
        <Link
          to="/intelligence"
          className="relative flex flex-col items-center gap-1 py-2.5 text-[10px] text-muted-foreground data-[status=active]:text-primary [&_svg]:size-5"
        >
          <BrainCircuit />
          Intelligence
          {pending ? (
            <span className="absolute right-[26%] top-1.5 size-2 rounded-full bg-primary" />
          ) : null}
        </Link>
      </nav>
    </div>
  );
}

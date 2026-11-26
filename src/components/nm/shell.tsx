import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BrainCircuit,
  CalendarClock,
  ChevronDown,
  Ellipsis,
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

const MAIN_NAV = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/planner", label: "Planner", icon: CalendarClock },
] as const;
const MORE_NAV = [
  { to: "/assistant", label: "Ask NEXTMILE", icon: MessagesSquare },
  { to: "/intelligence", label: "Recommendations", icon: BrainCircuit },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

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
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:font-semibold data-[status=active]:text-foreground [&_svg]:size-4 data-[status=active]:[&_svg]:text-primary";

export function AppShell({ children }: { children: ReactNode }) {
  const s = useApp();
  const [menu, setMenu] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const pending = s.recommendations.filter((r) => r.status === "pending").length;
  const morePageIsActive = MORE_NAV.some((n) => n.to === pathname);
  const links = (items: typeof MAIN_NAV | typeof MORE_NAV, onClick?: () => void) =>
    items.map((n) => (
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
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
            {pending}
          </span>
        ) : null}
      </Link>
    ));

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-9 flex flex-1 flex-col gap-1">
          <p className="eyebrow mb-2 px-3">Your day</p>
          {links(MAIN_NAV)}
          <button
            type="button"
            aria-expanded={moreOpen || morePageIsActive}
            onClick={() => setMoreOpen(!moreOpen)}
            className={`${item} mt-5 w-full justify-between`}
          >
            <span className="flex items-center gap-3">
              <Ellipsis className="size-4" />
              More
            </span>
            {pending ? (
              <span className="mr-auto rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {pending}
              </span>
            ) : null}
            <ChevronDown
              className={`size-4 transition-transform ${moreOpen || morePageIsActive ? "rotate-180" : ""}`}
            />
          </button>
          {moreOpen || morePageIsActive ? (
            <div className="ml-3 flex flex-col gap-1 border-l border-sidebar-border pl-2">
              {links(MORE_NAV)}
            </div>
          ) : null}
        </nav>
        <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/70 p-4">
          <p className="text-sm font-semibold">Your plan, your pace</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {pending
              ? `${pending} suggestion${pending === 1 ? "" : "s"} ready for you to review.`
              : "Your plan is ready whenever you are."}
          </p>
          <p className="mt-3 border-t border-sidebar-border pt-3 text-[11px] text-muted-foreground">
            Your information is saved in this browser.
          </p>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMenu(true)}
          className="rounded-xl p-2 text-muted-foreground hover:bg-secondary"
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
          <div className="absolute inset-y-0 right-0 w-72 max-w-[85vw] animate-rise overflow-y-auto border-l border-border bg-sidebar p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Where would you like to go?</p>
                <p className="mt-1 text-xs text-muted-foreground">Choose a section</p>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenu(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              <p className="eyebrow mb-1 mt-3 px-3">Your day</p>
              {links(MAIN_NAV, () => setMenu(false))}
              <p className="eyebrow mb-1 mt-5 px-3">More</p>
              {links(MORE_NAV, () => setMenu(false))}
            </nav>
          </div>
        </div>
      ) : null}

      <main>{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {MAIN_NAV.slice(0, 4).map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.to === "/" }}
            className="flex flex-col items-center gap-1 py-2.5 text-[10px] text-muted-foreground data-[status=active]:text-primary [&_svg]:size-5"
          >
            <n.icon />
            {n.label}
          </Link>
        ))}
        <button
          type="button"
          aria-label="Browse all sections"
          onClick={() => setMenu(true)}
          className="relative flex flex-col items-center gap-1 py-2.5 text-[10px] text-muted-foreground hover:text-primary [&_svg]:size-5"
        >
          <Ellipsis />
          More
          {pending ? (
            <span className="absolute right-[28%] top-1.5 size-2 rounded-full bg-primary" />
          ) : null}
        </button>
      </nav>
    </div>
  );
}

import React from "react";
import { Link, useLocation } from "wouter";
import {
  Home,
  Calendar,
  Dumbbell,
  Utensils,
  MessageSquare,
  BookOpen,
  LineChart,
  CreditCard,
} from "lucide-react";

const ALL_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/meals", label: "Meals", icon: Utensils },
  { href: "/coach", label: "Coach", icon: MessageSquare },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/progress", label: "Progress", icon: LineChart },
];

const MOBILE_NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/schedule", label: "Plan", icon: Calendar },
  { href: "/meals", label: "Meals", icon: Utensils },
  { href: "/coach", label: "Coach", icon: MessageSquare },
  { href: "/journal", label: "Journal", icon: BookOpen },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Today",
  "/schedule": "Schedule",
  "/workouts": "Workouts",
  "/meals": "Meals",
  "/coach": "Coach",
  "/journal": "Journal",
  "/progress": "Progress",
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const pageTitle = PAGE_TITLES[location];

  return (
    <div
      className="flex flex-col md:flex-row bg-background"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="px-6 py-5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-extrabold text-sm">U</span>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">Upgrade</h1>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 space-y-1">
          {ALL_NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-elevated"
                }`}
              >
                <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3">
          <Link
            href="/pricing"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors"
          >
            <CreditCard className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
            Pricing
          </Link>
        </div>
      </aside>

      {/* ── Mobile Top Bar ── */}
      <header
        className="md:hidden shrink-0 bg-background/80 backdrop-blur-xl border-b border-border/60"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-extrabold text-xs">U</span>
            </div>
            <span className="text-base font-bold tracking-tight text-foreground">
              {pageTitle ?? "Upgrade"}
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>

      {/* ── Mobile Bottom Nav ── */}
      <nav
        className="md:hidden shrink-0 bg-card/95 backdrop-blur-xl border-t border-border/60"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="h-[68px] flex items-stretch px-1">
          {MOBILE_NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center gap-1.5"
              >
                <div
                  className={`flex items-center justify-center w-11 h-7 rounded-full transition-colors ${
                    isActive ? "bg-primary/15" : ""
                  }`}
                >
                  <item.icon
                    className={`w-[22px] h-[22px] transition-colors ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                    strokeWidth={isActive ? 2.4 : 2}
                  />
                </div>
                <span
                  className={`text-[10px] font-semibold transition-colors leading-none ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

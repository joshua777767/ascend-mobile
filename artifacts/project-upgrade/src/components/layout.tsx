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
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/meals", label: "Meals", icon: Utensils },
  { href: "/coach", label: "Coach", icon: MessageSquare },
  { href: "/journal", label: "Journal", icon: BookOpen },
];

const PAGE_TITLES: Record<string, string> = {
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
        <div className="px-6 py-5 border-b border-border">
          <h1 className="text-xl font-bold uppercase tracking-tighter text-primary">
            Upgrade
          </h1>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {ALL_NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium uppercase tracking-wider transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary border-l-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <Link
            href="/pricing"
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            Pricing
          </Link>
        </div>
      </aside>

      {/* ── Mobile Top Bar ── */}
      <div
        className="md:hidden shrink-0 flex items-end bg-card border-b border-border"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="w-full h-[52px] flex items-center justify-between px-4">
          <span className="text-base font-bold uppercase tracking-tighter text-primary">
            UPGRADE
          </span>
          {pageTitle ? (
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {pageTitle}
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Main Content ── */}
      <main
        className="flex-1 min-h-0 overflow-hidden"
      >
        {children}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <div
        className="md:hidden shrink-0 bg-card border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="h-[62px] flex items-stretch">
          {MOBILE_NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center gap-1 relative"
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary" />
                )}
                <item.icon
                  className={`w-5 h-5 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider transition-colors leading-none ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

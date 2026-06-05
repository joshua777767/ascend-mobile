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
  Settings,
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

function AscendLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-7 h-7 rounded-lg" : "w-8 h-8 rounded-xl";
  const text = size === "sm" ? "text-[11px]" : "text-sm";
  return (
    <div
      className={`${dim} flex items-center justify-center shrink-0 select-none`}
      style={{
        background: "linear-gradient(140deg, #3B82F6 0%, #2DD4BF 100%)",
        boxShadow: "0 0 14px rgba(59,130,246,0.45), 0 2px 6px rgba(0,0,0,0.4)",
      }}
    >
      <span
        className={`text-white font-black ${text}`}
        style={{ letterSpacing: "-0.03em", fontFamily: "'Inter', sans-serif" }}
      >
        A
      </span>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const pageTitle = PAGE_TITLES[location];

  return (
    <div
      className="flex flex-col md:flex-row bg-background"
      style={{ height: "100dvh", overflow: "hidden" }}
    >
      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden md:flex w-64 shrink-0 flex-col border-r"
        style={{
          borderColor: "hsl(217 32% 14%)",
          background: "linear-gradient(180deg, hsl(220 55% 7%) 0%, hsl(220 52% 8%) 100%)",
        }}
      >
        <div className="px-5 py-5 flex items-center gap-2.5 border-b" style={{ borderColor: "hsl(217 32% 13%)" }}>
          <AscendLogo />
          <div>
            <h1 className="text-[15px] font-black tracking-tight text-foreground leading-none">Ascend</h1>
            <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-muted-foreground mt-0.5">Command Center</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {ALL_NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-elevated"
                }`}
                style={isActive ? {
                  background: "rgba(59,130,246,0.1)",
                  boxShadow: "inset 0 1px 0 rgba(59,130,246,0.08)",
                } : {}}
              >
                {isActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full"
                    style={{ background: "linear-gradient(180deg, #3B82F6 0%, #2DD4BF 100%)" }}
                  />
                )}
                <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={isActive ? 2.4 : 2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 space-y-0.5 border-t" style={{ borderColor: "hsl(217 32% 13%)" }}>
          <Link
            href="/settings"
            className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              location === "/settings"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-elevated"
            }`}
            style={location === "/settings" ? { background: "rgba(59,130,246,0.1)" } : {}}
          >
            {location === "/settings" && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full"
                style={{ background: "linear-gradient(180deg, #3B82F6 0%, #2DD4BF 100%)" }} />
            )}
            <Settings className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
            Settings
          </Link>
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
        className="md:hidden shrink-0 backdrop-blur-xl"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          background: "linear-gradient(180deg, hsl(220 55% 6% / 0.95) 0%, hsl(220 52% 7% / 0.90) 100%)",
          borderBottom: "1px solid hsl(217 32% 13%)",
        }}
      >
        <div className="h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <AscendLogo size="sm" />
            <div>
              <span className="text-[15px] font-black tracking-tight text-foreground leading-none">
                {pageTitle ?? "Ascend"}
              </span>
            </div>
          </div>
          <Link
            href="/settings"
            aria-label="Settings"
            className={`flex items-center justify-center w-9 h-9 rounded-full transition-all ${
              location === "/settings"
                ? "text-primary"
                : "text-muted-foreground"
            }`}
            style={location === "/settings" ? { background: "rgba(59,130,246,0.12)" } : {}}
          >
            <Settings className="w-[20px] h-[20px]" strokeWidth={2} />
          </Link>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>

      {/* ── Mobile Bottom Nav ── */}
      <nav
        className="md:hidden shrink-0 backdrop-blur-xl"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          background: "linear-gradient(0deg, hsl(220 55% 6% / 0.97) 0%, hsl(220 52% 7% / 0.95) 100%)",
          borderTop: "1px solid hsl(217 32% 13%)",
        }}
      >
        <div className="h-[68px] flex items-stretch px-1">
          {MOBILE_NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center gap-1.5 relative"
              >
                {isActive && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full"
                    style={{ background: "linear-gradient(90deg, #3B82F6 0%, #2DD4BF 100%)" }}
                  />
                )}
                <item.icon
                  className={`w-[22px] h-[22px] transition-all ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span
                  className={`text-[10px] font-bold transition-colors leading-none tracking-wide ${
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

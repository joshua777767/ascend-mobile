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
  Zap,
} from "lucide-react";
import { useTrialDay } from "@/hooks/use-trial";

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


function TrialPill() {
  const { trialDay, daysLeft, trialComplete, isPro, isLoading } = useTrialDay();

  if (isLoading) {
    return (
      <div
        className="mx-3 mb-3 rounded-xl px-3 py-2.5 h-10 animate-pulse"
        style={{ background: "rgba(200,154,62,0.04)", border: "1px solid rgba(200,154,62,0.08)" }}
      />
    );
  }

  if (isPro) {
    return (
      <Link href="/settings">
        <div
          className="mx-3 mb-3 rounded-xl px-3 py-2.5 flex items-center gap-2.5 cursor-pointer transition-opacity hover:opacity-80"
          style={{ background: "rgba(200,154,62,0.05)", border: "1px solid rgba(200,154,62,0.12)" }}
        >
          <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: "#C89A3E" }} strokeWidth={2.5} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-foreground leading-none truncate">Pro Subscription</p>
            <p className="text-[9px] font-medium mt-0.5" style={{ color: "#C89A3E" }}>Active</p>
          </div>
        </div>
      </Link>
    );
  }

  const href = trialComplete ? "/trial-review" : "/pricing";
  const label = trialComplete
    ? "Trial complete — see your review"
    : daysLeft === 0
    ? "Last day of trial"
    : `Day ${trialDay} of 7`;
  const sub = trialComplete
    ? "Week 2 plan ready"
    : daysLeft === 1
    ? "1 day left"
    : daysLeft > 1
    ? `${daysLeft} days left`
    : null;

  return (
    <Link href={href}>
      <div
        className="mx-3 mb-3 rounded-xl px-3 py-2.5 flex items-center gap-2.5 cursor-pointer transition-opacity hover:opacity-80"
        style={{
          background: "rgba(200,154,62,0.05)",
          border: "1px solid rgba(200,154,62,0.12)",
        }}
      >
        <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: "#C89A3E" }} strokeWidth={2.5} />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-foreground leading-none truncate">{label}</p>
          {sub && <p className="text-[9px] font-medium mt-0.5" style={{ color: "#C89A3E" }}>{sub}</p>}
        </div>
        {/* mini progress bar */}
        <div className="w-12 h-1.5 rounded-full bg-elevated shrink-0 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, (trialDay / 7) * 100)}%`,
              background: "#C89A3E",
            }}
          />
        </div>
      </div>
    </Link>
  );
}

function MobileTrialBadge() {
  const { trialDay, trialComplete, isPro, isLoading } = useTrialDay();

  if (isLoading) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-1 w-16 h-6 animate-pulse"
        style={{ background: "rgba(200,154,62,0.05)" }}
      />
    );
  }

  if (isPro) {
    return (
      <Link href="/settings">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold cursor-pointer"
          style={{ background: "rgba(200,154,62,0.08)", border: "1px solid rgba(200,154,62,0.15)", color: "#C89A3E" }}
        >
          <Zap className="w-3 h-3" strokeWidth={2.5} />
          Pro
        </span>
      </Link>
    );
  }

  const href = trialComplete ? "/trial-review" : "/pricing";
  const label = trialComplete ? "Review" : `Day ${trialDay}/7`;
  return (
    <Link href={href}>
      <span
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold cursor-pointer"
        style={{
          background: "rgba(200,154,62,0.08)",
          border: "1px solid rgba(200,154,62,0.15)",
          color: "#C89A3E",
        }}
      >
        <Zap className="w-3 h-3" strokeWidth={2.5} />
        {label}
      </span>
    </Link>
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
          background: "hsl(220 14% 6%)",
        }}
      >
        <div className="px-5 py-5 border-b" style={{ borderColor: "hsl(217 32% 13%)" }}>
          <div className="text-[17px] font-black tracking-tighter leading-none">
            Ascend<span style={{ color: "#C89A3E" }}>Fit</span>
          </div>
          <p className="text-[9px] font-medium text-muted-foreground mt-1">Your Daily Coach</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {ALL_NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "text-primary bg-elevated"
                    : "text-muted-foreground hover:text-foreground hover:bg-elevated"
                }`}
              >
                <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={isActive ? 2.4 : 2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <TrialPill />
        <div className="p-3 space-y-0.5 border-t" style={{ borderColor: "hsl(217 32% 13%)" }}>
          <Link
            href="/settings"
            className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              location === "/settings"
                ? "text-primary bg-elevated"
                : "text-muted-foreground hover:text-foreground hover:bg-elevated"
            }`}
          >
            <Settings className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
            Settings
          </Link>
          <Link
            href="/pricing"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors"
          >
            <CreditCard className="w-[18px] h-[18px] shrink-0" strokeWidth={2} />
            Pricing
          </Link>
        </div>
        <div className="px-5 py-3 border-t" style={{ borderColor: "hsl(217 32% 13%)" }}>
          <div className="flex items-center gap-3">
            <Link href="/terms" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              Terms
            </Link>
            <span className="text-[10px] text-muted-foreground/40">·</span>
            <Link href="/privacy" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              Privacy
            </Link>
          </div>
          <p className="text-[9px] text-muted-foreground/50 mt-1 leading-relaxed">
            Not medical advice. Results vary.
          </p>
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
          <div className="flex items-center">
            <span className="text-[15px] font-black tracking-tighter text-foreground leading-none">
              {pageTitle ? pageTitle : <><span>Ascend</span><span style={{ color: "#C89A3E" }}>Fit</span></>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MobileTrialBadge />
            <Link
              href="/settings"
              aria-label="Settings"
              className={`flex items-center justify-center w-9 h-9 rounded-full transition-all ${
                location === "/settings"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={location === "/settings" ? { background: "rgba(107,139,174,0.08)" } : {}}
            >
              <Settings className="w-[20px] h-[20px]" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {children}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav
        className="md:hidden shrink-0 backdrop-blur-xl"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          background: "hsl(220 14% 6%)",
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
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px]"
                    style={{ background: "#C89A3E" }}
                  />
                )}
                <item.icon
                  className={`w-[22px] h-[22px] transition-all ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span
                  className={`text-[10px] font-medium transition-colors leading-none ${
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

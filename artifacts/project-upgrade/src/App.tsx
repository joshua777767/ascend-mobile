import React, { useEffect, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import OnboardingPage from "@/pages/onboarding";
import SchedulePage from "@/pages/schedule";
import WorkoutsPage from "@/pages/workouts";
import MealsPage from "@/pages/meals";
import CoachPage from "@/pages/coach";
import JournalPage from "@/pages/journal";
import ProgressPage from "@/pages/progress";
import PricingPage from "@/pages/pricing";
import { Layout } from "@/components/layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

// ── Error Boundary ─────────────────────────────────────────────────────────────
interface EBState { hasError: boolean; message: string }

class AppErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, message: error?.message ?? "Unknown error" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[App Error Boundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "#0a0a0a",
            color: "#fafafa",
            fontFamily: "'Space Mono', monospace",
            gap: "16px",
          }}
        >
          <p style={{ fontSize: "11px", letterSpacing: "0.2em", color: "#F59E0B", textTransform: "uppercase" }}>
            Something went wrong
          </p>
          <p style={{ fontSize: "11px", color: "#666", textAlign: "center", maxWidth: "280px" }}>
            {this.state.message}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, message: "" }); window.location.href = "/"; }}
            style={{
              background: "#F59E0B",
              color: "#0a0a0a",
              border: "none",
              padding: "12px 28px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Router ────────────────────────────────────────────────────────────────────
function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/:rest*">
        <Layout>
          <Switch>
            <Route path="/dashboard" component={DashboardPage} />
            <Route path="/schedule" component={SchedulePage} />
            <Route path="/workouts" component={WorkoutsPage} />
            <Route path="/meals" component={MealsPage} />
            <Route path="/coach" component={CoachPage} />
            <Route path="/journal" component={JournalPage} />
            <Route path="/progress" component={ProgressPage} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/*
          TooltipProvider must live INSIDE WouterRouter so Radix portals
          share the same React dispatcher. Placing it outside causes the
          "Invalid hook call / useRef null" crash on first tooltip mount.
        */}
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <TooltipProvider>
            <AppRouter />
            <Toaster />
          </TooltipProvider>
        </WouterRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;

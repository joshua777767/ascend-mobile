import React, { useEffect, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
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

// ── Error Boundary ────────────────────────────────────────────────────────────
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
    console.error("[AppErrorBoundary]", error, info.componentStack);
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
            background: "#0B1220",
            color: "#F8FAFC",
            fontFamily: "'Inter', system-ui, sans-serif",
            gap: "14px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "16px",
              background: "rgba(59,130,246,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#3B82F6",
              fontSize: "24px",
              fontWeight: 800,
            }}
          >
            !
          </div>
          <p style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>
            Something went wrong
          </p>
          <p style={{ fontSize: "14px", color: "#94A3B8", maxWidth: "300px", lineHeight: 1.5, margin: 0 }}>
            {this.state.message}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, message: "" }); window.location.href = "/"; }}
            style={{
              marginTop: "8px",
              background: "#3B82F6",
              color: "#FFFFFF",
              border: "none",
              padding: "14px 32px",
              borderRadius: "16px",
              fontSize: "15px",
              fontWeight: 600,
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
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRouter />
          <Toaster />
        </WouterRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;

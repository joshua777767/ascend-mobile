import React, { useEffect, useRef, useState, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
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
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import SettingsPage from "@/pages/settings";
import { Layout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useGetUserProfile } from "@workspace/api-client-react";

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

// ── Guards ────────────────────────────────────────────────────────────────────
function FullScreenSpinner() {
  return (
    <div className="h-dvh bg-background flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
    </div>
  );
}

function FullScreenError({ message }: { message: string }) {
  return (
    <div className="h-dvh bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center text-primary text-2xl font-extrabold">
        !
      </div>
      <p className="text-lg font-bold tracking-tight">We couldn't reach the server</p>
      <p className="text-sm text-muted-foreground max-w-[300px] leading-relaxed">{message}</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 rounded-2xl bg-primary px-8 py-3.5 text-[15px] font-semibold text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}

// Returns true ONLY during the genuine first load. Once auth/profile has
// resolved once (or a timeout elapses) it latches to false, so background
// refetches that briefly flip `isLoading` can never re-block — and re-mount —
// the tree. This is what prevents the spinner-refetch loop, and the timeout
// guarantees the spinner can never spin forever.
function useFirstLoadSpinner(isLoading: boolean, timeoutMs = 8000): boolean {
  const settledRef = useRef(false);
  const [timedOut, setTimedOut] = useState(false);
  if (!isLoading) settledRef.current = true;
  useEffect(() => {
    if (settledRef.current) return;
    const t = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(t);
  }, [timeoutMs]);
  return isLoading && !settledRef.current && !timedOut;
}

// Authenticated app shell — requires a completed profile, else redirects to onboarding.
function ProtectedApp() {
  const { data: profile, isLoading, isError } = useGetUserProfile();
  if (useFirstLoadSpinner(isLoading)) return <FullScreenSpinner />;
  if (isError || !profile) return <Redirect to="/onboarding" />;
  return (
    <Layout>
      <Switch>
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/schedule" component={SchedulePage} />
        <Route path="/workouts" component={WorkoutsPage} />
        <Route path="/meals" component={MealsPage} />
        <Route path="/coach" component={CoachPage} />
        <Route path="/journal" component={JournalPage} />
        <Route path="/progress" component={ProgressPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

// Onboarding — requires auth; if a profile already exists, go to dashboard.
function OnboardingGuard() {
  const { data: profile, isLoading } = useGetUserProfile();
  if (useFirstLoadSpinner(isLoading)) return <FullScreenSpinner />;
  if (profile) return <Redirect to="/dashboard" />;
  return <OnboardingPage />;
}

// ── Router ────────────────────────────────────────────────────────────────────
function AppRouter() {
  const { isAuthed, isLoading, isServerError } = useAuth();
  const showSpinner = useFirstLoadSpinner(isLoading);
  if (isServerError) {
    return (
      <FullScreenError message="Ascend is having trouble connecting right now. Please check your connection and try again." />
    );
  }
  if (showSpinner) return <FullScreenSpinner />;
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login">{isAuthed ? <Redirect to="/dashboard" /> : <LoginPage />}</Route>
      <Route path="/signup">{isAuthed ? <Redirect to="/dashboard" /> : <SignupPage />}</Route>
      <Route path="/pricing" component={PricingPage} />
      <Route path="/onboarding">{isAuthed ? <OnboardingGuard /> : <Redirect to="/login" />}</Route>
      <Route path="/:rest*">{isAuthed ? <ProtectedApp /> : <Redirect to="/login" />}</Route>
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

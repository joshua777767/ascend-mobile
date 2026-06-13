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
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import SettingsPage from "@/pages/settings";
import PrivacyPolicyPage from "@/pages/privacy";
import TermsOfServicePage from "@/pages/terms";
import DeleteAccountPage from "@/pages/delete-account";
import DataExportPage from "@/pages/data-export";
import TrialReviewPage from "@/pages/trial-review";
import AdminPage from "@/pages/admin";
import IntroPage from "@/pages/intro";
import { Layout } from "@/components/layout";
import { WeeklyCheckInModal } from "@/components/WeeklyCheckInModal";
import { WeeklyReviewModal } from "@/components/WeeklyReviewModal";
import { useAuth } from "@/hooks/use-auth";
import { useGetUserProfile, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useTrialDay } from "@/hooks/use-trial";
import { initializeRevenueCat } from "@/lib/revenuecat";

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
  const { data: profile, isLoading, isError, error, isFetching } = useGetUserProfile();
  const status = (error as { status?: number } | null | undefined)?.status;

  const [showWeeklyCheckIn, setShowWeeklyCheckIn] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const { trialDay, isFreePro, trialExpired, hasAccess } = useTrialDay();

  // Check if weekly check-in is due after profile has loaded.
  // Fires on the normal 7-day cadence, OR on the last day of the free trial
  // so users always get a weigh-in before the trial ends.
  useEffect(() => {
    if (!profile) return;
    // Initialize trial start date on first authenticated load
    if (!localStorage.getItem("ascend.trialStartDate")) {
      localStorage.setItem("ascend.trialStartDate", new Date().toISOString());
    }
    const last = localStorage.getItem("ascend.lastWeeklyCheckIn");
    // Standard 7-day interval trigger
    const sevenDaysDue = !last || (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24) >= 7;
    // Last trial day override: force check-in on day 7 if they haven't done one today
    const checkedInToday = !!last && new Date(last).toDateString() === new Date().toDateString();
    const isLastTrialDay = !isFreePro && trialDay >= 7;
    const isDue = sevenDaysDue || (isLastTrialDay && !checkedInToday);
    if (!isDue) return;
    // Small delay so the app shell renders first before the modal appears
    const t = setTimeout(() => setShowWeeklyCheckIn(true), 1500);
    return () => clearTimeout(t);
  }, [profile, trialDay, isFreePro]);

  // Weekly review: show after 7 days, then every 7 days after. Not on trial day.
  useEffect(() => {
    if (!profile || isFreePro) return;
    const lastReview = localStorage.getItem("ascend.lastWeeklyReview");
    const reviewDue = !lastReview || (Date.now() - new Date(lastReview).getTime()) / (1000 * 60 * 60 * 24) >= 7;
    const reviewedToday = !!lastReview && new Date(lastReview).toDateString() === new Date().toDateString();
    if (reviewDue && !reviewedToday) {
      const t = setTimeout(() => setShowWeeklyReview(true), 2500);
      return () => clearTimeout(t);
    }
    return;
  }, [profile, isFreePro]);

  // Wait until we have a settled answer: either profile data, or a fetch that
  // has fully finished. While the initial load OR a refetch is in flight and we
  // don't yet have data, keep waiting — a stale cached error/404 (e.g. from a
  // prior signed-out state or a previous new-user attempt) must never decide
  // routing, or an existing user gets bounced to onboarding right after login.
  const undecided = !profile && (isLoading || isFetching);
  // The `useFirstLoadSpinner` timeout (8s) only guards against a pending query
  // that never settles. It must NOT let a stale cached 404 win a race against a
  // live refetch, so we additionally block any routing decision while a fetch
  // is actually in flight without data.
  if (useFirstLoadSpinner(undecided) || (isFetching && !profile)) return <FullScreenSpinner />;

  // Settled with a genuine "this user has no profile yet" → onboarding.
  if (!profile && status === 404) return <Redirect to="/onboarding" />;
  // Settled with a real error (5xx, network) — don't dump an existing user into
  // onboarding; show a retry screen instead.
  if (isError || !profile) {
    return (
      <FullScreenError message="We couldn't load your profile. Please check your connection and try again." />
    );
  }

  // Access lockout: trial expired and no active subscription → redirect to pricing
  const expired = trialExpired && !hasAccess;

  const userGoals = Array.isArray((profile as any).goals) ? (profile as any).goals as string[] : [];

  // Expired users can only access account-utility pages (GDPR-style).
  // All app feature pages — including settings — require active access.
  const FREE_ROUTES = ["/privacy", "/terms", "/delete-account", "/data-export"];
  const isFreeRoute = typeof window !== "undefined" && FREE_ROUTES.some((r) => window.location.pathname.includes(r));

  if (expired && !isFreeRoute) {
    return <Redirect to="/pricing?expired=1" />;
  }

  return (
    <>
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
          <Route path="/delete-account" component={DeleteAccountPage} />
          <Route path="/data-export" component={DataExportPage} />
          <Route path="/trial-review" component={TrialReviewPage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
      <WeeklyCheckInModal
        open={showWeeklyCheckIn}
        onClose={() => {
          localStorage.setItem("ascend.lastWeeklyCheckIn", new Date().toISOString());
          setShowWeeklyCheckIn(false);
        }}
        goals={userGoals}
      />
      <WeeklyReviewModal
        open={showWeeklyReview}
        onClose={() => {
          localStorage.setItem("ascend.lastWeeklyReview", new Date().toISOString());
          setShowWeeklyReview(false);
        }}
      />
    </>
  );
}

// Onboarding — requires auth; if a profile already exists, go to dashboard.
function OnboardingGuard() {
  const { data: profile, isLoading, isError, error, isFetching } = useGetUserProfile();
  const status = (error as { status?: number } | null | undefined)?.status;
  // Same rule as ProtectedApp: don't decide while a fetch is in flight and we
  // have no data yet, so an existing user landing on /onboarding is reliably
  // bounced to the dashboard instead of seeing onboarding flash.
  const undecided = !profile && (isLoading || isFetching);
  if (useFirstLoadSpinner(undecided) || (isFetching && !profile)) return <FullScreenSpinner />;
  if (profile) return <Redirect to="/dashboard" />;
  // A real error (5xx, network) — not a genuine "no profile yet" 404 — should
  // surface a retry screen rather than silently dropping into onboarding.
  if (isError && status !== 404) {
    return (
      <FullScreenError message="We couldn't load your profile. Please check your connection and try again." />
    );
  }
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
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/privacy" component={PrivacyPolicyPage} />
      <Route path="/terms" component={TermsOfServicePage} />
      <Route path="/intro">{isAuthed ? <IntroPage /> : <Redirect to="/login" />}</Route>
      <Route path="/onboarding">{isAuthed ? <OnboardingGuard /> : <Redirect to="/login" />}</Route>
      <Route path="/admin">{isAuthed ? <AdminPage /> : <Redirect to="/login" />}</Route>
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
        <RevenueCatInit />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRouter />
          <Toaster />
        </WouterRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

function RevenueCatInit() {
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false, refetchOnWindowFocus: false } });

  useEffect(() => {
    if (me?.id) {
      initializeRevenueCat(me.id).catch(() => {
        // RevenueCat is optional; if it fails, the app continues as web
      });
    }
  }, [me?.id]);

  return null;
}

export default App;

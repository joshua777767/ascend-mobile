import React, { useEffect, useRef, useState, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
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
import SupportPage from "@/pages/support";
import MarketingPage from "@/pages/marketing";
import DeleteAccountPage from "@/pages/delete-account";
import DataExportPage from "@/pages/data-export";
import TrialReviewPage from "@/pages/trial-review";
import AdminPage from "@/pages/admin";
import IntroPage from "@/pages/intro";
import AppStorePreviewPage from "@/pages/app-store-preview";
import { Layout } from "@/components/layout";
import { WeeklyCheckInModal } from "@/components/WeeklyCheckInModal";
import { WeeklyReviewModal } from "@/components/WeeklyReviewModal";
import { useAuth } from "@/hooks/use-auth";
import { useGetUserProfile, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useTrialDay } from "@/hooks/use-trial";
import { initializeRevenueCat, Purchases } from "@/lib/revenuecat";
import { isNative, sendToNative, onFromNative, _setNativeSub, useNativeSub } from "@/lib/native-bridge";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

// ── Native subscription state (module-level external store) ───────────────────
// NativeBridge and ProtectedApp are not in a direct parent-child relationship,
// so we share state via a module-level store instead of prop drilling or context.
// _setNativeSub and useNativeSub live in native-bridge.ts so any component
// (Layout, AuthenticatedGate, etc.) can subscribe to the same shared state.

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
              background: "rgba(107,139,174,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6B8BAE",
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
              background: "#6B8BAE",
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

// The entitlement identifier in RevenueCat — must match ENTITLEMENT_ID in SubscriptionContext.tsx.
// Used for the web (non-native) Capacitor RC path only; native uses the same key directly.
const RC_PRO_ENTITLEMENT = "Ascend: AI Fitness Pro";

// ── Locked paywall ────────────────────────────────────────────────────────────
// Rendered inline (not via redirect) when hasAccess === false.
// Replaces the entire app shell — no Layout, no nav, no child routes.
// Only actions allowed: Buy Pro, Restore Purchases, Log Out.
function LockedPaywall() {
  const [error, setError] = useState("");
  const [restoreLog, setRestoreLog] = useState<string | null>(null);
  const qc = useQueryClient();
  const { isPro: nativeIsPro, resolved: nativeSubResolved } = useNativeSub();

  // PURCHASE_CONFIRMED arrives after a successful purchase or restore.
  // The gate re-evaluates automatically because SUBSCRIPTION_STATUS{isPro:true}
  // was already posted by applyCustomerInfo() before PURCHASE_CONFIRMED.
  // No manual query invalidation needed — nativeIsPro drives the gate now.
  useEffect(() => {
    if (!isNative) return;
    // No-op listener: kept so pricing.tsx navigation on PURCHASE_CONFIRMED still works.
    return onFromNative("PURCHASE_CONFIRMED", () => {});
  }, [qc]);

  useEffect(() => {
    if (!isNative) return;
    return onFromNative("RESTORE_FAILED", (payload) => {
      const p = payload as { message?: string } | null;
      setError(p?.message ?? "Restore failed. Please try again.");
    });
  }, []);

  useEffect(() => {
    if (!isNative) return;
    return onFromNative("PAYWALL_ERROR", (payload) => {
      const p = payload as { message?: string } | null;
      setError(p?.message ?? "Subscription unavailable. Please check your connection and try again.");
    });
  }, []);

  async function handleLogout() {
    try {
      await fetch(`${import.meta.env.BASE_URL}api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.replace("/login");
    }
  }

  function handleBuyPro() {
    setError("");
    if (isNative) {
      sendToNative("REQUEST_PURCHASE");
    } else {
      window.location.href = "/pricing";
    }
  }

  function handleRestore() {
    setError("");
    setRestoreLog("Restoring…");
    const unsub = onFromNative("RESTORE_RESULT", (payload) => {
      const p = payload as { isPro?: boolean; entitlements?: string[] } | null;
      setRestoreLog(`isPro: ${p?.isPro} | entitlements: [${(p?.entitlements ?? []).join(", ")}]`);
      unsub();
    });
    sendToNative("REQUEST_RESTORE");
  }

  return (
    <div
      style={{
        height: "100dvh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        background: "hsl(222 47% 5%)",
        color: "#F8FAFC",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        paddingTop: "calc(24px + env(safe-area-inset-top))",
        paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
        fontFamily: "'Space Mono', 'Inter', system-ui, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", maxWidth: "380px", display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Icon */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", textAlign: "center" }}>
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "20px",
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "32px",
            }}
          >
            🔒
          </div>
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#F59E0B", margin: "0 0 8px" }}>
              Trial Complete
            </p>
            <h1 style={{ fontSize: "26px", fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 10px", lineHeight: 1.2 }}>
              Your 7-day trial has ended.
            </h1>
            <p style={{ fontSize: "14px", color: "#94A3B8", lineHeight: 1.6, margin: 0 }}>
              Subscribe to Ascend Pro to keep your plan, meals, workouts, and AI coach going.
            </p>
          </div>
        </div>

        {/* Features recap */}
        <div
          style={{
            background: "hsl(220 47% 8%)",
            border: "1px solid hsl(217 32% 14%)",
            borderRadius: "16px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {[
            "Personalized daily schedule",
            "AI meal feedback & coach chat",
            "Custom workout plan",
            "Nightly review & weekly adjustments",
            "Progress tracking & streaks",
          ].map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
              <span style={{ color: "#F59E0B", fontSize: "10px" }}>✦</span>
              <span style={{ color: "#CBD5E1" }}>{f}</span>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.10)",
              border: "1px solid rgba(239,68,68,0.30)",
              borderRadius: "12px",
              padding: "12px 14px",
              fontSize: "13px",
              color: "#FCA5A5",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={handleBuyPro}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "14px",
              background: "hsl(210 40% 55%)",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: 800,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              letterSpacing: "-0.01em",
            }}
          >
            Continue with Ascend Pro — $19.99/month
          </button>

          {isNative && (
            <button
              onClick={handleRestore}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: "14px",
                background: "transparent",
                color: "#94A3B8",
                fontSize: "13px",
                fontWeight: 600,
                border: "1px solid hsl(217 32% 18%)",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Restore Purchases
            </button>
          )}

          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: "14px",
              background: "transparent",
              color: "#64748B",
              fontSize: "13px",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
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

// Authenticated app shell — profile guard + layout only. Access is gated above
// this component (in AuthenticatedGate) so this never mounts for expired users.
function ProtectedApp() {
  const { data: profile, isLoading, isError, error, isFetching } = useGetUserProfile();
  const status = (error as { status?: number } | null | undefined)?.status;

  const [showWeeklyCheckIn, setShowWeeklyCheckIn] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  // trialDay + isPro used only for weekly check-in modal logic — not for gate decisions.
  const { trialDay, isPro } = useTrialDay();
  const { isPro: nativeIsPro } = useNativeSub();
  const nativeProConfirmed = isNative && nativeIsPro;

  // Check if weekly check-in is due after profile has loaded.
  // Fires on the normal 7-day cadence, OR on the last day of the free trial
  // so users always get a weigh-in before the trial ends.
  useEffect(() => {
    if (!profile) return;
    if (!localStorage.getItem("ascend.trialStartDate")) {
      localStorage.setItem("ascend.trialStartDate", new Date().toISOString());
    }
    const last = localStorage.getItem("ascend.lastWeeklyCheckIn");
    const sevenDaysDue = !last || (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24) >= 7;
    const checkedInToday = !!last && new Date(last).toDateString() === new Date().toDateString();
    const isLastTrialDay = !isPro && !nativeProConfirmed && trialDay >= 7;
    const isDue = !checkedInToday && (sevenDaysDue || isLastTrialDay);
    if (!isDue) return;
    const t = setTimeout(() => setShowWeeklyCheckIn(true), 1500);
    return () => clearTimeout(t);
  }, [profile, trialDay, isPro, nativeProConfirmed]);

  // Weekly review: show after 7 days, then every 7 days after.
  useEffect(() => {
    if (!profile || isPro) return;
    const lastReview = localStorage.getItem("ascend.lastWeeklyReview");
    const reviewDue = !lastReview || (Date.now() - new Date(lastReview).getTime()) / (1000 * 60 * 60 * 24) >= 7;
    const reviewedToday = !!lastReview && new Date(lastReview).toDateString() === new Date().toDateString();
    if (reviewDue && !reviewedToday) {
      const t = setTimeout(() => setShowWeeklyReview(true), 2500);
      return () => clearTimeout(t);
    }
    return;
  }, [profile, isPro]);

  const undecided = !profile && (isLoading || isFetching);
  if (useFirstLoadSpinner(undecided) || (isFetching && !profile)) return <FullScreenSpinner />;

  if (!profile && status === 404) return <Redirect to="/onboarding" />;
  if (isError || !profile) {
    return (
      <FullScreenError message="We couldn't load your profile. Please check your connection and try again." />
    );
  }

  const userGoals = Array.isArray((profile as any).goals) ? (profile as any).goals as string[] : [];

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
        isProUser={isPro || nativeProConfirmed}
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

// Routes shown to unauthenticated visitors. All other paths redirect to /login.
function PublicOnlyRoutes() {
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
      <Route path="/support" component={SupportPage} />
      <Route path="/marketing" component={MarketingPage} />
      <Route path="/app-store-preview" component={AppStorePreviewPage} />
      <Route component={() => <Redirect to="/login" />} />
    </Switch>
  );
}

// Full route switch for authenticated + access-confirmed users.
// The isAuthed checks are removed — AuthenticatedGate already guarantees auth.
function AuthedRouteSwitch() {
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
      <Route path="/support" component={SupportPage} />
      <Route path="/marketing" component={MarketingPage} />
      <Route path="/app-store-preview" component={AppStorePreviewPage} />
      <Route path="/intro" component={IntroPage} />
      <Route path="/onboarding"><OnboardingGuard /></Route>
      <Route path="/admin" component={AdminPage} />
      <Route path="/:rest*"><ProtectedApp /></Route>
    </Switch>
  );
}

// Access gate — sits above the entire route tree for authenticated users.
// LockedPaywall is the ONLY thing that renders when hasAccess is false.
// No Layout, no nav, no Switch, no modals — nothing else mounts.
//
// Three sources decide access:
//   1. me.trialEndDate from the server — trial is still running
//   2. Fresh RevenueCat CustomerInfo — "pro" entitlement is active (persistent,
//      survives force-close/reopen)
//   3. nativeProConfirmed — SUBSCRIPTION_STATUS { isPro:true } arrived this session
//      via the native bridge (fast-path: unlocks immediately after purchase without
//      waiting for the RC query to refetch)
//
// Explicitly excluded:
//   - backendIsFreePro (me.isFreePro) — DB flag can outlive the real RC entitlement
//   - localStorage / sessionStorage
//
// nativeProConfirmed is safe because _nativeIsPro is module-level (resets to false
// on every page load / logout) — it cannot carry over from a previous session.
function AuthenticatedGate() {
  const { data: me, isLoading: meLoading } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false, refetchOnWindowFocus: false },
  });

  // Subscription state from the native bridge (module-level, survives re-renders).
  // isPro  → native RC confirms an active Pro entitlement.
  // resolved → at least one SUBSCRIPTION_STATUS has been received from native
  //            (set by _setNativeSub in NativeBridge's SUBSCRIPTION_STATUS handler).
  const { isPro: nativeIsPro, resolved: nativeSubResolved } = useNativeSub();

  // Non-native (browser/dev) path: Capacitor RC query.
  // In the native WKWebView, Capacitor is not available so this always returns
  // null — it is disabled with enabled:!isNative to avoid the useless network round-trip.
  const { data: rcInfo, isLoading: rcLoading } = useQuery({
    queryKey: ["revenuecat", "access-gate", me?.id ?? 0],
    queryFn: async () => {
      try {
        const { customerInfo } = await Purchases.getCustomerInfo();
        return customerInfo;
      } catch {
        return null;
      }
    },
    enabled: !isNative && !!me?.id,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: true,
  });

  // ── Spinner conditions ────────────────────────────────────────────────────
  // Always wait for /auth/me first.
  if (meLoading) return <FullScreenSpinner />;

  if (isNative) {
    // In native: spin until native RC resolves and posts SUBSCRIPTION_STATUS.
    // NativeBridge sends REQUEST_SUBSCRIPTION_STATUS after registering its
    // listener, so this always resolves — never spins forever.
    if (me?.id && !nativeSubResolved) return <FullScreenSpinner />;
  } else {
    // In browser: spin until Capacitor RC query completes.
    if (me?.id && rcLoading) return <FullScreenSpinner />;
  }

  // ── Access decision ───────────────────────────────────────────────────────
  const trialEndDate = me?.trialEndDate ? new Date(me.trialEndDate) : null;
  const isTrialActive = trialEndDate ? Date.now() < trialEndDate.getTime() : false;

  let hasAccess: boolean;
  if (isNative) {
    // Native: the ONLY valid Pro signals are trial and nativeIsPro (from RC via bridge).
    hasAccess = isTrialActive || nativeIsPro;
  } else {
    // Browser: use Capacitor RC entitlement query.
    const hasActiveProEntitlement =
      rcInfo?.entitlements?.active?.[RC_PRO_ENTITLEMENT] != null;
    hasAccess = isTrialActive || hasActiveProEntitlement;
  }

  // DEV: log every evaluation so runtime values are visible in the browser console.
  if (import.meta.env.DEV) {
    console.debug("[AuthenticatedGate]", {
      trialEndsAt: me?.trialEndDate ?? null,
      isTrialActive,
      isNative,
      nativeIsPro,
      nativeSubResolved,
      rcAppUserId: rcInfo?.originalAppUserId ?? null,
      activeEntitlements: rcInfo ? Object.keys(rcInfo.entitlements.active) : [],
      hasAccess,
    });
  }

  if (!hasAccess) return <LockedPaywall />;

  return <AuthedRouteSwitch />;
}

// Root gate: resolves auth, then delegates to public routes or the access gate.
function AppRouter() {
  const { isAuthed, isLoading, isServerError } = useAuth();
  const showSpinner = useFirstLoadSpinner(isLoading);
  if (isServerError) {
    return (
      <FullScreenError message="Ascend is having trouble connecting right now. Please check your connection and try again." />
    );
  }
  if (showSpinner) return <FullScreenSpinner />;

  // Unauthenticated: only public pages, everything else → /login
  if (!isAuthed) return <PublicOnlyRoutes />;

  // Authenticated: check access BEFORE any route, Layout, or nav can mount
  return <AuthenticatedGate />;
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <NativeBridge />
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
    if (isNative) return; // native RC handles this; skip web init to avoid conflicts
    if (me?.id) {
      initializeRevenueCat(me.id).catch(() => {});
    }
  }, [me?.id]);

  return null;
}

/**
 * Bridges the web app's auth/subscription state to the native iOS shell.
 * Only active when running inside the Ascend native WebView (isNative=true).
 */
function NativeBridge() {
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false, refetchOnWindowFocus: false } });

  // Notify native of the logged-in user ID so RevenueCat can identify them.
  useEffect(() => {
    if (!isNative) return;
    if (me?.id) {
      sendToNative("AUTH_STATE", { userId: String(me.id) });
    }
  }, [me?.id]);

  // Listen for subscription status from native.
  // Native broadcasts this on launch (after RC resolves) and on app resume.
  // We update the module-level store so AuthenticatedGate can gate access correctly.
  //
  // After registering the listener, we immediately send REQUEST_SUBSCRIPTION_STATUS
  // to native. This handles the timing race where native already broadcast
  // SUBSCRIPTION_STATUS before this useEffect ran — native responds with the
  // current isPro state, which the listener below receives.
  //
  // IMPORTANT: Do NOT navigate here. SUBSCRIPTION_STATUS fires on launch for
  // any user RC already knows is Pro. Navigation after a real purchase or restore
  // is handled by PURCHASE_CONFIRMED (only posted by native after purchase/restore).
  useEffect(() => {
    if (!isNative) return;
    const unsub = onFromNative("SUBSCRIPTION_STATUS", (payload) => {
      const p = payload as { isPro?: boolean; appUserId?: string; activeEntitlementKeys?: string[]; build?: string } | null;
      const isPro = !!p?.isPro;
      // Update module-level store — triggers useNativeSub() re-renders
      // in AuthenticatedGate and MobileTrialBadge.
      _setNativeSub(isPro, {
        appUserId: p?.appUserId,
        activeEntitlementKeys: p?.activeEntitlementKeys,
        build: p?.build,
      });
    });
    // Request current state now that the listener is registered.
    // If native already resolved RC, it responds immediately.
    // If RC is still loading, it will broadcast when ready via its own effect.
    sendToNative("REQUEST_SUBSCRIPTION_STATUS", {});
    return unsub;
  }, []);

  return null;
}

export default App;

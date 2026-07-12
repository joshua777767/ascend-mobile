import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
} from "react-native-purchases";
import { Platform, AppState } from "react-native";
import { postToWebFromNative } from "./webview-bridge";

// The entitlement identifier configured in RevenueCat dashboard.
// Must match exactly — RC uses the identifier (not the display name) as the
// key in customerInfo.entitlements.active.
export const ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? "Ascend: AI Fitness Pro";

function getApiKey(): string {
  if (Platform.OS === "ios") {
    return (
      process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ??
      process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ??
      ""
    );
  }
  if (Platform.OS === "android") {
    return (
      process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ??
      process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ??
      ""
    );
  }
  return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY ?? "";
}

function diagnoseOfferings(offerings: PurchasesOfferings): {
  packages: PurchasesPackage[];
  diagnostic: string | null;
} {
  const allKeys = Object.keys(offerings.all ?? {});
  console.log("[RC:diagnose] offerings.all keys:", allKeys.length === 0 ? "(none)" : allKeys.join(", "));
  console.log("[RC:diagnose] offerings.current:", offerings.current ? `"${offerings.current.identifier}"` : "null");

  if (allKeys.length === 0) {
    const msg =
      "RC returned zero offerings.\n" +
      "1) Wrong API key  2) Bundle ID mismatch  3) No offerings in RC dashboard";
    console.error("[RC:diagnose]", msg);
    return { packages: [], diagnostic: msg };
  }
  if (!offerings.current) {
    const msg =
      `RC has offerings [${allKeys.join(", ")}] but none is marked "Current".\n` +
      'Fix: RC dashboard → Offerings → select one → "Make Current".';
    console.error("[RC:diagnose]", msg);
    return { packages: [], diagnostic: msg };
  }
  const pkgs = offerings.current.availablePackages ?? [];
  console.log(
    `[RC:diagnose] current offering "${offerings.current.identifier}" has ${pkgs.length} package(s):`,
    pkgs.length === 0
      ? "(none)"
      : pkgs.map((p) => `${p.identifier} → ${(p.product as any).identifier ?? (p.product as any).productIdentifier ?? "?"}`).join(", ")
  );
  if (pkgs.length === 0) {
    const msg =
      `Offering "${offerings.current.identifier}" has no packages.\n` +
      "1) Product not attached in RC dashboard  2) Product ID mismatch  " +
      "3) Product not approved in ASC  4) Paid Applications Agreement unsigned";
    console.error("[RC:diagnose]", msg);
    return { packages: [], diagnostic: msg };
  }
  return { packages: pkgs, diagnostic: null };
}

type SubscriptionContextValue = {
  isPro: boolean;
  isLoading: boolean;
  /** True once the first CustomerInfo has been applied after startup logIn. */
  subscriptionResolved: boolean;
  appUserId: string | null;
  customerInfo: CustomerInfo | null;
  packages: PurchasesPackage[];
  offeringsError: string | null;
  offeringsDiagnostic: string | null;
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId?: string | null;
}) {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionResolved, setSubscriptionResolved] = useState(false);
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [offeringsDiagnostic, setOfferingsDiagnostic] = useState<string | null>(null);

  const configured = useRef(false);
  // Ref so applyCustomerInfo can include the current appUserId in the broadcast
  // without being invalidated by every render.
  const appUserIdRef = useRef<string | null>(null);

  const isPro = customerInfo?.entitlements.active[ENTITLEMENT_ID]?.isActive === true;

  // ── applyCustomerInfo ─────────────────────────────────────────────────────
  // THE single source of truth for all CustomerInfo state changes.
  // Checks the RC entitlement directly from fresh or SDK-cached CustomerInfo,
  // updates React state, and posts the result to the WebView.
  const applyCustomerInfo = useCallback((info: CustomerInfo): boolean => {
    const active = info.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
    setCustomerInfo(info);
    setSubscriptionResolved(true);

    const payload = { isPro: active, appUserId: appUserIdRef.current };
    postToWebFromNative("SUBSCRIPTION_STATUS", payload);

    console.log(
      "[RC:apply] entitlement:", ENTITLEMENT_ID,
      "| isPro:", active,
      "| active entitlements:", Object.keys(info.entitlements.active),
      "| appUserId:", appUserIdRef.current
    );
    return active;
  }, []);

  // ── CustomerInfo update listener ──────────────────────────────────────────
  // Fires when Apple/RC server pushes a new subscription state (renewal,
  // refund, expiry, etc.). Calls applyCustomerInfo immediately so the gate
  // re-evaluates with the latest state.
  useEffect(() => {
    const listener = (info: CustomerInfo) => {
      console.log(
        "[RC:listener] CustomerInfo pushed — active entitlements:",
        Object.keys(info.entitlements.active)
      );
      applyCustomerInfo(info);
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [applyCustomerInfo]);

  // ── Startup: configure → invalidate → logIn → getCustomerInfo ───────────
  // Runs whenever userId changes (login / logout / account switch).
  //
  // ORDER:
  // 1. Configure RC SDK (once per process).
  // 2. Invalidate RC's local SDK cache — forces the next call to hit the network
  //    rather than returning stale in-process data.
  // 3. logIn(userId) — identifies this user in RC; result used as the initial check.
  // 4. getCustomerInfo() + getOfferings() — authoritative entitlement check + packages.
  //
  // restorePurchases() is NOT called automatically — only when the user taps Restore.
  // On RC failure the web gate keeps its loading spinner; a native Retry button appears.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setOfferingsError(null);
      setOfferingsDiagnostic(null);

      // Step 1: Configure the SDK exactly once per process lifetime.
      if (!configured.current) {
        const apiKey = getApiKey();
        if (!apiKey) {
          const msg = "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY is not set. IAP will not work.";
          console.error("[RC:configure] ERROR:", msg);
          if (!cancelled) {
            setOfferingsError("Subscription configuration error. Please restart the app.");
            setOfferingsDiagnostic(msg);
            setIsLoading(false);
          }
          return;
        }
        try { Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO); } catch {}
        try {
          Purchases.configure({ apiKey });
          configured.current = true;
          console.log("[RC:configure] OK — key prefix:", apiKey.slice(0, 10), "| entitlement:", ENTITLEMENT_ID);
        } catch (e) {
          const msg = `configure() threw: ${String(e)}`;
          console.error("[RC:configure]", msg);
          if (!cancelled) {
            setOfferingsError("Subscription service unavailable. Please restart the app.");
            setOfferingsDiagnostic(msg);
            setIsLoading(false);
          }
          return;
        }
      }

      // Wait for userId — keep spinner, don't resolve until the user is known.
      if (!userId) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      // Step 2: Invalidate RC SDK's local cache so the next call hits the network.
      try {
        await Purchases.invalidateCustomerInfoCache();
        console.log("[RC:startup] SDK cache invalidated");
      } catch (e) {
        console.warn("[RC:startup] invalidateCustomerInfoCache failed (non-fatal):", e);
      }
      if (cancelled) return;

      // Step 3: logIn() — identifies this Ascend user in RC.
      // Returns CustomerInfo as a side-effect; we apply it as the initial check.
      try {
        const { customerInfo: loginInfo } = await Purchases.logIn(String(userId));
        if (cancelled) return;
        const postLoginId = await Purchases.getAppUserID().catch(() => String(userId));
        appUserIdRef.current = postLoginId;
        if (!cancelled) setAppUserId(postLoginId);
        console.log("[RC:logIn] RC App User ID:", postLoginId, "| entitlements:", Object.keys(loginInfo.entitlements.active));
        if (!cancelled) applyCustomerInfo(loginInfo);
      } catch (e) {
        console.error("[RC:logIn] failed (non-fatal):", e);
      }
      if (cancelled) return;

      // Step 4: getCustomerInfo() — authoritative entitlement state from RC.
      try {
        console.log("[RC:fetch] getCustomerInfo + getOfferings …");
        const [info, offerings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);
        if (cancelled) return;

        applyCustomerInfo(info);

        const { packages: pkgs, diagnostic } = diagnoseOfferings(offerings);
        setPackages(pkgs);
        if (pkgs.length === 0) {
          setOfferingsError("No subscription package found. Tap to retry.");
          setOfferingsDiagnostic(diagnostic);
        } else {
          setOfferingsError(null);
          setOfferingsDiagnostic(null);
        }
      } catch (e: any) {
        const msg = `getCustomerInfo/getOfferings threw: ${e?.message ?? String(e)} (code ${e?.code ?? "?"})`;
        console.error("[RC:fetch] ERROR:", msg);
        if (!cancelled) {
          setOfferingsError("Could not verify subscription. Check connection and retry.");
          setOfferingsDiagnostic(msg);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, applyCustomerInfo]);

  // ── App foreground refresh ────────────────────────────────────────────────
  // Called whenever the app returns to the foreground (AppState "active").
  // Invalidates the RC SDK cache and calls getCustomerInfo() for a fresh read.
  // restorePurchases() is never called here — only on explicit user action.
  const refresh = useCallback(async () => {
    try {
      console.log("[RC:refresh] app foregrounded — fetching fresh CustomerInfo …");

      try {
        await Purchases.invalidateCustomerInfoCache();
        console.log("[RC:refresh] SDK cache invalidated");
      } catch (e) {
        console.warn("[RC:refresh] invalidateCustomerInfoCache failed (non-fatal):", e);
      }

      const info = await Purchases.getCustomerInfo();
      applyCustomerInfo(info);
      console.log("[RC:refresh] done — isPro:", info.entitlements.active[ENTITLEMENT_ID]?.isActive === true);
    } catch (e) {
      console.error("[RC:refresh] failed:", e);
    }
  }, [applyCustomerInfo]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // ── Restore ───────────────────────────────────────────────────────────────
  // Called only when the user explicitly taps "Restore Purchases".
  // The user is already identified via logIn() at startup, so we go straight
  // to restorePurchases() — no automatic logIn() here.
  const restore = useCallback(async (): Promise<boolean> => {
    console.log("[RC:restore] user-initiated restore …");
    try {
      const restoredInfo = await Purchases.restorePurchases();
      const active = applyCustomerInfo(restoredInfo);
      console.log(
        "[RC:restore] done — isPro:", active,
        "| active entitlements:", Object.keys(restoredInfo.entitlements.active)
      );
      if (active) {
        postToWebFromNative("PURCHASE_CONFIRMED", { isPro: true });
      }
      return active;
    } catch (e: any) {
      console.error("[RC:restore] failed:", e?.message ?? e);
      return false;
    }
  }, [applyCustomerInfo]);

  // ── Purchase ──────────────────────────────────────────────────────────────
  const purchase = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      const productId =
        (pkg.product as any).identifier ??
        (pkg.product as any).productIdentifier ??
        pkg.identifier;
      console.log("[RC:purchase] starting for:", productId);

      // Re-identify before purchasing so the receipt attaches to the current
      // Ascend user, not an anonymous RC ID.
      if (userId) {
        try {
          const { customerInfo: loginInfo } = await Purchases.logIn(String(userId));
          console.log(
            "[RC:purchase] logIn OK | active entitlements:",
            Object.keys(loginInfo.entitlements.active)
          );
        } catch (e: any) {
          console.error("[RC:purchase] logIn failed (non-fatal):", e?.message ?? e);
        }
      }

      try {
        const purchaseResult = await Purchases.purchasePackage(pkg);
        const info = purchaseResult?.customerInfo ?? null;

        if (info) {
          console.log(
            "[RC:purchase] purchasePackage returned | active entitlements:",
            Object.keys(info.entitlements.active)
          );
          const active = applyCustomerInfo(info);
          if (active) {
            postToWebFromNative("PURCHASE_CONFIRMED", { isPro: true });
            console.log("[RC:purchase] entitlement active immediately — app unlocked");
            return true;
          }
        }

        // Sandbox/TestFlight entitlements can take 1–3 s to propagate.
        // Poll getCustomerInfo() up to 5 times before giving up.
        for (let attempt = 0; attempt < 5; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
          const polledInfo = await Purchases.getCustomerInfo();
          const active = polledInfo.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
          console.log(
            "[RC:purchase] poll attempt", attempt + 1, "— isPro:", active,
            "| active entitlements:", Object.keys(polledInfo.entitlements.active)
          );
          if (active) {
            applyCustomerInfo(polledInfo);
            postToWebFromNative("PURCHASE_CONFIRMED", { isPro: true });
            return true;
          }
        }

        console.log("[RC:purchase] entitlement not active after retries");
        return false;
      } catch (e: any) {
        if (e?.userCancelled) {
          // Apple's "You're already subscribed" sheet dismisses with userCancelled=true.
          // Always attempt a restore first — if Pro is found, unlock immediately.
          // Only fall back to PURCHASE_CANCELLED if the restore confirms no active sub.
          console.log("[RC:purchase] userCancelled=true — restoring to check if already subscribed …");
          const alreadyPro = await restore();
          if (!alreadyPro) {
            console.log("[RC:purchase] restore confirmed no active subscription — posting PURCHASE_CANCELLED");
            postToWebFromNative("PURCHASE_CANCELLED", {});
          }
          return alreadyPro;
        }
        const code = e?.code ?? e?.errorCode ?? "";
        const msg = e?.message ?? "";
        // Already owned — auto-restore so the user isn't left stuck.
        if (
          code === "6" ||
          code === "PRODUCT_ALREADY_OWNED" ||
          msg.includes("already own") ||
          msg.includes("already purchased")
        ) {
          console.log("[RC:purchase] already owned — auto-restoring …");
          return await restore();
        }
        console.error("[RC:purchase] failed:", e?.message ?? e);
        throw e;
      }
    },
    [userId, restore, applyCustomerInfo]
  );

  return (
    <SubscriptionContext.Provider
      value={{
        isPro,
        isLoading,
        subscriptionResolved,
        appUserId,
        customerInfo,
        packages,
        offeringsError,
        offeringsDiagnostic,
        purchase,
        restore,
        refresh,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx)
    throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}

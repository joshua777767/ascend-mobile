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
// Hardcoded — do NOT use an env var here. EXPO_PUBLIC_ env vars in Replit
// get baked into OTA bundles and the Replit secret "EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID"
// is set to "pro" which does NOT match the actual RC key. The RC dashboard uses
// the display name as the key in customerInfo.entitlements.active.
export const ENTITLEMENT_ID = "Ascend: AI Fitness Pro";

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

  if (allKeys.length === 0) {
    const msg =
      "RC returned zero offerings.\n" +
      "1) Wrong API key  2) Bundle ID mismatch  3) No offerings in RC dashboard";
    return { packages: [], diagnostic: msg };
  }
  if (!offerings.current) {
    const msg =
      `RC has offerings [${allKeys.join(", ")}] but none is marked "Current".\n` +
      'Fix: RC dashboard → Offerings → select one → "Make Current".';
    return { packages: [], diagnostic: msg };
  }
  const pkgs = offerings.current.availablePackages ?? [];
  if (pkgs.length === 0) {
    const msg =
      `Offering "${offerings.current.identifier}" has no packages.\n` +
      "1) Product not attached in RC dashboard  2) Product ID mismatch  " +
      "3) Product not approved in ASC  4) Paid Applications Agreement unsigned";
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
  // Ref so refresh() can read current isPro without stale closure.
  const isProRef = useRef(false);
  isProRef.current = isPro;

  // ── applyCustomerInfo ─────────────────────────────────────────────────────
  // THE single source of truth for all CustomerInfo state changes.
  // Checks the RC entitlement directly from fresh or SDK-cached CustomerInfo,
  // updates React state, and posts the result to the WebView.
  const applyCustomerInfo = useCallback((info: CustomerInfo): boolean => {
    const active = info.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
    setCustomerInfo(info);
    setSubscriptionResolved(true);

    const activeKeys = Object.keys(info.entitlements.active);
    const payload = {
      isPro: active,
      appUserId: appUserIdRef.current,
      activeEntitlementKeys: activeKeys,
      build: "d6c0e75a",
    };
    postToWebFromNative("SUBSCRIPTION_STATUS", payload);
    return active;
  }, []);

  // ── CustomerInfo update listener ──────────────────────────────────────────
  // Fires when Apple/RC server pushes a new subscription state (renewal,
  // refund, expiry, etc.). Calls applyCustomerInfo immediately so the gate
  // re-evaluates with the latest state.
  useEffect(() => {
    const listener = (info: CustomerInfo) => {
      applyCustomerInfo(info);
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [applyCustomerInfo]);

  // ── Startup: configure → logIn → getCustomerInfo ─────────────────────────
  // Strictly sequential. SUBSCRIPTION_STATUS is sent to the WebView exactly
  // ONCE — at the very end, after all RC calls have settled. It is never sent
  // with a default/guessed value while userId or RC status is still unresolved.
  //
  // Order:
  //   1. Configure RC SDK (once per process).
  //   2. Wait for Ascend userId from the WebView AUTH_STATE message.
  //   3. logIn(userId) only if RC is anonymous or a different user.
  //   4. getCustomerInfo() — authoritative entitlement check.
  //   5. syncPurchasesForResult() if not-Pro, as fallback receipt sync.
  //   6. applyCustomerInfo() — post SUBSCRIPTION_STATUS exactly once.
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
        } catch (e) {
          const msg = `configure() threw: ${String(e)}`;
          if (!cancelled) {
            setOfferingsError("Subscription service unavailable. Please restart the app.");
            setOfferingsDiagnostic(msg);
            setIsLoading(false);
          }
          return;
        }
      }

      // Step 2: Wait for Ascend userId from WebView AUTH_STATE.
      // Keep spinner. Never send SUBSCRIPTION_STATUS with a default while waiting.
      if (!userId) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      // NOTE: invalidateCustomerInfoCache() intentionally NOT called here.
      // The RC SDK cache holds the correct merged subscription data (anonymous →
      // userId merge). Invalidating forces a raw server fetch for userId which
      // does not see the subscription (it lives under the original anonymous ID
      // server-side). RC manages cache expiry automatically. Let it use the cache.

      // Step 3: logIn(userId) only when the SDK doesn't already know this user.
      //
      // WHY: logIn() always makes a server round-trip. The server returns CustomerInfo
      // for the numerical userId, which may not include the subscription (it lives
      // under the original anonymous RC ID). That server response then overwrites
      // the SDK's local cache — which DID have the correct merged data — causing
      // every subsequent getCustomerInfo() to return not-Pro.
      //
      // If the SDK is already identified as this Ascend userId, we skip logIn()
      // entirely and go straight to getCustomerInfo(), which uses the cached
      // (correct) data. logIn() is only needed on first launch (anonymous → userId
      // migration) or if a different user somehow became active.
      let rcAppUserId = String(userId);
      try {
        const currentRcId = await Purchases.getAppUserID();
        rcAppUserId = currentRcId;
        appUserIdRef.current = currentRcId;
        if (!cancelled) setAppUserId(currentRcId);
        const isAnonymous = currentRcId.startsWith("$RCAnonymousID:");
        const isWrongUser = !isAnonymous && currentRcId !== String(userId);

        if (isAnonymous || isWrongUser) {
          const { customerInfo: loginInfo } = await Purchases.logIn(String(userId));
          if (cancelled) return;
          rcAppUserId = await Purchases.getAppUserID().catch(() => String(userId));
          appUserIdRef.current = rcAppUserId;
          if (!cancelled) setAppUserId(rcAppUserId);
          void loginInfo; // result used only for side-effect (SDK cache update)
        }
      } catch {
        // non-fatal: continue to getCustomerInfo()
      }
      if (cancelled) return;

      // Step 4: getCustomerInfo() — authoritative entitlement state from RC backend.
      // getOfferings() fetched in parallel for the paywall UI.
      let finalInfo: import("react-native-purchases").CustomerInfo | null = null;
      try {
        const [info, offerings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);
        if (cancelled) return;

        finalInfo = info;

        const { packages: pkgs, diagnostic } = diagnoseOfferings(offerings);
        if (!cancelled) {
          setPackages(pkgs);
          if (pkgs.length === 0) {
            setOfferingsError("No subscription package found. Tap to retry.");
            setOfferingsDiagnostic(diagnostic);
          } else {
            setOfferingsError(null);
            setOfferingsDiagnostic(null);
          }
        }
      } catch (e: any) {
        const msg = `getCustomerInfo() threw: ${e?.message ?? String(e)} (code ${e?.code ?? "?"})`;
        if (!cancelled) {
          setOfferingsError("Could not verify subscription. Check connection and retry.");
          setOfferingsDiagnostic(msg);
          setIsLoading(false);
        }
        return;
      }
      if (cancelled) return;

      // Step 5: If getCustomerInfo() returned not-Pro, sync the Apple receipt with RC.
      // This re-validates the receipt against Apple and updates RC's server records so
      // the subscription is properly credited to the current numerical userId (not just
      // via the original anonymous-ID alias). This is the fix for "second login not-Pro":
      // the RC cache expired → server fetch returned not-Pro → receipt sync re-registers
      // the subscription under the userId → Pro unlocked.
      const initialIsPro = finalInfo?.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
      if (!initialIsPro && finalInfo) {
        try {
          const { customerInfo: synced } = await Purchases.syncPurchasesForResult();
          if (!cancelled) {
            finalInfo = synced;
          }
        } catch {
          // non-fatal: continue with last known info
        }
        if (cancelled) return;
      }

      // Step 6: Send SUBSCRIPTION_STATUS exactly once with the final settled result.
      if (finalInfo) {
        const finalIsPro = finalInfo.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
        applyCustomerInfo(finalInfo);

        // Step 7: If Pro confirmed — fire a silent background receipt sync so RC's server
        // records the userId→subscription mapping for future sessions. After this, server
        // fetches for this userId will return Pro without relying on the anonymous-ID alias.
        if (finalIsPro) {
          Purchases.syncPurchasesForResult().catch(() => {});
        }
      }

      if (!cancelled) setIsLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId, applyCustomerInfo]);

  // ── App foreground refresh ────────────────────────────────────────────────
  // Called whenever the app returns to the foreground (AppState "active").
  //
  // NOTE: invalidateCustomerInfoCache() is intentionally NOT called — it forces
  // a raw server fetch for the numerical userId which misses the subscription
  // (stored under the original anonymous RC ID server-side).
  //
  // NOTE: If getCustomerInfo() returns not-Pro but we are currently Pro, we do
  // NOT downgrade. The RC server-side fetch for the numerical userId omits the
  // anonymous-merged entitlement once the SDK cache expires (5-min TTL). The
  // RC SDK's addCustomerInfoUpdateListener fires for genuine expirations — we
  // rely on that for real downgrades, not on foreground polls.
  const refresh = useCallback(async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      const isProNow = info.entitlements.active[ENTITLEMENT_ID]?.isActive === true;

      if (!isProNow && isProRef.current) {
        // Server returned not-Pro but we're currently Pro. This is the known
        // anonymous-ID cache issue: once the SDK cache expires the server fetch
        // returns not-Pro for the numerical userId. Do NOT downgrade — the RC
        // listener handles real expirations.
        return;
      }

      applyCustomerInfo(info);
    } catch {
      // non-fatal
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
    try {
      const restoredInfo = await Purchases.restorePurchases();
      const active = applyCustomerInfo(restoredInfo);
      if (active) {
        postToWebFromNative("PURCHASE_CONFIRMED", { isPro: true });
      }
      return active;
    } catch {
      return false;
    }
  }, [applyCustomerInfo]);

  // ── Purchase ──────────────────────────────────────────────────────────────
  const purchase = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      // Re-identify before purchasing so the receipt attaches to the current
      // Ascend user, not an anonymous RC ID.
      if (userId) {
        try {
          await Purchases.logIn(String(userId));
        } catch {
          // non-fatal
        }
      }

      try {
        const purchaseResult = await Purchases.purchasePackage(pkg);
        const info = purchaseResult?.customerInfo ?? null;

        if (info) {
          const active = applyCustomerInfo(info);
          if (active) {
            postToWebFromNative("PURCHASE_CONFIRMED", { isPro: true });
            return true;
          }
        }

        // Sandbox/TestFlight entitlements can take 1–3 s to propagate.
        // Poll getCustomerInfo() up to 5 times before giving up.
        for (let attempt = 0; attempt < 5; attempt++) {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
          const polledInfo = await Purchases.getCustomerInfo();
          const active = polledInfo.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
          if (active) {
            applyCustomerInfo(polledInfo);
            postToWebFromNative("PURCHASE_CONFIRMED", { isPro: true });
            return true;
          }
        }

        return false;
      } catch (e: any) {
        if (e?.userCancelled) {
          // Apple's "You're already subscribed" sheet dismisses with userCancelled=true.
          // Always attempt a restore first — if Pro is found, unlock immediately.
          // Only fall back to PURCHASE_CANCELLED if the restore confirms no active sub.
          const alreadyPro = await restore();
          if (!alreadyPro) {
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
          return await restore();
        }
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

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
  // Strictly sequential. SUBSCRIPTION_STATUS is sent to the WebView exactly
  // ONCE — at the very end, after all RC calls have settled. It is never sent
  // with a default/guessed value while userId or RC status is still unresolved.
  //
  // Order:
  //   1. Configure RC SDK (once per process).
  //   2. Wait for Ascend userId from the WebView AUTH_STATE message.
  //   3. invalidateCustomerInfoCache()
  //   4. logIn(userId)          ← log result, do NOT post to WebView yet
  //   5. getCustomerInfo()      ← authoritative entitlement check
  //   6. applyCustomerInfo()    ← post SUBSCRIPTION_STATUS exactly once
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
          console.error("[RC] ERROR: " + msg);
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
          console.log("[RC] configured — key:", apiKey.slice(0, 10) + "… | entitlement ID: " + ENTITLEMENT_ID);
        } catch (e) {
          const msg = `configure() threw: ${String(e)}`;
          console.error("[RC] ERROR: " + msg);
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
        console.log("[RC] waiting for Ascend userId — SUBSCRIPTION_STATUS not sent yet");
        if (!cancelled) setIsLoading(false);
        return;
      }

      console.log("[RC] ===== COLD START =====");
      console.log("[RC] Ascend userId: " + userId);

      // NOTE: invalidateCustomerInfoCache() intentionally NOT called here.
      // The RC SDK cache holds the correct merged subscription data (anonymous →
      // userId merge). Invalidating forces a raw server fetch for userId which
      // does not see the subscription (it lives under the original anonymous ID
      // server-side). RC manages cache expiry automatically. Let it use the cache.

      // Step 4: logIn(userId) only when the SDK doesn't already know this user.
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

        console.log("[RC] current RC App User ID: " + currentRcId);
        console.log("[RC] Ascend userId: " + userId);
        console.log("[RC] isAnonymous: " + isAnonymous + " | isWrongUser: " + isWrongUser);

        if (isAnonymous || isWrongUser) {
          console.log("[RC] calling logIn(" + userId + ") — RC user needs migration …");
          const { customerInfo: loginInfo } = await Purchases.logIn(String(userId));
          if (cancelled) return;
          rcAppUserId = await Purchases.getAppUserID().catch(() => String(userId));
          appUserIdRef.current = rcAppUserId;
          if (!cancelled) setAppUserId(rcAppUserId);
          const loginKeys = Object.keys(loginInfo.entitlements.active);
          const loginIsPro = loginInfo.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
          console.log("[RC] logIn() done — RC App User ID: " + rcAppUserId);
          console.log("[RC]   active keys: [" + loginKeys.join(", ") + "]");
          console.log("[RC]   isPro (logIn): " + loginIsPro);
        } else {
          console.log("[RC] already identified as Ascend userId — skipping logIn() to preserve cache");
        }
      } catch (e) {
        console.error("[RC] getAppUserID/logIn failed (non-fatal): " + String(e));
      }
      if (cancelled) return;

      // Step 5: getCustomerInfo() — authoritative entitlement state from RC backend.
      // getOfferings() fetched in parallel for the paywall UI.
      let finalInfo: import("react-native-purchases").CustomerInfo | null = null;
      try {
        console.log("[RC] calling getCustomerInfo() …");
        const [info, offerings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);
        if (cancelled) return;

        finalInfo = info;
        const getKeys = Object.keys(info.entitlements.active);
        const getIsPro = info.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
        const rcId2 = await Purchases.getAppUserID().catch(() => rcAppUserId);
        console.log("[RC] getCustomerInfo() result:");
        console.log("[RC]   RC App User ID       : " + rcId2);
        console.log("[RC]   active keys           : [" + getKeys.join(", ") + "]");
        console.log("[RC]   isPro (getCustomerInfo): " + getIsPro);

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
        console.error("[RC] ERROR: " + msg);
        if (!cancelled) {
          setOfferingsError("Could not verify subscription. Check connection and retry.");
          setOfferingsDiagnostic(msg);
          setIsLoading(false);
        }
        return;
      }
      if (cancelled) return;

      // Step 6: If getCustomerInfo() returned not-Pro, sync the Apple receipt with RC.
      // This re-validates the receipt against Apple and updates RC's server records so
      // the subscription is properly credited to the current numerical userId (not just
      // via the original anonymous-ID alias). This is the fix for "second login not-Pro":
      // the RC cache expired → server fetch returned not-Pro → receipt sync re-registers
      // the subscription under the userId → Pro unlocked.
      const initialIsPro = finalInfo?.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
      if (!initialIsPro && finalInfo) {
        console.log("[RC] getCustomerInfo returned not-Pro — syncing Apple receipt with RC …");
        try {
          const { customerInfo: synced } = await Purchases.syncPurchasesForResult();
          if (!cancelled) {
            finalInfo = synced;
            const syncedKeys = Object.keys(synced.entitlements.active);
            const syncedIsPro = synced.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
            console.log("[RC] syncPurchasesForResult() result:");
            console.log("[RC]   active keys: [" + syncedKeys.join(", ") + "]");
            console.log("[RC]   isPro (synced): " + syncedIsPro);
          }
        } catch (syncErr: any) {
          console.warn("[RC] syncPurchasesForResult() failed (non-fatal):", syncErr?.message ?? syncErr);
        }
        if (cancelled) return;
      }

      // Step 7: Send SUBSCRIPTION_STATUS exactly once with the final settled result.
      if (finalInfo) {
        const finalIsPro = finalInfo.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
        console.log("[RC] ===== SENDING SUBSCRIPTION_STATUS =====");
        console.log("[RC]   isPro: " + finalIsPro);
        console.log("[RC]   active keys: [" + Object.keys(finalInfo.entitlements.active).join(", ") + "]");
        applyCustomerInfo(finalInfo);

        // Step 8: If Pro confirmed — fire a silent background receipt sync so RC's server
        // records the userId→subscription mapping for future sessions. After this, server
        // fetches for this userId will return Pro without relying on the anonymous-ID alias.
        if (finalIsPro) {
          Purchases.syncPurchasesForResult()
            .then(() => console.log("[RC] background receipt sync complete (Pro registered under userId)"))
            .catch((e: any) => console.warn("[RC] background receipt sync failed (non-fatal):", e?.message ?? e));
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
      console.log("[RC:refresh] app foregrounded …");
      const info = await Purchases.getCustomerInfo();
      const isProNow = info.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
      console.log("[RC:refresh] getCustomerInfo — isPro:", isProNow, "| entitlements:", Object.keys(info.entitlements.active));

      if (!isProNow && isProRef.current) {
        // Server returned not-Pro but we're currently Pro. This is the known
        // anonymous-ID cache issue: once the SDK cache expires the server fetch
        // returns not-Pro for the numerical userId. Do NOT downgrade — the RC
        // listener handles real expirations.
        console.log("[RC:refresh] server says not-Pro but current state is Pro — skipping downgrade (anonymous-id stale server issue)");
        return;
      }

      applyCustomerInfo(info);
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

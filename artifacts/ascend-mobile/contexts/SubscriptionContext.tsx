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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { postToWebFromNative } from "./webview-bridge";

// ── Pro cache ─────────────────────────────────────────────────────────────────
// When RC confirms Pro, we write a timestamp to AsyncStorage. On startup and
// foreground we read this first. If < TTL hours old, we immediately tell the
// web layer the user is Pro and then verify with RC in the background.
// RC only ever returns `isPro:false` to the WebView if the cache is also expired,
// preventing false lockouts caused by stale RC SDK cache.
const PRO_CACHE_KEY = "ascend_pro_confirmed_ts";
const PRO_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function readProCache(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PRO_CACHE_KEY);
    if (!raw) return false;
    const age = Date.now() - Number(raw);
    const fresh = age >= 0 && age < PRO_CACHE_TTL_MS;
    console.log("[RC:cache] age:", Math.round(age / 60000), "min — fresh:", fresh);
    return fresh;
  } catch (e) {
    console.warn("[RC:cache] read error (non-fatal):", e);
    return false;
  }
}

async function writeProCache(): Promise<void> {
  try {
    await AsyncStorage.setItem(PRO_CACHE_KEY, String(Date.now()));
    console.log("[RC:cache] written — Pro confirmed");
  } catch (e) {
    console.warn("[RC:cache] write error (non-fatal):", e);
  }
}

async function clearProCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PRO_CACHE_KEY);
    console.log("[RC:cache] cleared — Pro no longer confirmed");
  } catch (e) {
    console.warn("[RC:cache] clear error (non-fatal):", e);
  }
}

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
  // True when AsyncStorage cache confirms Pro and RC hasn't yet countered it.
  // Prevents RC's stale false-negative from closing the gate for legitimate Pro users.
  const cacheProtected = useRef(false);

  const isPro = customerInfo?.entitlements.active[ENTITLEMENT_ID]?.isActive === true;

  // ── applyCustomerInfo ─────────────────────────────────────────────────────
  // THE single source of truth for all CustomerInfo state changes.
  //
  // 1. Checks the exact configured Pro entitlement.
  // 2. Updates React state (customerInfo, subscriptionResolved).
  // 3. Immediately posts SUBSCRIPTION_STATUS to the WebView — UNLESS the cache
  //    says Pro and RC is returning a false-negative (cacheProtected=true).
  //    In that case we silently skip the false post so the user stays in.
  // 4. When RC confirms Pro, writes the AsyncStorage cache.
  // 5. Returns whether Pro is currently active.
  const applyCustomerInfo = useCallback((info: CustomerInfo): boolean => {
    const active = info.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
    setCustomerInfo(info);
    setSubscriptionResolved(true);

    if (active) {
      // RC confirmed Pro — write cache and lift protection (no longer needed)
      cacheProtected.current = false;
      writeProCache(); // fire and forget
      const payload = { isPro: true, appUserId: appUserIdRef.current };
      postToWebFromNative("SUBSCRIPTION_STATUS", payload);
    } else if (cacheProtected.current) {
      // RC is returning not-Pro but our local cache says Pro < 24h ago.
      // Trust the cache — don't downgrade the web gate. RC SDK cache issue.
      console.log(
        "[RC:apply] RC says not-Pro but cache is fresh — suppressing false-negative.",
        "| checked entitlement:", ENTITLEMENT_ID,
        "| active entitlements:", Object.keys(info.entitlements.active)
      );
    } else {
      // No cache protection and RC says not-Pro — legitimate downgrade.
      const payload = { isPro: false, appUserId: appUserIdRef.current };
      postToWebFromNative("SUBSCRIPTION_STATUS", payload);
    }

    console.log(
      "[RC:apply] entitlement:", ENTITLEMENT_ID,
      "| isPro:", active,
      "| cacheProtected:", cacheProtected.current,
      "| posted:", active || !cacheProtected.current,
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

  // ── Startup: cache → configure → invalidate → logIn → getCustomerInfo ──────
  // Runs whenever userId changes (login / logout / account switch).
  //
  // ORDER MATTERS:
  // 1. Read AsyncStorage Pro cache — if fresh, post isPro:true immediately and
  //    set cacheProtected so RC false-negatives don't close the gate.
  // 2. Configure RC SDK (once per process).
  // 3. Invalidate RC's local SDK cache — forces the next call to hit the network
  //    instead of returning a stale cached result (root cause of the false-negative).
  // 4. logIn(userId) — network call, most reliable for migrated receipts.
  // 5. getCustomerInfo + getOfferings — authoritative check + load packages.
  // 6. If still not Pro, auto-restore as last attempt.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setOfferingsError(null);
      setOfferingsDiagnostic(null);

      // Step 1: Check AsyncStorage cache BEFORE any RC call.
      // If we confirmed Pro within the last 24h, tell the web immediately and
      // enable cacheProtected so RC false-negatives don't close the gate.
      if (userId) {
        const cachedPro = await readProCache();
        if (!cancelled && cachedPro) {
          cacheProtected.current = true;
          console.log("[RC:startup] cache hit — posting isPro:true immediately, RC will verify in background");
          setSubscriptionResolved(true);
          setIsLoading(false);
          postToWebFromNative("SUBSCRIPTION_STATUS", { isPro: true, appUserId: appUserIdRef.current });
        }
      }

      // Step 2: Configure the SDK exactly once per process lifetime.
      if (!configured.current) {
        const apiKey = getApiKey();
        if (!apiKey) {
          const msg = "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY is not set. IAP will not work.";
          console.error("[RC:configure] ERROR:", msg);
          if (!cancelled) {
            setOfferingsError("Subscription configuration error. Please restart the app.");
            setOfferingsDiagnostic(msg);
            setIsLoading(false);
            if (!cacheProtected.current) {
              setSubscriptionResolved(true);
              postToWebFromNative("SUBSCRIPTION_STATUS", { isPro: false, appUserId: null });
            }
          }
          return;
        }
        try {
          Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
        } catch {}
        try {
          Purchases.configure({ apiKey });
          configured.current = true;
          console.log(
            "[RC:configure] OK — key prefix:", apiKey.slice(0, 10),
            "| platform:", Platform.OS,
            "| entitlement:", ENTITLEMENT_ID
          );
        } catch (e) {
          const msg = `configure() threw: ${String(e)}`;
          console.error("[RC:configure]", msg);
          if (!cancelled) {
            setOfferingsError("Subscription service unavailable. Please restart the app.");
            setOfferingsDiagnostic(msg);
            setIsLoading(false);
            if (!cacheProtected.current) {
              setSubscriptionResolved(true);
              postToWebFromNative("SUBSCRIPTION_STATUS", { isPro: false, appUserId: null });
            }
          }
          return;
        }
      }

      // Step 3: Identify the Ascend user in RevenueCat.
      // If no userId yet (user not logged in / AsyncStorage still reading),
      // do nothing — never call logOut() here, never post SUBSCRIPTION_STATUS,
      // never set subscriptionResolved=true. The web gate keeps its spinner.
      // When AUTH_STATE fires and userId arrives, this effect re-runs correctly.
      if (!userId) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      // Step 4: Invalidate RC SDK's local cache so the next call hits the network.
      // This is the root fix — RC's in-memory/disk cache returns stale data on
      // subsequent logIn() calls after the initial anonymous→user migration.
      try {
        await Purchases.invalidateCustomerInfoCache();
        console.log("[RC:startup] SDK cache invalidated — next call will hit network");
      } catch (e) {
        console.warn("[RC:startup] invalidateCustomerInfoCache failed (non-fatal):", e);
      }
      if (cancelled) return;

      // Step 5: logIn() — migrates anonymous RC purchases + returns fresh CustomerInfo.
      let preLoginId = "(unknown)";
      try { preLoginId = await Purchases.getAppUserID(); } catch {}
      console.log("[RC:logIn] Ascend userId:", userId, "| RC App User ID before logIn:", preLoginId);

      try {
        const { customerInfo: loginInfo } = await Purchases.logIn(String(userId));
        if (cancelled) return;

        const postLoginId = await Purchases.getAppUserID().catch(() => String(userId));
        appUserIdRef.current = postLoginId;
        if (!cancelled) setAppUserId(postLoginId);

        console.log(
          "[RC:logIn] OK — RC App User ID after logIn:", postLoginId,
          "| active entitlements:", Object.keys(loginInfo.entitlements.active)
        );

        if (!cancelled) applyCustomerInfo(loginInfo);
      } catch (e) {
        console.error("[RC:logIn] failed (non-fatal):", e);
      }

      // Step 6: Fresh getCustomerInfo (authoritative) + load purchase packages.
      try {
        console.log("[RC:fetch] calling getCustomerInfo + getOfferings …");
        const [info, offerings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);
        if (cancelled) return;

        const isProNow = applyCustomerInfo(info);

        // If still not Pro, auto-restore as last attempt.
        if (!isProNow && !cancelled) {
          console.log("[RC:startup] not Pro after getCustomerInfo — auto-restoring …");
          try {
            const restored = await Purchases.restorePurchases();
            if (!cancelled) {
              const restoredPro = applyCustomerInfo(restored);
              console.log("[RC:startup] restore result — isPro:", restoredPro, "| entitlements:", Object.keys(restored.entitlements.active));
            }
          } catch (restoreErr) {
            console.warn("[RC:startup] auto-restore failed (non-fatal):", restoreErr);
          }
        }

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
        if (!cancelled && !cacheProtected.current) {
          setOfferingsError("Could not load subscription. Check your connection.");
          setOfferingsDiagnostic(msg);
          setSubscriptionResolved(true);
          postToWebFromNative("SUBSCRIPTION_STATUS", { isPro: false, appUserId: appUserIdRef.current });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, applyCustomerInfo]);

  // ── App foreground refresh ────────────────────────────────────────────────
  // Re-fetches CustomerInfo whenever the app returns to the foreground.
  // Covers subscription changes made while the app was backgrounded
  // (cancellation, renewal failure, family sharing, etc.).
  const refresh = useCallback(async () => {
    try {
      console.log("[RC:refresh] app foregrounded …");

      // Step 1: Check cache — if fresh, enable protection so RC false-negatives
      // don't flash the paywall while the network call is in-flight.
      if (userId) {
        const cachedPro = await readProCache();
        if (cachedPro) {
          cacheProtected.current = true;
          console.log("[RC:refresh] cache fresh — protecting gate while RC verifies");
        }
      }

      // Step 2: Invalidate RC SDK's local cache — forces a network call.
      try {
        await Purchases.invalidateCustomerInfoCache();
        console.log("[RC:refresh] SDK cache invalidated");
      } catch (e) {
        console.warn("[RC:refresh] invalidateCustomerInfoCache failed (non-fatal):", e);
      }

      // Step 3: logIn — migrates receipts + returns fresh data (most reliable).
      if (userId) {
        try {
          const { customerInfo: loginInfo } = await Purchases.logIn(String(userId));
          const loginPro = loginInfo.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
          console.log("[RC:refresh] logIn — isPro:", loginPro, "| entitlements:", Object.keys(loginInfo.entitlements.active));
          applyCustomerInfo(loginInfo);
          if (loginPro) return; // confirmed — done
        } catch (loginErr) {
          console.warn("[RC:refresh] logIn failed (non-fatal):", loginErr);
        }
      }

      // Step 4: logIn didn't confirm Pro — try getCustomerInfo.
      const info = await Purchases.getCustomerInfo();
      applyCustomerInfo(info);
      const initialPro = info.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
      if (initialPro) return;

      // Step 5: Still not Pro — restore as last attempt.
      console.log("[RC:refresh] not Pro after all RC calls — trying restore …");
      try {
        const restored = await Purchases.restorePurchases();
        const restoredPro = applyCustomerInfo(restored);
        console.log("[RC:refresh] restore — isPro:", restoredPro, "| entitlements:", Object.keys(restored.entitlements.active));
      } catch (restoreErr) {
        console.warn("[RC:refresh] restore failed (non-fatal):", restoreErr);
      }
    } catch (e) {
      console.error("[RC:refresh] failed:", e);
    }
  }, [userId, applyCustomerInfo]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // ── Restore ───────────────────────────────────────────────────────────────
  const restore = useCallback(async (): Promise<boolean> => {
    console.log("[RC:restore] starting …");
    try {
      // Step 1: logIn — if this already confirms Pro, we're done.
      // This is the most reliable call for users whose receipt was purchased
      // under a different RC App User ID (e.g. anonymous) and migrated at login.
      if (userId) {
        try {
          const { customerInfo: loginInfo } = await Purchases.logIn(String(userId));
          const loginPro = loginInfo.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
          console.log(
            "[RC:restore] logIn — isPro:", loginPro,
            "| active entitlements:", Object.keys(loginInfo.entitlements.active)
          );
          if (loginPro) {
            applyCustomerInfo(loginInfo);
            postToWebFromNative("PURCHASE_CONFIRMED", { isPro: true });
            return true;
          }
        } catch (e: any) {
          console.error("[RC:restore] logIn failed (non-fatal):", e?.message ?? e);
        }
      }

      // Step 2: logIn didn't confirm Pro — fall back to restorePurchases.
      const restoredInfo = await Purchases.restorePurchases();
      const active = applyCustomerInfo(restoredInfo);
      const entitlementKeys = Object.keys(restoredInfo.entitlements.active);

      console.log(
        "[RC:restore] restorePurchases — isPro:", active,
        "| active entitlements:", entitlementKeys,
        "| RC App User ID:", (restoredInfo as any).originalAppUserId ?? "?"
      );

      if (active) {
        postToWebFromNative("PURCHASE_CONFIRMED", { isPro: true });
      }
      return active;
    } catch (e: any) {
      console.error("[RC:restore] failed:", e?.message ?? e);
      return false;
    }
  }, [userId, applyCustomerInfo]);

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

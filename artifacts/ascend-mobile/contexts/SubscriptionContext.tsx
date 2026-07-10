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

const ENTITLEMENT_ID =
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

/**
 * Inspect a raw PurchasesOfferings object and return a human-readable
 * diagnostic string plus the resolved packages.
 *
 * Three distinct failure modes:
 * A) offerings.all is empty  → RC has no offerings at all for this app/API key
 * B) offerings.current is null but offerings.all has entries
 *    → Offerings exist but none is marked "Current" in RC dashboard
 * C) offerings.current exists but availablePackages is empty
 *    → Offering is current but has no packages / product not approved in ASC
 */
function diagnoseOfferings(offerings: PurchasesOfferings): {
  packages: PurchasesPackage[];
  diagnostic: string | null;
} {
  const allKeys = Object.keys(offerings.all ?? {});

  console.log("[RC:diagnose] offerings.all keys:", allKeys.length === 0 ? "(none)" : allKeys.join(", "));
  console.log("[RC:diagnose] offerings.current:", offerings.current ? `"${offerings.current.identifier}"` : "null");

  if (allKeys.length === 0) {
    const msg =
      "RC returned zero offerings. Possible causes:\n" +
      "1) Wrong API key (check EXPO_PUBLIC_REVENUECAT_IOS_API_KEY)\n" +
      "2) Bundle ID mismatch between app and RC app settings\n" +
      "3) No offerings created in RC dashboard yet";
    console.error("[RC:diagnose]", msg);
    return { packages: [], diagnostic: msg };
  }

  if (!offerings.current) {
    const msg =
      `RC has offerings [${allKeys.join(", ")}] but none is marked "Current".\n` +
      'Fix: RevenueCat dashboard → Offerings → select an offering → "Make Current".';
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
      "Possible causes:\n" +
      "1) Product not attached to offering in RC dashboard\n" +
      "2) Product ID in RC doesn't match App Store Connect exactly\n" +
      "3) Subscription not in 'Ready to Submit' or 'Approved' state in ASC\n" +
      "4) Paid Applications Agreement not signed in App Store Connect";
    console.error("[RC:diagnose]", msg);
    return { packages: [], diagnostic: msg };
  }

  return { packages: pkgs, diagnostic: null };
}

type SubscriptionContextValue = {
  isPro: boolean;
  isLoading: boolean;
  customerInfo: CustomerInfo | null;
  packages: PurchasesPackage[];
  offeringsError: string | null;
  offeringsDiagnostic: string | null;
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(
  null
);

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
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [offeringsDiagnostic, setOfferingsDiagnostic] = useState<string | null>(null);

  // Track whether Purchases.configure() has been called so we never call it
  // more than once (the SDK throws if configured twice).
  const configured = useRef(false);

  const isPro =
    customerInfo?.entitlements.active[ENTITLEMENT_ID]?.isActive === true;

  // Keep customerInfo in sync via the native listener (fires after purchases,
  // restores, and webhook-driven status changes).
  useEffect(() => {
    const listener = (info: CustomerInfo) => setCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  // Configure once, then identify the user and load entitlements + offerings.
  // Single effect so configure() always completes before logIn() fires.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setOfferingsError(null);
      setOfferingsDiagnostic(null);

      // --- Step 1: Configure the SDK (only once ever) ---
      if (!configured.current) {
        const apiKey = getApiKey();
        if (!apiKey) {
          const msg =
            "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY is not set. " +
            "IAP will not work.";
          console.error("[RC:configure] ERROR:", msg);
          if (!cancelled) {
            setOfferingsError("Subscription configuration error. Please restart the app.");
            setOfferingsDiagnostic(msg);
            setIsLoading(false);
          }
          return;
        }

        // Enable verbose RC SDK logging in dev/TestFlight so reviewers'
        // crashes produce usable output in Xcode / Console.app.
        try {
          Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO);
        } catch {
          // setLogLevel may not be available on all RN versions — safe to ignore
        }

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
          }
          return;
        }
      }

      // --- Step 2: Identify the user (optional — offerings load regardless) ---
      if (userId) {
        try {
          const { customerInfo: info } = await Purchases.logIn(String(userId));
          if (!cancelled) setCustomerInfo(info);
          console.log("[RC:logIn] OK — userId:", userId);
        } catch (e) {
          // logIn failure is non-fatal; we can still fetch offerings
          console.error("[RC:logIn] failed (non-fatal):", e);
        }
      } else {
        try {
          await Purchases.logOut();
        } catch {
          // logOut throws if no user was logged in — safe to ignore
        }
        if (!cancelled) setCustomerInfo(null);
        // Do NOT return early — always fetch offerings so the paywall
        // shows packages even before the user is fully identified.
      }

      // --- Step 3: Load entitlements + offerings ---
      try {
        console.log("[RC:fetch] calling getCustomerInfo + getOfferings …");
        const [info, offerings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);

        if (cancelled) return;

        setCustomerInfo(info);

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
        const msg = `getOfferings() threw: ${e?.message ?? String(e)} (code ${e?.code ?? "?"})`;
        console.error("[RC:fetch] ERROR:", msg);
        if (!cancelled) {
          setOfferingsError("Could not load subscription. Check your connection.");
          setOfferingsDiagnostic(msg);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Refresh when app returns to foreground
  const refresh = useCallback(async () => {
    try {
      console.log("[RC:refresh] refreshing offerings …");
      const [info, offerings] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      setCustomerInfo(info);
      const { packages: pkgs, diagnostic } = diagnoseOfferings(offerings);
      setPackages(pkgs);
      if (pkgs.length > 0) {
        setOfferingsError(null);
        setOfferingsDiagnostic(null);
      } else {
        setOfferingsError("No subscription package found. Tap to retry.");
        setOfferingsDiagnostic(diagnostic);
      }
    } catch (e) {
      console.error("[RC:refresh] failed:", e);
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage): Promise<boolean> => {
      const productId =
        (pkg.product as any).identifier ??
        (pkg.product as any).productIdentifier ??
        pkg.identifier;
      console.log("[RC:purchase] starting purchase for:", productId);

      // Ensure the user is identified before purchasing so the same App User ID
      // is used consistently across purchase and restore.
      if (userId) {
        try {
          const { customerInfo: loginInfo } = await Purchases.logIn(
            String(userId)
          );
          console.log(
            "[RC:purchase] logIn OK — userId:",
            userId,
            "| entitlements:",
            Object.keys(loginInfo.entitlements.active)
          );
        } catch (e: any) {
          console.error("[RC:purchase] logIn FAILED:", e?.message ?? e);
        }
      }

      try {
        const purchaseResult = await Purchases.purchasePackage(pkg);
        // purchasePackage returns a MakePurchaseResult with customerInfo
        const info = purchaseResult?.customerInfo ?? null;
        if (info) {
          console.log(
            "[RC:purchase] purchasePackage returned — all active entitlements:",
            Object.keys(info.entitlements.active)
          );
          setCustomerInfo(info);
          const active =
            info.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
          if (active) {
            console.log("[RC:purchase] entitlement active immediately");
            return true;
          }
        }
        // Sandbox/TestFlight entitlements can lag 1–3 s behind the Apple
        // transaction completion. Poll getCustomerInfo() up to 5 times.
        let polledInfo: CustomerInfo | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 2000));
          }
          polledInfo = await Purchases.getCustomerInfo();
          const active =
            polledInfo.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
          console.log(
            "[RC:purchase] entitlement check attempt",
            attempt + 1,
            "— isPro:",
            active,
            "| all active:",
            Object.keys(polledInfo.entitlements.active)
          );
          if (active) {
            setCustomerInfo(polledInfo);
            return true;
          }
        }
        // Not active after retries — still set the latest info and return false
        if (polledInfo) setCustomerInfo(polledInfo);
        console.log(
          "[RC:purchase] complete — isPro: false after retries. all active:",
          Object.keys(polledInfo?.entitlements.active ?? {})
        );
        return false;
      } catch (e: any) {
        if (e?.userCancelled) {
          console.log("[RC:purchase] cancelled by user");
          return false;
        }
        const code = e?.code ?? e?.errorCode ?? "";
        const msg = e?.message ?? "";
        // Apple says the subscription is already owned (previous purchase from
        // another TestFlight build). Auto-restore so the user isn't stuck.
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
    []
  );

  const restore = useCallback(async (): Promise<boolean> => {
    console.log("[RC:restore] starting restore …");
    try {
      // Ensure the user is identified before restoring so the same App User ID
      // is used consistently (matches the ID active at purchase time).
      if (userId) {
        try {
          const { customerInfo: loginInfo } = await Purchases.logIn(
            String(userId)
          );
          console.log(
            "[RC:restore] logIn OK — userId:",
            userId,
            "| entitlements:",
            Object.keys(loginInfo.entitlements.active)
          );
        } catch (e: any) {
          console.error("[RC:restore] logIn FAILED:", e?.message ?? e);
        }
      }

      // restorePurchases() returns the updated CustomerInfo directly.
      // We log every entitlement it reports before any further polling.
      const restoredInfo = await Purchases.restorePurchases();
      console.log(
        "[RC:restore] restorePurchases() returned — all active entitlements:",
        Object.keys(restoredInfo.entitlements.active)
      );
      setCustomerInfo(restoredInfo);

      const active =
        restoredInfo.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
      console.log("[RC:restore] entitlement check (restorePurchases) — isPro:", active);
      if (active) return true;

      // If the immediate result is not active, poll getCustomerInfo()
      // up to 5 times with longer delays (Apple sandbox is slower).
      let info: CustomerInfo | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 2000));
        }
        info = await Purchases.getCustomerInfo();
        const attemptActive =
          info.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
        console.log(
          "[RC:restore] entitlement check attempt",
          attempt + 1,
          "— isPro:",
          attemptActive,
          "| all active:",
          Object.keys(info.entitlements.active)
        );
        if (attemptActive) {
          setCustomerInfo(info);
          return true;
        }
      }
      if (info) setCustomerInfo(info);
      console.log(
        "[RC:restore] complete — isPro: false after retries. all active:",
        Object.keys(info?.entitlements.active ?? {})
      );
      return false;
    } catch (e: any) {
      console.error("[RC:restore] failed:", e?.message ?? e);
      return false;
    }
  }, [userId]);

  return (
    <SubscriptionContext.Provider
      value={{
        isPro,
        isLoading,
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

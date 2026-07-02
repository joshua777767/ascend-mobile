import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";
import { Platform, AppState } from "react-native";

const ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? "pro";

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

type SubscriptionContextValue = {
  isPro: boolean;
  isLoading: boolean;
  customerInfo: CustomerInfo | null;
  packages: PurchasesPackage[];
  offeringsError: string | null;
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
  // This is a SINGLE effect so configure always completes before logIn fires —
  // calling logIn before configure throws "Purchases not configured".
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setOfferingsError(null);

      // --- Step 1: Configure the SDK (only once ever) ---
      if (!configured.current) {
        const apiKey = getApiKey();
        if (!apiKey) {
          console.error(
            "[RevenueCat] EXPO_PUBLIC_REVENUECAT_IOS_API_KEY is not set. " +
            "IAP will not work. Check your Replit environment variables."
          );
          if (!cancelled) {
            setOfferingsError("Subscription configuration error. Please restart the app.");
            setIsLoading(false);
          }
          return;
        }
        try {
          Purchases.configure({ apiKey });
          configured.current = true;
          console.log("[RevenueCat] Configured with key prefix:", apiKey.slice(0, 8));
        } catch (e) {
          console.error("[RevenueCat] configure() failed:", e);
          if (!cancelled) {
            setOfferingsError("Subscription service unavailable. Please restart the app.");
            setIsLoading(false);
          }
          return;
        }
      }

      // --- Step 2: Identify or log out the user ---
      if (userId) {
        try {
          const { customerInfo: info } = await Purchases.logIn(userId);
          if (!cancelled) setCustomerInfo(info);
          console.log("[RevenueCat] Logged in userId:", userId);
        } catch (e) {
          console.error("[RevenueCat] logIn() failed:", e);
        }
      } else {
        try {
          await Purchases.logOut();
        } catch {
          // logOut can throw if no user was logged in — safe to ignore
        }
        if (!cancelled) {
          setCustomerInfo(null);
          setPackages([]);
          setIsLoading(false);
        }
        return;
      }

      // --- Step 3: Load entitlements + offerings in parallel ---
      try {
        const [info, offerings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);

        if (cancelled) return;

        setCustomerInfo(info);

        const pkgs = offerings.current?.availablePackages ?? [];
        setPackages(pkgs);

        if (pkgs.length === 0) {
          console.warn(
            "[RevenueCat] No packages returned from current offering. " +
            "Verify: 1) Product ID in App Store Connect matches RevenueCat, " +
            "2) Default offering is configured in RevenueCat dashboard, " +
            "3) Product is approved in App Store Connect."
          );
          setOfferingsError(
            "Subscription product unavailable. Please check your connection and try again."
          );
        } else {
          console.log(
            "[RevenueCat] Loaded packages:",
            pkgs.map((p) => `${p.identifier} (${(p.product as any).identifier ?? (p.product as any).productIdentifier ?? "unknown"})`).join(", ")
          );
          setOfferingsError(null);
        }
      } catch (e: any) {
        console.error("[RevenueCat] getCustomerInfo/getOfferings failed:", e);
        if (!cancelled) {
          setOfferingsError(
            "Could not load subscription details. Check your internet connection."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Refresh entitlements when app returns to foreground so revocation
  // or expiration is detected without waiting for a native push.
  const refresh = useCallback(async () => {
    try {
      const [info, offerings] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      setCustomerInfo(info);
      const pkgs = offerings.current?.availablePackages ?? [];
      setPackages(pkgs);
      if (pkgs.length > 0) setOfferingsError(null);
    } catch (e) {
      console.error("[RevenueCat] refresh() failed:", e);
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
      console.log(
        "[RevenueCat] purchasePackage:",
        (pkg.product as any).identifier ?? (pkg.product as any).productIdentifier ?? pkg.identifier
      );
      try {
        const { customerInfo: info } = await Purchases.purchasePackage(pkg);
        setCustomerInfo(info);
        const active =
          info.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
        console.log("[RevenueCat] purchase complete, isPro:", active);
        return active;
      } catch (e: any) {
        if (e?.userCancelled) {
          console.log("[RevenueCat] purchase cancelled by user");
          return false;
        }
        console.error("[RevenueCat] purchasePackage failed:", e);
        throw e;
      }
    },
    []
  );

  const restore = useCallback(async (): Promise<boolean> => {
    console.log("[RevenueCat] restorePurchases");
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      const active =
        info.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
      console.log("[RevenueCat] restore complete, isPro:", active);
      return active;
    } catch (e) {
      console.error("[RevenueCat] restorePurchases failed:", e);
      return false;
    }
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        isPro,
        isLoading,
        customerInfo,
        packages,
        offeringsError,
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

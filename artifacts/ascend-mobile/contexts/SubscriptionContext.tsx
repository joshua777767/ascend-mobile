import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";
import { Platform } from "react-native";

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

  const isPro =
    customerInfo?.entitlements.active[ENTITLEMENT_ID]?.isActive === true;

  // Configure once and keep customerInfo in sync via the native listener.
  useEffect(() => {
    const apiKey = getApiKey();
    if (apiKey) Purchases.configure({ apiKey });
    const listener = (info: CustomerInfo) => setCustomerInfo(info);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [info, offerings] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      setCustomerInfo(info);
      setPackages(offerings.current?.availablePackages ?? []);
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Re-key all subscription state on the identity. On login: identify with
  // RevenueCat then load fresh entitlements. On logout (userId null): log out
  // of RevenueCat and wipe any cached entitlement/package state so the previous
  // user's Pro status can never leak into the next account. isLoading is held
  // true across the switch so the gate waits for fresh state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        if (userId) {
          try { await Purchases.logIn(userId); } catch {}
        } else {
          try { await Purchases.logOut(); } catch {}
          if (!cancelled) {
            setCustomerInfo(null);
            setPackages([]);
          }
        }
        const [info, offerings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);
        if (!cancelled) {
          setCustomerInfo(info);
          setPackages(offerings.current?.availablePackages ?? []);
        }
      } catch {
        if (!cancelled && !userId) {
          setCustomerInfo(null);
          setPackages([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const purchase = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      return info.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
    } catch (e: any) {
      if (e?.userCancelled) return false;
      throw e;
    }
  }, []);

  const restore = useCallback(async (): Promise<boolean> => {
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return info.entitlements.active[ENTITLEMENT_ID]?.isActive === true;
    } catch {
      return false;
    }
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{ isPro, isLoading, customerInfo, packages, purchase, restore, refresh }}
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

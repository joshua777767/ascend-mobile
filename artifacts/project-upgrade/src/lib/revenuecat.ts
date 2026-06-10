import { Purchases, LOG_LEVEL, type CustomerInfo, type PurchasesPackage } from "@revenuecat/purchases-capacitor";

const REVENUECAT_ENTITLEMENT = "pro";

function getRevenueCatApiKey(): string {
  // In Capacitor iOS, the plugin reads the key from config automatically
  // But for web/development, we need a key
  if (import.meta.env.VITE_REVENUECAT_TEST_API_KEY) {
    return import.meta.env.VITE_REVENUECAT_TEST_API_KEY;
  }
  // Fallback: try to get from the capacitor config (native only)
  return "";
}

let isConfigured = false;

export async function initializeRevenueCat(userId: string | number): Promise<void> {
  if (isConfigured) return;

  const apiKey = getRevenueCatApiKey();
  if (apiKey) {
    Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
    Purchases.configure({
      apiKey,
      appUserID: String(userId),
    });
    isConfigured = true;
    console.log("RevenueCat configured");
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch {
    return null;
  }
}

export async function getOfferings() {
  try {
    return await Purchases.getOfferings();
  } catch {
    return null;
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return customerInfo;
  } catch {
    return null;
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return customerInfo;
  } catch {
    return null;
  }
}

export function isSubscribed(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT] !== undefined;
}

export function getSubscriptionExpiry(customerInfo: CustomerInfo | null): Date | null {
  if (!customerInfo) return null;
  const entitlement = customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT];
  if (!entitlement) return null;
  return entitlement.expirationDate ? new Date(entitlement.expirationDate) : null;
}

export { Purchases, LOG_LEVEL };
export type { CustomerInfo, PurchasesPackage };

import { useGetUserProfile, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { getCustomerInfo, isSubscribed } from "@/lib/revenuecat";

export interface TrialInfo {
  trialDay: number;
  daysLeft: number;
  isOnTrial: boolean;
  trialComplete: boolean;
  isFreePro: boolean;
}

export function useTrialDay(): TrialInfo {
  const { data: profile } = useGetUserProfile();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false, refetchOnWindowFocus: false } });

  const isFreePro = !!me?.isFreePro;

  // Check RevenueCat entitlement (for native iOS app)
  const { data: customerInfo } = useQuery({
    queryKey: ["revenuecat", "trial-check"],
    queryFn: async () => {
      try {
        return await getCustomerInfo();
      } catch {
        return null;
      }
    },
    enabled: typeof window !== "undefined" && (window as any).Capacitor !== undefined,
    staleTime: 60 * 1000,
  });

  const isRevenueCatPro = customerInfo ? isSubscribed(customerInfo) : false;
  const isPro = isFreePro || isRevenueCatPro;

  if (!profile?.createdAt) {
    return { trialDay: 1, daysLeft: 6, isOnTrial: true, trialComplete: false, isFreePro: isPro };
  }
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysSince = Math.floor(
    (Date.now() - new Date(profile.createdAt).getTime()) / msPerDay
  );
  const trialDay = Math.min(7, daysSince + 1);
  const daysLeft = Math.max(0, 7 - trialDay);
  return {
    trialDay,
    daysLeft,
    isOnTrial: !isPro,
    trialComplete: !isPro && trialDay >= 7,
    isFreePro: isPro,
  };
}

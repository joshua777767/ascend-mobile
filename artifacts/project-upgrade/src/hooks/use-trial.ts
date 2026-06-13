import { useGetUserProfile, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { getCustomerInfo, isSubscribed } from "@/lib/revenuecat";

export interface TrialInfo {
  trialDay: number;
  daysLeft: number;
  isOnTrial: boolean;
  trialComplete: boolean;
  isFreePro: boolean;
  hasAccess: boolean;
  trialExpired: boolean;
  isPaidSubscriber: boolean;
  isLoading: boolean;
}

export function useTrialDay(): TrialInfo {
  const { data: profile } = useGetUserProfile();
  const { data: me, isLoading: isMeLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false, refetchOnWindowFocus: false } });

  const isFreePro = !!me?.isFreePro;
  const isPaidSubscriber = !!me?.isPaidSubscriber;

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
  // Full Pro: server freePro, Stripe paid subscription, or RevenueCat native
  const isPro = isFreePro || isPaidSubscriber || isRevenueCatPro;
  // Backend computes hasAccess correctly (trialActive OR freePro OR paidSubscriber)
  // Supplement with RevenueCat for native iOS
  const backendHasAccess = !!me?.hasAccess;
  const hasAccess = backendHasAccess || isRevenueCatPro;
  // Trial is only "expired with no access" if backend says expired AND no access at all
  const backendTrialExpired = !!me?.trialExpired;
  const trialExpired = backendTrialExpired && !hasAccess;

  if (!profile?.createdAt) {
    return {
      trialDay: 1,
      daysLeft: 6,
      isOnTrial: !isPro,
      trialComplete: false,
      isFreePro: isPro,
      // While me is still loading, assume access to prevent flicker lockout
      hasAccess: me !== undefined ? hasAccess : true,
      trialExpired: false,
      isPaidSubscriber,
      isLoading: isMeLoading,
    };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  // Prefer backend trial start date for accuracy; fall back to profile createdAt
  const trialStart = me?.trialStartDate
    ? new Date(me.trialStartDate)
    : new Date(profile.createdAt);
  const daysSince = Math.floor((Date.now() - trialStart.getTime()) / msPerDay);
  const trialDay = Math.min(7, daysSince + 1);
  const daysLeft = Math.max(0, 7 - trialDay);

  return {
    trialDay,
    daysLeft,
    isOnTrial: !isPro && daysLeft > 0,
    trialComplete: trialExpired,
    isFreePro: isPro,
    hasAccess,
    trialExpired,
    isPaidSubscriber,
    isLoading: isMeLoading,
  };
}

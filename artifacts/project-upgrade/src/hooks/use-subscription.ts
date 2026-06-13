import { useQuery } from "@tanstack/react-query";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { getCustomerInfo, getOfferings, isSubscribed } from "@/lib/revenuecat";

export function useSubscription() {
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false, refetchOnWindowFocus: false } });

  const isFreePro = !!me?.isFreePro;

  const isNative = typeof window !== "undefined" && (window as any).Capacitor !== undefined;

  const { data: customerInfo, isLoading: isLoadingCustomerInfo } = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: async () => {
      try {
        return await getCustomerInfo();
      } catch {
        return null;
      }
    },
    enabled: isNative,
    staleTime: 60 * 1000,
  });

  const { data: offerings, isLoading: isLoadingOfferings } = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => {
      try {
        return await getOfferings();
      } catch {
        return null;
      }
    },
    enabled: isNative,
    staleTime: 300 * 1000,
  });

  const isPaidSubscriber = !!me?.isPaidSubscriber;
  const isRevenueCatPro = customerInfo ? isSubscribed(customerInfo) : false;
  const isPro = isFreePro || isRevenueCatPro || isPaidSubscriber;
  const isLoading = isLoadingCustomerInfo || isLoadingOfferings;

  const currentPackage = offerings?.current?.availablePackages?.[0] ?? null;

  return {
    isPro,
    isFreePro,
    isRevenueCatPro,
    isLoading,
    customerInfo,
    currentPackage,
    isNative,
    offerings,
  };
}

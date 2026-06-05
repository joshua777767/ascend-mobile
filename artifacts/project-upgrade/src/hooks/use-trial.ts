import { useGetUserProfile } from "@workspace/api-client-react";

export interface TrialInfo {
  trialDay: number;
  daysLeft: number;
  isOnTrial: boolean;
  trialComplete: boolean;
}

export function useTrialDay(): TrialInfo {
  const { data: profile } = useGetUserProfile();
  if (!profile?.createdAt) {
    return { trialDay: 1, daysLeft: 6, isOnTrial: true, trialComplete: false };
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
    isOnTrial: true,
    trialComplete: trialDay >= 7,
  };
}

import { sendToNative, onFromNative, isNative } from "./native-bridge";

export const MEAL_NOTIFS_KEY = "ascend.mealNotifs";
export const NOTIF_PERM_KEY = "ascend.notifPermission";
export const NOTIF_ASKED_KEY = "ascend.notifPermissionAsked";

export type MealNotifsMap = Record<string, boolean>;

/** Stable notification ID derived from a meal's activity name. */
export function mealNotifId(activity: string): string {
  return "meal-" + activity.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function loadMealNotifs(): MealNotifsMap {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(MEAL_NOTIFS_KEY) ?? "{}"); } catch { return {}; }
}

export function saveMealNotifs(v: MealNotifsMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MEAL_NOTIFS_KEY, JSON.stringify(v));
}

export function loadNotifPermissionAsked(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(NOTIF_ASKED_KEY) === "true";
}

export function saveNotifPermissionAsked(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NOTIF_ASKED_KEY, "true");
}

export function loadNotifPermission(): "unknown" | "granted" | "denied" {
  if (typeof window === "undefined") return "unknown";
  const saved = window.localStorage.getItem(NOTIF_PERM_KEY);
  return (saved === "granted" || saved === "denied") ? saved : "unknown";
}

export function saveNotifPermission(perm: "granted" | "denied"): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NOTIF_PERM_KEY, perm);
}

/** Schedule a daily notification via the native bridge. */
export function bridgeScheduleNotif(id: string, activity: string, time: string): void {
  if (!isNative) return;
  const [h, m] = time.split(":").map(Number);
  sendToNative("SCHEDULE_NOTIFICATION", {
    id,
    title: "🍽 Time to eat!",
    body: `Log your ${activity} in AscendFit`,
    hour: h ?? 0,
    minute: m ?? 0,
  });
}

/** Cancel a scheduled notification via the native bridge. */
export function bridgeCancelNotif(id: string): void {
  if (!isNative) return;
  sendToNative("CANCEL_NOTIFICATION", { id });
}

/** Cancel all meal notifications and clear localStorage state. */
export function clearAllMealNotifs(items: { activity: string }[]): void {
  const map = loadMealNotifs();
  for (const item of items) {
    const id = mealNotifId(item.activity);
    if (map[id]) bridgeCancelNotif(id);
  }
  saveMealNotifs({});
}

type MealScheduleItem = { activity: string; time: string; type: string };

/** Enable notifications for every meal in the schedule. */
export function enableMealNotifsForSchedule(items: MealScheduleItem[]): void {
  if (!isNative) return;
  const map = loadMealNotifs();
  for (const item of items) {
    if (item.type !== "meal") continue;
    const id = mealNotifId(item.activity);
    bridgeScheduleNotif(id, item.activity, item.time);
    map[id] = true;
  }
  saveMealNotifs(map);
}

/**
 * Request notification permission from the native shell.
 * Returns a promise that resolves with the result (granted or denied).
 * Only meaningful inside the native WebView.
 */
export function requestNotificationPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!isNative) {
      resolve(false);
      return;
    }
    const cleanup = onFromNative("NOTIFICATION_PERMISSION", (payload) => {
      cleanup();
      const granted = (payload as { granted?: boolean } | null)?.granted ?? false;
      const perm = granted ? "granted" : "denied";
      saveNotifPermission(perm);
      resolve(granted);
    });
    sendToNative("REQUEST_NOTIFICATION_PERMISSION");
  });
}

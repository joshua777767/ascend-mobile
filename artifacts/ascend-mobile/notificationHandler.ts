/**
 * Pure notification handler functions extracted from webview.tsx
 * for testability. All expo-notifications calls live here so tests
 * can mock the module without touching React components.
 */
import * as Notifications from "expo-notifications";

export type PostToWeb = (type: string, payload: unknown) => void;

/** Stable notification ID derived from a meal's activity name. */
export function mealNotifId(activity: string): string {
  return "meal-" + activity.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** Split an "HH:MM" string into numeric hour and minute. */
export function parseNotifTime(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":").map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
}

function isPermGranted(r: Notifications.NotificationPermissionsStatus): boolean {
  return (
    r.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    r.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

/**
 * Handle REQUEST_NOTIFICATION_PERMISSION bridge message.
 * Checks current status first; only prompts the user if not yet determined.
 */
export async function handleRequestPermission(postToWeb: PostToWeb): Promise<void> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (isPermGranted(existing)) {
      postToWeb("NOTIFICATION_PERMISSION", { granted: true });
    } else {
      const result = await Notifications.requestPermissionsAsync();
      postToWeb("NOTIFICATION_PERMISSION", { granted: isPermGranted(result) });
    }
  } catch {
    postToWeb("NOTIFICATION_PERMISSION", { granted: false });
  }
}

/**
 * Handle SCHEDULE_NOTIFICATION bridge message.
 * Always cancels any prior notification with the same identifier before
 * scheduling, so duplicate notifications are never created.
 */
export async function handleScheduleNotification(
  id: string,
  title: string,
  body: string,
  hour: number,
  minute: number,
  postToWeb: PostToWeb
): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    postToWeb("NOTIFICATION_SCHEDULED", { id });
  } catch {
    // Non-fatal — notification scheduling is best-effort.
  }
}

/**
 * Handle CANCEL_NOTIFICATION bridge message.
 * Silently ignores missing identifiers.
 */
export async function handleCancelNotification(id: string, postToWeb: PostToWeb): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
    postToWeb("NOTIFICATION_CANCELLED", { id });
  } catch {
    // Notification may not have existed; ignore.
  }
}

/**
 * DEV ONLY — Schedule a one-shot notification in 10 seconds for manual testing.
 * Called by the "Test notification in 10 seconds" dev button on the Schedule page.
 */
export async function handleDevTestNotification(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync("dev-test").catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: "dev-test",
      content: {
        title: "🍽 Test notification",
        body: "This is a 10-second test reminder from AscendFit",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 10,
        repeats: false,
      } as any,
    });
  } catch {
    // Ignore.
  }
}

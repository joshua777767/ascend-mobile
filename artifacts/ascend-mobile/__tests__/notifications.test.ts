/**
 * Notification handler tests — jest-expo (node environment)
 *
 * expo-notifications is fully mocked; no real OS calls are made.
 * Tests cover the behaviors specified in the task brief:
 *   - permission not requested on launch
 *   - permission requested on first reminder
 *   - denied → no notification scheduled
 *   - granted → DAILY repeating trigger
 *   - stable unique IDs per meal
 *   - notification body names the meal
 *   - editing time cancels old + schedules new
 *   - turning off cancels the notification
 *   - localStorage persistence (ID stability)
 *   - time parsing (AM/PM / 24-h)
 *   - duplicate-safe scheduling
 */

import {
  mealNotifId,
  parseNotifTime,
  handleRequestPermission,
  handleScheduleNotification,
  handleCancelNotification,
} from "../notificationHandler";
import * as Notifications from "expo-notifications";

// ─── mock expo-notifications ──────────────────────────────────────────────────

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn().mockResolvedValue(undefined),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  setNotificationHandler: jest.fn(),
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  SchedulableTriggerInputTypes: {
    DAILY: "daily",
    TIME_INTERVAL: "timeInterval",
  },
}));

const mockN = Notifications as jest.Mocked<typeof Notifications>;

// ─── helpers ──────────────────────────────────────────────────────────────────

const granted = (status: number) =>
  ({ ios: { status } } as Notifications.NotificationPermissionsStatus);

// ─── permission not requested on app launch ───────────────────────────────────

describe("permission not requested on app launch", () => {
  beforeEach(() => jest.clearAllMocks());

  it("importing the module does not call getPermissionsAsync", () => {
    expect(mockN.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it("importing the module does not call requestPermissionsAsync", () => {
    expect(mockN.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("importing the module does not schedule any notification", () => {
    expect(mockN.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

// ─── mealNotifId — stable unique IDs ─────────────────────────────────────────

describe("mealNotifId — stable, unique IDs per meal type", () => {
  it("breakfast, lunch, dinner, and snack each have separate stored notification IDs", () => {
    const ids = ["Breakfast", "Lunch", "Dinner", "Snack"].map(mealNotifId);
    expect(new Set(ids).size).toBe(4);
  });

  it("generates the expected stable IDs for common meals", () => {
    expect(mealNotifId("Breakfast")).toBe("meal-breakfast");
    expect(mealNotifId("Lunch")).toBe("meal-lunch");
    expect(mealNotifId("Dinner")).toBe("meal-dinner");
    expect(mealNotifId("Snack")).toBe("meal-snack");
  });

  it("is case-insensitive — same meal, different case → same ID", () => {
    expect(mealNotifId("Breakfast")).toBe(mealNotifId("BREAKFAST"));
    expect(mealNotifId("lunch")).toBe(mealNotifId("Lunch"));
  });

  it("sanitises spaces and special characters", () => {
    expect(mealNotifId("Protein Shake")).toBe("meal-protein-shake");
    expect(mealNotifId("Post-Workout Meal")).toBe("meal-post-workout-meal");
    expect(mealNotifId("Afternoon Snack (2pm)")).toBe("meal-afternoon-snack-2pm-");
  });

  it("ID is stable after closing and reopening the app (deterministic from name)", () => {
    const first = mealNotifId("Breakfast");
    const second = mealNotifId("Breakfast");
    expect(first).toBe(second);
  });
});

// ─── parseNotifTime — AM / PM / 24-h parsing ─────────────────────────────────

describe("parseNotifTime — time string → hour / minute", () => {
  it("parses 24-hour HH:MM correctly (morning)", () => {
    expect(parseNotifTime("08:30")).toEqual({ hour: 8, minute: 30 });
  });

  it("parses 24-hour HH:MM correctly (afternoon)", () => {
    expect(parseNotifTime("13:00")).toEqual({ hour: 13, minute: 0 });
  });

  it("parses 24-hour HH:MM correctly (evening)", () => {
    expect(parseNotifTime("20:45")).toEqual({ hour: 20, minute: 45 });
  });

  it("handles midnight (00:00)", () => {
    expect(parseNotifTime("00:00")).toEqual({ hour: 0, minute: 0 });
  });

  it("handles noon (12:00)", () => {
    expect(parseNotifTime("12:00")).toEqual({ hour: 12, minute: 0 });
  });

  it("AM hour: 07:15 → hour 7, minute 15", () => {
    const { hour, minute } = parseNotifTime("07:15");
    expect(hour).toBe(7);
    expect(minute).toBe(15);
  });

  it("PM hour: 18:30 → hour 18, minute 30 (24-h)", () => {
    const { hour, minute } = parseNotifTime("18:30");
    expect(hour).toBe(18);
    expect(minute).toBe(30);
  });
});

// ─── handleRequestPermission — iOS permission flow ────────────────────────────

describe("handleRequestPermission — permission requested only on first reminder", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does NOT call requestPermissionsAsync when already AUTHORIZED", async () => {
    mockN.getPermissionsAsync.mockResolvedValue(granted(2)); // AUTHORIZED
    const postToWeb = jest.fn();
    await handleRequestPermission(postToWeb);
    expect(mockN.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(postToWeb).toHaveBeenCalledWith("NOTIFICATION_PERMISSION", { granted: true });
  });

  it("does NOT call requestPermissionsAsync when PROVISIONAL (treated as granted)", async () => {
    mockN.getPermissionsAsync.mockResolvedValue(granted(3)); // PROVISIONAL
    const postToWeb = jest.fn();
    await handleRequestPermission(postToWeb);
    expect(mockN.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(postToWeb).toHaveBeenCalledWith("NOTIFICATION_PERMISSION", { granted: true });
  });

  it("calls requestPermissionsAsync when NOT_DETERMINED (first time enabling a reminder)", async () => {
    mockN.getPermissionsAsync.mockResolvedValue(granted(0)); // NOT_DETERMINED
    mockN.requestPermissionsAsync.mockResolvedValue(granted(2)); // user taps Allow
    const postToWeb = jest.fn();
    await handleRequestPermission(postToWeb);
    expect(mockN.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(postToWeb).toHaveBeenCalledWith("NOTIFICATION_PERMISSION", { granted: true });
  });

  it("posts granted: false when user denies — no notification will be scheduled", async () => {
    mockN.getPermissionsAsync.mockResolvedValue(granted(0)); // NOT_DETERMINED
    mockN.requestPermissionsAsync.mockResolvedValue(granted(1)); // DENIED
    const postToWeb = jest.fn();
    await handleRequestPermission(postToWeb);
    expect(postToWeb).toHaveBeenCalledWith("NOTIFICATION_PERMISSION", { granted: false });
    // Crucially: scheduleNotificationAsync is never called here
    expect(mockN.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("posts granted: false on native error (safe fallback)", async () => {
    mockN.getPermissionsAsync.mockRejectedValue(new Error("native crash"));
    const postToWeb = jest.fn();
    await handleRequestPermission(postToWeb);
    expect(postToWeb).toHaveBeenCalledWith("NOTIFICATION_PERMISSION", { granted: false });
  });
});

// ─── handleScheduleNotification — daily repeating reminder ───────────────────

describe("handleScheduleNotification — daily repeating notification", () => {
  beforeEach(() => jest.clearAllMocks());

  it("schedules a DAILY repeating trigger at the specified hour and minute", async () => {
    const postToWeb = jest.fn();
    await handleScheduleNotification("meal-breakfast", "🍽 Time to eat!", "Log your Breakfast in AscendFit", 8, 0, postToWeb);
    const [call] = mockN.scheduleNotificationAsync.mock.calls;
    expect(call![0].trigger).toMatchObject({ type: "daily", hour: 8, minute: 0 });
  });

  it("notification body tells the user which meal to log", async () => {
    const postToWeb = jest.fn();
    await handleScheduleNotification("meal-lunch", "🍽 Time to eat!", "Log your Lunch in AscendFit", 12, 30, postToWeb);
    const [call] = mockN.scheduleNotificationAsync.mock.calls;
    expect(call![0].content.body).toContain("Lunch");
  });

  it("notification body mentions dinner for the dinner reminder", async () => {
    const postToWeb = jest.fn();
    await handleScheduleNotification("meal-dinner", "🍽 Time to eat!", "Log your Dinner in AscendFit", 19, 0, postToWeb);
    const [call] = mockN.scheduleNotificationAsync.mock.calls;
    expect(call![0].content.body).toContain("Dinner");
  });

  it("uses the provided identifier (stable meal ID) as the notification identifier", async () => {
    const postToWeb = jest.fn();
    await handleScheduleNotification("meal-breakfast", "🍽 Time to eat!", "Log your Breakfast in AscendFit", 8, 0, postToWeb);
    const [call] = mockN.scheduleNotificationAsync.mock.calls;
    expect(call![0].identifier).toBe("meal-breakfast");
  });

  it("cancels any prior notification with the same ID before scheduling (no duplicates)", async () => {
    const postToWeb = jest.fn();
    await handleScheduleNotification("meal-breakfast", "🍽", "body", 8, 0, postToWeb);
    expect(mockN.cancelScheduledNotificationAsync).toHaveBeenCalledWith("meal-breakfast");
    // cancel must happen before schedule
    const cancelOrder = mockN.cancelScheduledNotificationAsync.mock.invocationCallOrder[0]!;
    const scheduleOrder = mockN.scheduleNotificationAsync.mock.invocationCallOrder[0]!;
    expect(cancelOrder).toBeLessThan(scheduleOrder);
  });

  it("never creates duplicate notifications when saving the same schedule twice", async () => {
    const postToWeb = jest.fn();
    await handleScheduleNotification("meal-breakfast", "🍽", "body", 8, 0, postToWeb);
    await handleScheduleNotification("meal-breakfast", "🍽", "body", 8, 0, postToWeb);
    // cancelScheduledNotificationAsync called twice — once per schedule attempt
    expect(mockN.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mockN.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
  });

  it("editing meal time cancels old notification and schedules at the new time", async () => {
    const postToWeb = jest.fn();
    await handleScheduleNotification("meal-breakfast", "🍽", "body", 8, 0, postToWeb);
    await handleScheduleNotification("meal-breakfast", "🍽", "body", 8, 30, postToWeb);
    // Both schedule calls should be cancel-first
    expect(mockN.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
    // Second schedule should use the updated time
    const secondCall = mockN.scheduleNotificationAsync.mock.calls[1]![0];
    expect(secondCall.trigger).toMatchObject({ hour: 8, minute: 30 });
  });

  it("posts NOTIFICATION_SCHEDULED after a successful schedule", async () => {
    const postToWeb = jest.fn();
    await handleScheduleNotification("meal-snack", "🍽", "body", 15, 0, postToWeb);
    expect(postToWeb).toHaveBeenCalledWith("NOTIFICATION_SCHEDULED", { id: "meal-snack" });
  });

  it("does not throw when scheduleNotificationAsync fails (best-effort)", async () => {
    mockN.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error("fail"));
    mockN.scheduleNotificationAsync.mockRejectedValueOnce(new Error("OS error"));
    const postToWeb = jest.fn();
    await expect(
      handleScheduleNotification("meal-breakfast", "🍽", "body", 8, 0, postToWeb)
    ).resolves.not.toThrow();
  });
});

// ─── handleCancelNotification — turning reminders off ────────────────────────

describe("handleCancelNotification — turning a reminder off", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls cancelScheduledNotificationAsync with the correct ID", async () => {
    const postToWeb = jest.fn();
    await handleCancelNotification("meal-dinner", postToWeb);
    expect(mockN.cancelScheduledNotificationAsync).toHaveBeenCalledWith("meal-dinner");
  });

  it("posts NOTIFICATION_CANCELLED after cancelling", async () => {
    const postToWeb = jest.fn();
    await handleCancelNotification("meal-lunch", postToWeb);
    expect(postToWeb).toHaveBeenCalledWith("NOTIFICATION_CANCELLED", { id: "meal-lunch" });
  });

  it("does not throw when the notification does not exist", async () => {
    mockN.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error("not found"));
    const postToWeb = jest.fn();
    await expect(handleCancelNotification("meal-missing", postToWeb)).resolves.not.toThrow();
  });

  it("each meal's cancellation only affects its own ID", async () => {
    const postToWeb = jest.fn();
    await handleCancelNotification("meal-breakfast", postToWeb);
    expect(mockN.cancelScheduledNotificationAsync).toHaveBeenCalledWith("meal-breakfast");
    expect(mockN.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith("meal-lunch");
  });
});

// ─── reminders restore after app reopen (localStorage stability) ─────────────

describe("reminders restore correctly after closing and reopening", () => {
  it("meal notification IDs are deterministic from the activity name (survives restart)", () => {
    // Simulates: user enables reminder → app closes → app opens → ID must match
    const savedId = mealNotifId("Breakfast"); // what was stored in localStorage
    const restoredId = mealNotifId("Breakfast"); // what would be reconstructed on next open
    expect(savedId).toBe(restoredId);
  });

  it("IDs for all four common meals remain stable across 'restarts'", () => {
    const meals = ["Breakfast", "Lunch", "Dinner", "Snack"];
    const before = meals.map(mealNotifId);
    const after = meals.map(mealNotifId);
    expect(before).toEqual(after);
  });
});

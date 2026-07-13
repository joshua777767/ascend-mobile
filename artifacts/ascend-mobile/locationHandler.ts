/**
 * Pure location permission handler extracted from webview.tsx for testability.
 * Uses expo-location to request the native iOS location permission dialog.
 */
import * as Location from "expo-location";

export type PostToWeb = (type: string, payload: unknown) => void;

/**
 * Handle REQUEST_LOCATION_PERMISSION bridge message.
 * Checks current status first; only prompts the user if not yet determined.
 */
export async function handleRequestLocationPermission(postToWeb: PostToWeb): Promise<void> {
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.granted) {
      postToWeb("LOCATION_PERMISSION", { granted: true });
      return;
    }
    const result = await Location.requestForegroundPermissionsAsync();
    postToWeb("LOCATION_PERMISSION", { granted: result.granted });
  } catch {
    postToWeb("LOCATION_PERMISSION", { granted: false });
  }
}

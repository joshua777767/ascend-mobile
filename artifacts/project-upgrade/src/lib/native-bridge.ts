declare global {
  interface Window {
    __ascendNative?: boolean;
    __ascendBridge?: (type: string, payload?: unknown) => void;
  }
}

/** True when the web app is running inside the native iOS WebView. */
export const isNative: boolean =
  typeof window !== "undefined" && !!window.__ascendNative;

/**
 * Send a message to the native shell.
 * No-op when not in the native WebView.
 */
export function sendToNative(type: string, payload?: unknown): void {
  if (typeof window !== "undefined" && typeof window.__ascendBridge === "function") {
    window.__ascendBridge(type, payload ?? null);
  }
}

/**
 * Listen for a message sent from the native shell.
 * Returns a cleanup function — call it in useEffect cleanup.
 * No-op (returns no-op cleanup) when not in native context.
 */
export function onFromNative(
  type: string,
  handler: (payload: unknown) => void
): () => void {
  if (typeof window === "undefined" || !isNative) return () => {};
  const listener = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(`__native:${type}`, listener);
  return () => window.removeEventListener(`__native:${type}`, listener);
}

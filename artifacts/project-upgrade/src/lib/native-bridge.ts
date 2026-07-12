import { useState, useEffect } from "react";

declare global {
  interface Window {
    __ascendNative?: boolean;
    __ascendBridge?: (type: string, payload?: unknown) => void;
  }
}

/** True when the web app is running inside the native iOS WebView. */
export const isNative: boolean =
  typeof window !== "undefined" && !!window.__ascendNative;

// ── Native subscription state (module-level, shared across all subscribers) ──
// Resets to false on every page load — cannot carry over from a previous session.
// _setNativeSub is called by NativeBridge when SUBSCRIPTION_STATUS arrives.
// useNativeSub subscribes any component to immediate re-renders on change.
let _nativeIsPro = false;
let _nativeSubResolved = false;
let _nativeAppUserId: string | null = null;
let _nativeEntitlementKeys: string[] = [];
let _nativeBuild: string | null = null;
const _nativeSubListeners = new Set<() => void>();

export function _setNativeSub(isPro: boolean, extra?: {
  appUserId?: string | null;
  activeEntitlementKeys?: string[];
  build?: string;
}): void {
  _nativeIsPro = isPro;
  _nativeSubResolved = true;
  if (extra?.appUserId !== undefined) _nativeAppUserId = extra.appUserId ?? null;
  if (extra?.activeEntitlementKeys !== undefined) _nativeEntitlementKeys = extra.activeEntitlementKeys;
  if (extra?.build !== undefined) _nativeBuild = extra.build ?? null;
  _nativeSubListeners.forEach((fn) => fn());
}

export function useNativeSub(): {
  isPro: boolean;
  resolved: boolean;
  appUserId: string | null;
  activeEntitlementKeys: string[];
  build: string | null;
} {
  const [, tick] = useState(0);
  useEffect(() => {
    const listener = () => tick((n) => n + 1);
    _nativeSubListeners.add(listener);
    return () => { _nativeSubListeners.delete(listener); };
  }, []);
  return {
    isPro: _nativeIsPro,
    resolved: _nativeSubResolved,
    appUserId: _nativeAppUserId,
    activeEntitlementKeys: _nativeEntitlementKeys,
    build: _nativeBuild,
  };
}

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

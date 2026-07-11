/**
 * Module-level bridge so SubscriptionContext.applyCustomerInfo() can post
 * messages to the WebView immediately — without waiting for a React effect
 * cycle or prop-drilling through the component tree.
 *
 * webview.tsx registers its postToWeb function here after each render.
 * SubscriptionContext calls postToWeb() from applyCustomerInfo() directly.
 */

let _postToWeb: ((type: string, payload: unknown) => void) | null = null;

/** Called by webview.tsx each render to keep the ref current. */
export function registerPostToWeb(
  fn: ((type: string, payload: unknown) => void) | null
): void {
  _postToWeb = fn;
}

/** Called by SubscriptionContext to immediately post a message to the WebView. */
export function postToWebFromNative(type: string, payload: unknown): void {
  _postToWeb?.(type, payload);
}

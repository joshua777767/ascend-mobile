---
name: WebView shell architecture
description: Native iOS app is a WKWebView wrapper around ascendfit.fitness; all feature screens removed; auth/camera/IAP bridged natively.
---

## The rule
The Ascend iOS app is a thin native shell. All feature UI lives at `https://ascendfit.fitness` and loads in a full-screen WKWebView. Native handles: RevenueCat/IAP (paywall), camera/ImagePicker, and subscription gating. Everything else is web.

## Bridge protocol
- Web → Native: `window.__ascendBridge(type, payload)` → calls `window.ReactNativeWebView.postMessage(JSON.stringify({type, payload}))`
- Native → Web: `webviewRef.injectJavaScript(...)` dispatches `CustomEvent('__native:TYPE', {detail: payload})`
- Utility helpers in `artifacts/project-upgrade/src/lib/native-bridge.ts`: `isNative`, `sendToNative(type, payload)`, `onFromNative(type, handler) → cleanup`

## Message types (web→native)
- `AUTH_STATE { userId }` — web logged in; native calls RC `logIn(userId)`
- `LOGOUT` — web logged out; native sets `userId = null`
- `REQUEST_CAMERA` — web wants a photo; native opens `launchCameraAsync`
- `REQUEST_IMAGE_LIBRARY` — web wants photo from library; native opens `launchImageLibraryAsync`
- `REQUEST_PAYWALL` — web wants to upgrade; native pushes `/paywall`

## Message types (native→web)
- `CAMERA_RESULT { dataUrl }` — base64 JPEG data URL from native camera
- `CAMERA_CANCELLED` — user dismissed camera
- `CAMERA_ERROR { message }` — permission denied or other error
- `SUBSCRIPTION_STATUS { isPro }` — native confirms Pro after IAP; web sets `sessionStorage('ascend.nativePro', '1')`

## AppGate logic
- No userId (user hasn't logged in via web) → show WebView (web shows its own login)
- userId + RC loading → show WebView (RC settling)
- userId + !isPro → push to native `/paywall`
- isPro + on paywall → replace to `/webview`

## /pricing intercept
`onShouldStartLoadWithRequest` in webview.tsx blocks any URL containing `/pricing` and pushes native paywall instead.

## Web app changes needed for native
- `ProtectedApp` in App.tsx: skip trial-expiry redirect when `isNative` (native paywall is the gate)
- `RevenueCatInit`: skip web RC init when `isNative` (native RC handles it)
- `NativeBridge` component in App.tsx: sends `AUTH_STATE` when `me` data loads; listens for `SUBSCRIPTION_STATUS`
- `meals.tsx`: camera buttons call `sendToNative('REQUEST_CAMERA')` when `isNative`; `onFromNative('CAMERA_RESULT')` sets imageData

## Web stub for native screens
Any native-only screen (e.g. webview.tsx uses react-native-webview) needs a `.web.tsx` sibling with a placeholder so Expo's web bundler doesn't crash. The real file is used on iOS; the `.web.tsx` stub is used for the web preview.

## react-native-webview version
Must be `13.15.0` (Expo 54 expected version). v14 has incompatible TypeScript types.

**Why:** The native WebView approach avoids duplicating the entire product in React Native. The web app is the source of truth for all features; native adds IAP and camera that can't be done in a browser.

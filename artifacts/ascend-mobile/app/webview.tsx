import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, StatusBar, StyleSheet, View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useUser } from "@/contexts/UserContext";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? "ascendfit.fitness"}`;
// Versioned so each native build fetches a fresh entry from WKWebView's cache.
// Bump _v whenever the web app has meaningful changes that must bypass stale cache.
const LAUNCH_URL = `${BASE_URL}/dashboard?_v=30`;

// Injected on every page load — sets up the bidirectional bridge
const BRIDGE_JS = `
(function() {
  if (window.__ascendNative) return; // already injected
  window.__ascendNative = true;

  // Web → Native
  window.__ascendBridge = function(type, payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload != null ? payload : null }));
    }
  };

  // Native → Web: native posts a JSON string, we dispatch it as a custom event
  window.addEventListener('message', function(e) {
    try {
      var msg = JSON.parse(typeof e.data === 'string' ? e.data : JSON.stringify(e.data));
      if (msg && msg.type) {
        window.dispatchEvent(new CustomEvent('__native:' + msg.type, { detail: msg.payload }));
      }
    } catch(err) {}
  });
})();
true;
`;

export default function WebViewScreen() {
  const webviewRef = useRef<WebView>(null);
  const { setUserId } = useUser();
  const { isPro, isLoading: rcLoading, packages, purchase, restore } = useSubscription();

  // True once the WebView has fired onLoadEnd for the first page load.
  const [webviewLoaded, setWebviewLoaded] = useState(false);

  // Refs so event handlers always read the latest values without stale closures.
  const isProRef = useRef(isPro);
  isProRef.current = isPro;
  const rcLoadingRef = useRef(rcLoading);
  rcLoadingRef.current = rcLoading;

  // The native loading overlay hides only when BOTH conditions are met:
  //   1. The WebView has finished loading the first page (onLoadEnd fired).
  //   2. RevenueCat has resolved (rcLoading is false).
  // This ensures the user never sees a blank WebView or a page that hasn't
  // yet received the SUBSCRIPTION_STATUS broadcast.
  const showOverlay = !webviewLoaded || rcLoading;

  const postToWeb = useCallback((type: string, payload: unknown) => {
    if (!webviewRef.current) return;
    webviewRef.current.injectJavaScript(
      `window.dispatchEvent(new CustomEvent('__native:${type}',{detail:${JSON.stringify(payload)}}));true;`
    );
  }, []);

  // Broadcast RC entitlement status to the web whenever RC resolves or changes.
  // Uses refs inside to get the latest isPro without a stale closure;
  // handleLoadEnd also re-posts after page load to cover the timing race where
  // RC resolves before the page is ready to receive events.
  useEffect(() => {
    if (rcLoading) return;
    postToWeb("SUBSCRIPTION_STATUS", { isPro });
  }, [rcLoading, isPro, postToWeb]);

  // Called when the WebView finishes loading a page.
  // Re-posts SUBSCRIPTION_STATUS using refs so the web always gets an authoritative
  // answer even if RC resolved before the page was ready to listen.
  const handleLoadEnd = useCallback(() => {
    setWebviewLoaded(true);
    if (!rcLoadingRef.current) {
      postToWeb("SUBSCRIPTION_STATUS", { isPro: isProRef.current });
    }
  }, [postToWeb]);

  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    let msg: { type: string; payload?: Record<string, unknown> };
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    switch (msg.type) {
      case "AUTH_STATE": {
        const uid = msg.payload?.userId;
        if (uid) setUserId(String(uid));
        break;
      }

      case "LOGOUT": {
        setUserId(null);
        break;
      }

      case "REQUEST_CAMERA": {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          postToWeb("CAMERA_ERROR", { message: "Camera permission denied" });
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.8,
          base64: true,
        });
        if (!result.canceled && result.assets[0]?.base64) {
          postToWeb("CAMERA_RESULT", {
            dataUrl: `data:image/jpeg;base64,${result.assets[0].base64}`,
          });
        } else {
          postToWeb("CAMERA_CANCELLED", {});
        }
        break;
      }

      case "REQUEST_IMAGE_LIBRARY": {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
          base64: true,
        });
        if (!result.canceled && result.assets[0]?.base64) {
          postToWeb("CAMERA_RESULT", {
            dataUrl: `data:image/jpeg;base64,${result.assets[0].base64}`,
          });
        } else {
          postToWeb("CAMERA_CANCELLED", {});
        }
        break;
      }

      case "REQUEST_PAYWALL": {
        // Trigger the RevenueCat purchase inline — Apple's StoreKit sheet
        // appears modally over the WebView. The website /pricing page is the
        // only visible paywall UI; no native screen is shown.
        const pkg = packages[0];
        if (!pkg) {
          // RC packages not loaded yet — tell the web so it can show a retry.
          postToWeb("PAYWALL_ERROR", {
            message: "Subscription unavailable. Please check your connection and try again.",
          });
          break;
        }
        try {
          const granted = await purchase(pkg);
          if (granted) {
            // Update gate state, then signal the web to navigate.
            // PURCHASE_CONFIRMED is only ever posted after a verified purchase —
            // never from the launch broadcast — so pricing.tsx can safely
            // navigate on it without false positives.
            postToWeb("SUBSCRIPTION_STATUS", { isPro: true });
            postToWeb("PURCHASE_CONFIRMED", {});
          }
          // If not granted (user cancelled) → stay on web pricing page.
        } catch (e: any) {
          // Surface purchase errors to the web so the user gets feedback.
          if (!e?.userCancelled) {
            postToWeb("PAYWALL_ERROR", {
              message: e?.message ?? "Purchase failed. Please try again.",
            });
          }
        }
        break;
      }

      case "REQUEST_MANAGE_SUBSCRIPTION": {
        // Open Apple's native subscription management page.
        const appleSubsUrl = "https://apps.apple.com/account/subscriptions";
        try {
          const supported = await Linking.canOpenURL(appleSubsUrl);
          if (supported) {
            await Linking.openURL(appleSubsUrl);
          } else {
            postToWeb("MANAGE_SUBSCRIPTION_FALLBACK", {
              message: "Manage your Ascend subscription in Settings → Apple Account → Subscriptions.",
            });
          }
        } catch {
          postToWeb("MANAGE_SUBSCRIPTION_FALLBACK", {
            message: "Manage your Ascend subscription in Settings → Apple Account → Subscriptions.",
          });
        }
        break;
      }

      case "REQUEST_RESTORE": {
        // Web "Restore Purchases" link → triggers RC restore natively.
        try {
          const restored = await restore();
          if (restored) {
            postToWeb("SUBSCRIPTION_STATUS", { isPro: true });
            postToWeb("PURCHASE_CONFIRMED", {});
          } else {
            postToWeb("RESTORE_FAILED", {
              message: "No active subscription found for your account.",
            });
          }
        } catch {
          postToWeb("RESTORE_FAILED", {
            message: "Restore failed. Please try again.",
          });
        }
        break;
      }
    }
  }, [setUserId, packages, purchase, restore, postToWeb]);

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={Platform.OS === "android"}
      />
      <WebView
        ref={webviewRef}
        source={{ uri: LAUNCH_URL }}
        style={styles.webview}
        injectedJavaScript={BRIDGE_JS}
        injectedJavaScriptBeforeContentLoaded={BRIDGE_JS}
        onMessage={handleMessage}
        onLoadEnd={handleLoadEnd}
        // Cookie / storage sharing
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        domStorageEnabled={true}
        javaScriptEnabled={true}
        // UX
        allowsBackForwardNavigationGestures={false}
        bounces={false}
        overScrollMode="never"
        // Safe area: the web app uses env(safe-area-inset-*) with viewport-fit=cover
        contentInsetAdjustmentBehavior="never"
        // Media
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
      />

      {/*
        Splash-matching overlay: shown from app open until the first page has
        loaded AND RevenueCat has resolved. Rendered on top of the WebView so
        the WebView can load underneath — no wasted time waiting behind a gate.
        Background (#080D12) matches the Expo splash for a seamless transition.
      */}
      {showOverlay && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080D12" },
  webview: { flex: 1, backgroundColor: "#080D12" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#080D12",
    alignItems: "center",
    justifyContent: "center",
  },
});

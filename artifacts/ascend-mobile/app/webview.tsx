import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { registerPostToWeb } from "@/contexts/webview-bridge";
import { useUser } from "@/contexts/UserContext";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? "ascendfit.fitness"}`;
// Versioned so each native build fetches a fresh entry from WKWebView's cache.
// Bump _v whenever the web app has meaningful changes that must bypass stale cache.
const LAUNCH_URL = `${BASE_URL}/dashboard?_v=31`;

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
  const { isPro, subscriptionResolved, appUserId, packages, purchase, restore, refresh, offeringsError, isLoading } = useSubscription();

  // True once the WebView has fired onLoadEnd for the first page load.
  const [webviewLoaded, setWebviewLoaded] = useState(false);

  // Refs so callbacks always read latest values without stale closures.
  const isProRef = useRef(isPro);
  isProRef.current = isPro;
  const appUserIdRef = useRef(appUserId);
  appUserIdRef.current = appUserId;
  const subscriptionResolvedRef = useRef(subscriptionResolved);
  subscriptionResolvedRef.current = subscriptionResolved;
  // Track last known entitlement keys for re-broadcast on page load.
  const activeEntitlementKeysRef = useRef<string[]>([]);

  // The native overlay hides once the WebView has finished loading.
  // RC resolution is no longer required to lift the overlay: the web gate
  // shows its own spinner while nativeSubResolved=false, so the user never
  // sees a LockedPaywall flash while RC is still identifying the user.
  const showOverlay = !webviewLoaded;

  const postToWeb = useCallback((type: string, payload: unknown) => {
    if (!webviewRef.current) return;
    webviewRef.current.injectJavaScript(
      `window.dispatchEvent(new CustomEvent('__native:${type}',{detail:${JSON.stringify(payload)}}));true;`
    );
  }, []);

  // Keep the module-level bridge current so SubscriptionContext.applyCustomerInfo()
  // can call postToWeb immediately (no React cycle delay) from the CustomerInfo
  // listener and from purchase/restore flows.
  useEffect(() => {
    registerPostToWeb(postToWeb);
    return () => registerPostToWeb(null);
  }, [postToWeb]);

  // Called when the WebView finishes loading a page.
  // Re-broadcasts the latest SUBSCRIPTION_STATUS so a page reload never loses
  // Pro state. Uses refs to read fresh values inside a stable callback.
  const handleLoadEnd = useCallback(() => {
    setWebviewLoaded(true);
    if (subscriptionResolvedRef.current) {
      postToWeb("SUBSCRIPTION_STATUS", {
        isPro: isProRef.current,
        appUserId: appUserIdRef.current,
        activeEntitlementKeys: activeEntitlementKeysRef.current,
        build: "d6c0e75a",
      });
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

      case "REQUEST_SUBSCRIPTION_STATUS": {
        // Web's NativeBridge sends this immediately after registering its
        // SUBSCRIPTION_STATUS listener to handle any timing race where native
        // already resolved before the listener was registered.
        // Respond with the current state if RC has already resolved.
        if (subscriptionResolvedRef.current) {
          postToWeb("SUBSCRIPTION_STATUS", {
            isPro: isProRef.current,
            appUserId: appUserIdRef.current,
            activeEntitlementKeys: activeEntitlementKeysRef.current,
            build: "d6c0e75a",
          });
        }
        // If RC is still resolving, the startup effect in SubscriptionContext
        // will call applyCustomerInfo() and post SUBSCRIPTION_STATUS when done.
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

      // REQUEST_PURCHASE is the canonical message name (spec-aligned).
      // REQUEST_PAYWALL is kept as a backward-compatible alias.
      case "REQUEST_PURCHASE":
      case "REQUEST_PAYWALL": {
        const pkg = packages[0];
        if (!pkg) {
          postToWeb("PAYWALL_ERROR", {
            message:
              "Subscription unavailable. Please check your connection and try again.",
          });
          break;
        }
        try {
          // purchase() calls applyCustomerInfo() internally, which posts
          // SUBSCRIPTION_STATUS + PURCHASE_CONFIRMED to the WebView.
          // No extra postToWeb calls needed here — they would be duplicates.
          await purchase(pkg);
        } catch (e: any) {
          if (!e?.userCancelled) {
            postToWeb("PAYWALL_ERROR", {
              message: e?.message ?? "Purchase failed. Please try again.",
            });
          }
        }
        break;
      }

      case "REQUEST_MANAGE_SUBSCRIPTION": {
        const appleSubsUrl = "https://apps.apple.com/account/subscriptions";
        try {
          const supported = await Linking.canOpenURL(appleSubsUrl);
          if (supported) {
            await Linking.openURL(appleSubsUrl);
          } else {
            postToWeb("MANAGE_SUBSCRIPTION_FALLBACK", {
              message:
                "Manage your Ascend subscription in Settings → Apple Account → Subscriptions.",
            });
          }
        } catch {
          postToWeb("MANAGE_SUBSCRIPTION_FALLBACK", {
            message:
              "Manage your Ascend subscription in Settings → Apple Account → Subscriptions.",
          });
        }
        break;
      }

      case "REQUEST_RESTORE": {
        try {
          // restore() calls applyCustomerInfo() internally, which posts
          // SUBSCRIPTION_STATUS + PURCHASE_CONFIRMED if Pro is active.
          const restored = await restore();
          if (!restored) {
            postToWeb("RESTORE_FAILED", {
              message: "No active Ascend Pro subscription was found.",
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
        loaded AND RevenueCat has resolved (subscriptionResolved=true). The
        WebView loads underneath so no startup time is wasted behind this gate.
        Background (#080D12) matches the Expo splash for a seamless transition.
      */}
      {showOverlay && (
        <View style={styles.overlay}>
          {!subscriptionResolved && !isLoading && offeringsError ? (
            <>
              <Text style={styles.errorText}>Could not verify subscription.{"\n"}Check your connection.</Text>
              <Pressable style={styles.retryButton} onPress={refresh}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator size="large" color="#F59E0B" />
          )}
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
    gap: 20,
  },
  errorText: {
    color: "#9CA3AF",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    fontFamily: "SpaceMono",
    paddingHorizontal: 32,
  },
  retryButton: {
    backgroundColor: "#F59E0B",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 36,
  },
  retryButtonText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
    fontFamily: "SpaceMono",
  },
});

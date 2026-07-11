import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import { Platform, StatusBar, StyleSheet, View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useUser } from "@/contexts/UserContext";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN ?? "ascendfit.fitness"}`;

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
  const router = useRouter();
  const { setUserId } = useUser();
  const { isPro } = useSubscription();
  const isPrevPro = useRef(isPro);

  // When Pro status becomes true (e.g. after purchase on another session),
  // notify the web app so it can skip its own trial-expiry redirect.
  useEffect(() => {
    if (isPro && !isPrevPro.current) {
      postToWeb("SUBSCRIPTION_STATUS", { isPro: true });
    }
    isPrevPro.current = isPro;
  }, [isPro]);

  const postToWeb = (type: string, payload: unknown) => {
    if (!webviewRef.current) return;
    webviewRef.current.injectJavaScript(
      `window.dispatchEvent(new CustomEvent('__native:${type}',{detail:${JSON.stringify(payload)}}));true;`
    );
  };

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
        router.push("/paywall");
        break;
      }
    }
  }, [setUserId, router]);

  // Intercept /pricing navigation → show native paywall instead
  const handleShouldStartLoad = useCallback((request: { url: string }) => {
    const url = request.url;
    if (
      url.includes("/pricing") &&
      !url.includes("/api/") &&
      !url.includes("?no_gate")
    ) {
      router.push("/paywall");
      return false;
    }
    return true;
  }, [router]);

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={Platform.OS === "android"}
      />
      <WebView
        ref={webviewRef}
        source={{ uri: BASE_URL }}
        style={styles.webview}
        injectedJavaScript={BRIDGE_JS}
        injectedJavaScriptBeforeContentLoaded={BRIDGE_JS}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0B1220" },
  webview: { flex: 1, backgroundColor: "#0B1220" },
});

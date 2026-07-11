import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
  useFonts,
} from "@expo-google-fonts/space-mono";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/LoadingScreen";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { SubscriptionProvider, useSubscription } from "@/contexts/SubscriptionContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Auth/subscription gate.
 *
 * - No userId → show WebView (web app shows its own login page)
 * - userId + RC loading → show WebView (brief; RC is still resolving)
 * - userId + !isPro → push to native paywall
 * - isPro + on paywall → return to WebView
 */
function AppGate({ children }: { children: React.ReactNode }) {
  const { isPro, isLoading } = useSubscription();
  const { userId } = useUser();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const seg0 = segments[0] as string | undefined;
    const onPaywall = seg0 === "paywall";
    const onDebug = seg0 === "debug-subscription";

    if (userId && !isPro) {
      if (!onPaywall && !onDebug) router.replace("/paywall");
    } else if (isPro && onPaywall) {
      router.replace("/webview");
    }
  }, [isPro, isLoading, userId, segments, router]);

  // Brief loading screen only during the initial RC check (anonymous).
  if (isLoading && !userId) return <LoadingScreen />;
  return <>{children}</>;
}

function RootLayoutNav() {
  const { userId } = useUser();
  return (
    <SubscriptionProvider userId={userId}>
      <AppGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="webview" options={{ animation: "none" }} />
          <Stack.Screen name="paywall" options={{ gestureEnabled: false }} />
          <Stack.Screen
            name="debug-subscription"
            options={{ presentation: "modal" }}
          />
          <Stack.Screen name="+not-found" />
        </Stack>
      </AppGate>
    </SubscriptionProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <UserProvider>
              <RootLayoutNav />
            </UserProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

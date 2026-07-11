import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
  useFonts,
} from "@expo-google-fonts/space-mono";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { SubscriptionProvider, useSubscription } from "@/contexts/SubscriptionContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Subscription context is still needed for RC configuration and purchase
 * triggering, but routing is handled entirely by the website. The WebView
 * manages its own loading overlay — no native loading screen blocks here.
 */
function RootLayoutNav() {
  const { userId } = useUser();
  return (
    <SubscriptionProvider userId={userId}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="webview" options={{ animation: "none" }} />
        <Stack.Screen
          name="debug-subscription"
          options={{ presentation: "modal" }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
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

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
import { LoadingScreen } from "@/components/LoadingScreen";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { SubscriptionProvider, useSubscription } from "@/contexts/SubscriptionContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Subscription context is still needed for RC configuration and purchase
 * triggering, but routing is now handled entirely by the website. The native
 * shell never navigates to a native paywall screen — the website's /pricing
 * page is the only paywall UI the user ever sees.
 */
function AppGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useSubscription();
  const { userId } = useUser();

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

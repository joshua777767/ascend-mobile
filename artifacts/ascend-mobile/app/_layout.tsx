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
import { View } from "react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { UserProvider, useUser } from "@/contexts/UserContext";
import { SubscriptionProvider, useSubscription } from "@/contexts/SubscriptionContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Wait until the persisted userId has been read from AsyncStorage before
 * mounting SubscriptionProvider. Without this guard, UserContext starts with
 * userId=null on every relaunch and SubscriptionProvider immediately calls
 * Purchases.logOut(), stripping RC entitlements until AUTH_STATE fires from
 * the WebView — causing a window where an active Pro user appears to have no
 * access.
 */
function RootLayoutNav() {
  const { userId, isLoaded } = useUser();

  if (!isLoaded) {
    // AsyncStorage resolves in <10 ms; show the app background while we wait
    // so there is no visible flash. SplashScreen is already down at this point
    // only when fonts finished loading, but in practice isLoaded is true first.
    return <View style={{ flex: 1, backgroundColor: "#080D12" }} />;
  }

  return (
    <SubscriptionProvider userId={userId}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="webview" options={{ animation: "none" }} />
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

import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
  useFonts,
} from "@expo-google-fonts/space-mono";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl, useGetUserProfile, getGetUserProfileQueryKey } from "@workspace/api-client-react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SubscriptionProvider, useSubscription } from "@/contexts/SubscriptionContext";
import { LoadingScreen } from "@/components/LoadingScreen";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AppGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { isPro, isLoading: subLoading } = useSubscription();
  const segments = useSegments();
  const router = useRouter();

  // Only query the profile once authenticated. retry:false so a 404 (no profile
  // yet) resolves immediately instead of retrying.
  const profileQuery = useGetUserProfile({
    query: {
      queryKey: getGetUserProfileQueryKey(),
      enabled: !!user,
      retry: false,
    },
  });

  useEffect(() => {
    if (authLoading) return;

    const seg0 = segments[0];
    const inAuth = seg0 === "login" || seg0 === "signup" || seg0 === "forgot-password" || seg0 === "reset-password";

    // Not signed in → login (allow login/signup screens through).
    if (!user) {
      if (!inAuth) router.replace("/login");
      return;
    }

    // Signed in — wait for profile + subscription state before routing.
    if (profileQuery.isLoading || subLoading) return;

    const profile404 = (profileQuery.error as any)?.status === 404;
    const hasProfile = !!profileQuery.data;
    const profileErrored = !!profileQuery.error && !profile404;

    const onOnboarding = seg0 === "onboarding";
    const onIntro = seg0 === "intro";
    const onPaywall = seg0 === "paywall";
    const onDebug = seg0 === "debug-subscription";

    // No profile yet → intro (first time) or onboarding (returning).
    if (!hasProfile && profile404) {
      if (!onOnboarding && !onIntro) router.replace("/intro");
      return;
    }

    // Transient (non-404) profile error → block rendering until resolved.
    // This prevents the gate from fail-open (allowing non-Pro users into tabs).
    if (profileErrored && !hasProfile) {
      const errStatus = (profileQuery.error as any)?.status;
      // 401 means session expired → force re-auth
      if (errStatus === 401) {
        router.replace("/login");
        return;
      }
      // Any other error → stay on loading screen (handled below)
      return;
    }

    // Has profile but not Pro → hard paywall gate.
    // Allow debug-subscription through so we can diagnose subscription issues.
    if (!isPro) {
      if (!onPaywall && !onDebug) router.replace("/paywall");
      return;
    }

    // Pro + profile → into the app; bounce off auth/onboarding/intro/paywall screens.
    if (inAuth || onOnboarding || onIntro || onPaywall) router.replace("/(tabs)");
  }, [
    user,
    authLoading,
    subLoading,
    isPro,
    profileQuery.isLoading,
    profileQuery.data,
    profileQuery.error,
    segments,
    router,
  ]);

  // Block rendering of any screen until auth AND (for signed-in users) the
  // profile + subscription state are resolved. Without this, (tabs) can render
  // for a frame before the gate redirects — letting a non-Pro user briefly
  // reach the app. The `!user` case falls through to the login redirect above.
  const resolving = !!user && (profileQuery.isLoading || subLoading);
  if (authLoading || resolving) return <LoadingScreen />;
  return <>{children}</>;
}

function RootLayoutNav() {
  const { user } = useAuth();
  return (
    <SubscriptionProvider userId={user ? String(user.id) : null}>
      <AppGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false, animation: "fade" }} />
          <Stack.Screen name="signup" options={{ headerShown: false, animation: "fade" }} />
          <Stack.Screen
            name="intro"
            options={{ headerShown: false, animation: "fade", gestureEnabled: false }}
          />
          <Stack.Screen
            name="onboarding"
            options={{ headerShown: false, animation: "fade", gestureEnabled: false }}
          />
          <Stack.Screen
            name="paywall"
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen name="settings" options={{ headerShown: false, presentation: "modal" }} />
          <Stack.Screen name="debug-subscription" options={{ headerShown: false, presentation: "modal" }} />
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
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <RootLayoutNav />
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

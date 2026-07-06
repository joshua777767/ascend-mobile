import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";

function openLink(path: string) {
  const url = `https://${DOMAIN}${path}`;
  WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
  });
}

const FEATURES = [
  { icon: "cpu", label: "AI-generated daily schedules" },
  { icon: "message-square", label: "Unlimited coach chat" },
  { icon: "activity", label: "Personalized workout plans" },
  { icon: "book-open", label: "Nightly journal & scoring" },
  { icon: "trending-up", label: "Weekly plan adjustments" },
  { icon: "camera", label: "Meal photo feedback" },
];

export default function PaywallScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isPro, isLoading, packages, offeringsError, purchase, restore, refresh } =
    useSubscription();
  const { logout } = useAuth();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // The first available package from the current offering. RevenueCat returns
  // packages in priority order; index 0 is always the primary product.
  const pkg = packages[0] ?? null;

  // Show the price from StoreKit if available, fall back to display string.
  const priceLabel =
    pkg?.product?.priceString ??
    pkg?.product?.price?.toFixed(2).replace(/^/, "$") ??
    "$19.99";

  const handlePurchase = async () => {
    if (!pkg) {
      // Packages not loaded — try refreshing first.
      Alert.alert(
        "Subscription unavailable",
        "Could not load subscription details. Please check your internet connection and try again.",
        [
          { text: "Retry", onPress: () => refresh() },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    setIsPurchasing(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const granted = await purchase(pkg);
      if (granted) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)");
      } else {
        // purchase() returned false without throwing = user cancelled
        // Stay on paywall, no alert needed.
      }
    } catch (e: any) {
      // Surface the real error to the user — never swallow silently.
      const message =
        e?.message ??
        "Something went wrong with the purchase. Please try again.";
      Alert.alert("Purchase failed", message, [{ text: "OK" }]);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const restored = await restore();
      if (restored) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Restored!", "Your subscription has been restored.", [
          { text: "Continue", onPress: () => router.replace("/(tabs)") },
        ]);
      } else {
        Alert.alert(
          "No active subscription found",
          "We couldn't find a subscription linked to your Apple ID. If you believe this is an error, contact support.",
          [{ text: "OK" }]
        );
      }
    } catch {
      Alert.alert(
        "Restore failed",
        "Something went wrong. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign out?", "You can sign back in anytime.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => logout() },
    ]);
  };

  const busy = isPurchasing || isRestoring;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#F59E0B33", "#080D12"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
      />

      {isPro && (
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 8 }]}
          onPress={() => router.replace("/(tabs)")}
        >
          <Feather name="x" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.crown,
              {
                backgroundColor: colors.primary + "22",
                borderColor: colors.primary + "44",
              },
            ]}
          >
            <Feather name="zap" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.headline, { color: colors.foreground }]}>
            Unlock Ascend Pro
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Your personal AI coach that learns and adapts to your life.
          </Text>
        </View>

        <View style={styles.featureList}>
          {FEATURES.map((f) => (
            <View key={f.label} style={styles.featureRow}>
              <View
                style={[
                  styles.featureIcon,
                  { backgroundColor: colors.primary + "1A" },
                ]}
              >
                <Feather
                  name={f.icon as any}
                  size={16}
                  color={colors.primary}
                />
              </View>
              <Text style={[styles.featureLabel, { color: colors.foreground }]}>
                {f.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Price card — show skeleton while loading, error banner if failed */}
        {isLoading ? (
          <View
            style={[
              styles.priceCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                justifyContent: "center",
                minHeight: 120,
              },
            ]}
          >
            <ActivityIndicator color={colors.primary} />
            <Text
              style={[
                styles.priceNote,
                { color: colors.mutedForeground, marginTop: 12 },
              ]}
            >
              Loading subscription details…
            </Text>
          </View>
        ) : offeringsError && !pkg ? (
          <View
            style={[
              styles.priceCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.destructive + "55",
                gap: 10,
              },
            ]}
          >
            <Feather name="alert-circle" size={20} color={colors.destructive} />
            <Text
              style={[
                styles.priceNote,
                { color: colors.destructive, textAlign: "center" },
              ]}
            >
              {offeringsError}
            </Text>
            <TouchableOpacity onPress={refresh}>
              <Text
                style={[
                  styles.priceNote,
                  { color: colors.primary, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                Tap to retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={[
              styles.priceCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.primary + "55",
              },
            ]}
          >
            <View
              style={[
                styles.trialBadge,
                {
                  backgroundColor: colors.primary + "22",
                  borderColor: colors.primary + "55",
                },
              ]}
            >
              <Text
                style={[styles.trialBadgeText, { color: colors.primary }]}
              >
                7-DAY FREE TRIAL
              </Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: colors.foreground }]}>
                {priceLabel}
              </Text>
              <Text style={[styles.pricePer, { color: colors.mutedForeground }]}>
                {" "}
                / month
              </Text>
            </View>
            <Text style={[styles.priceNote, { color: colors.mutedForeground }]}>
              Cancel anytime. Trial converts to {priceLabel}/month after 7 days
              unless canceled.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.ctaBtn,
            {
              backgroundColor: pkg ? colors.primary : colors.muted,
              opacity: busy ? 0.7 : 1,
            },
          ]}
          onPress={handlePurchase}
          disabled={busy || isLoading}
          activeOpacity={0.85}
        >
          {isPurchasing ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.ctaBtnText, { color: colors.primaryForeground }]}>
              {pkg ? "Start 7-Day Free Trial" : "Retry"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          disabled={busy}
        >
          {isRestoring ? (
            <ActivityIndicator size="small" color={colors.mutedForeground} />
          ) : (
            <Text style={[styles.restoreText, { color: colors.mutedForeground }]}>
              Restore Purchases
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => openLink("/terms")}>
            <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
              Terms of Use
            </Text>
          </TouchableOpacity>
          <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
            {"  •  "}
          </Text>
          <TouchableOpacity onPress={() => openLink("/privacy")}>
            <Text style={[styles.legalText, { color: colors.mutedForeground }]}>
              Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          disabled={busy}
        >
          <Text style={[styles.signOutText, { color: colors.mutedForeground }]}>
            Sign out
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  closeBtn: {
    position: "absolute",
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { paddingHorizontal: 24, alignItems: "center" },
  header: { alignItems: "center", marginBottom: 36 },
  crown: {
    width: 72,
    height: 72,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  headline: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  featureList: { width: "100%", gap: 12, marginBottom: 32 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  priceCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
  },
  trialBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  trialBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  priceRow: { flexDirection: "row", alignItems: "baseline" },
  price: { fontSize: 36, fontFamily: "Inter_700Bold" },
  pricePer: { fontSize: 16, fontFamily: "Inter_400Regular" },
  priceNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 18,
  },
  ctaBtn: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  ctaBtnText: { fontSize: 17, fontFamily: "Inter_700Bold" },
  restoreBtn: { paddingVertical: 12 },
  restoreText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  legalText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  signOutBtn: { paddingVertical: 8 },
  signOutText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
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
  const { packages, purchase, restore, isPro } = useSubscription();
  const { logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const pkg = packages[0];

  const priceString =
    pkg?.product?.priceString ??
    `$${((pkg?.product as any)?.price ?? 19.99).toFixed(2)}`;

  const handlePurchase = async () => {
    if (!pkg) {
      Alert.alert("Not available", "No subscription package found. Try again.");
      return;
    }
    setIsLoading(true);
    try {
      const success = await purchase(pkg);
      if (success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      Alert.alert("Purchase failed", e?.message ?? "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const success = await restore();
      if (success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Restored!", "Your subscription has been restored.", [
          { text: "OK", onPress: () => router.replace("/(tabs)") },
        ]);
      } else {
        Alert.alert("No subscription found", "We couldn't find an active subscription to restore.");
      }
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

  const busy = isLoading || isRestoring;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#F59E0B33", "#080D12"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
      />

      {/* Only Pro users (rare — the gate normally redirects them out) can close. */}
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
          <View style={[styles.crown, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
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
              <View style={[styles.featureIcon, { backgroundColor: colors.primary + "1A" }]}>
                <Feather name={f.icon as any} size={16} color={colors.primary} />
              </View>
              <Text style={[styles.featureLabel, { color: colors.foreground }]}>{f.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.priceCard, { backgroundColor: colors.card, borderColor: colors.primary + "55" }]}>
          <View style={[styles.trialBadge, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "55" }]}>
            <Text style={[styles.trialBadgeText, { color: colors.primary }]}>7-DAY FREE TRIAL</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.foreground }]}>{priceString}</Text>
            <Text style={[styles.pricePer, { color: colors.mutedForeground }]}> / month</Text>
          </View>
          <Text style={[styles.priceNote, { color: colors.mutedForeground }]}>
            Cancel anytime. Trial converts to {priceString}/month after 7 days unless canceled.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }]}
          onPress={handlePurchase}
          disabled={busy}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.ctaBtnText, { color: colors.primaryForeground }]}>
              Start 7-Day Free Trial
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

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} disabled={busy}>
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
  trialBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  priceRow: { flexDirection: "row", alignItems: "baseline" },
  price: { fontSize: 36, fontFamily: "Inter_700Bold" },
  pricePer: { fontSize: 16, fontFamily: "Inter_400Regular" },
  priceNote: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8, textAlign: "center", lineHeight: 18 },
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
  signOutBtn: { paddingVertical: 8 },
  signOutText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});

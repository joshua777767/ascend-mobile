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
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const pkg = packages[0];

  const priceString =
    pkg?.product?.priceString ??
    `$${((pkg?.product as any)?.price ?? 9.99).toFixed(2)}`;

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
        router.back();
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
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert("No subscription found", "We couldn't find an active subscription to restore.");
      }
    } finally {
      setIsRestoring(false);
    }
  };

  if (isPro) {
    router.back();
    return null;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#F59E0B33", "#080D12"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.6 }}
      />

      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 8 }]}
        onPress={() => router.back()}
      >
        <Feather name="x" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>

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
          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.foreground }]}>{priceString}</Text>
            <Text style={[styles.pricePer, { color: colors.mutedForeground }]}> / month</Text>
          </View>
          <Text style={[styles.priceNote, { color: colors.mutedForeground }]}>
            Cancel anytime. No commitment.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]}
          onPress={handlePurchase}
          disabled={isLoading || isRestoring}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.ctaBtnText, { color: colors.primaryForeground }]}>
              Start My Transformation
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          disabled={isLoading || isRestoring}
        >
          {isRestoring ? (
            <ActivityIndicator size="small" color={colors.mutedForeground} />
          ) : (
            <Text style={[styles.restoreText, { color: colors.mutedForeground }]}>
              Restore Purchases
            </Text>
          )}
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
  priceRow: { flexDirection: "row", alignItems: "baseline" },
  price: { fontSize: 36, fontFamily: "Inter_700Bold" },
  pricePer: { fontSize: 16, fontFamily: "Inter_400Regular" },
  priceNote: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
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
});

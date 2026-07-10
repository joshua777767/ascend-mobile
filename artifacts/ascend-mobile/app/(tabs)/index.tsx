import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { StatCard } from "@/components/StatCard";
import { SectionHeader } from "@/components/SectionHeader";
import { ProBadge } from "@/components/ProBadge";
import { useColors } from "@/hooks/useColors";
import {
  useGetCurrentPlan,
  useGetStreak,
  useListMeals,
  useGetWaterToday,
  useLogWater,
  getGetWaterTodayQueryKey,
} from "@workspace/api-client-react";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const queryClient = useQueryClient();

  const { data: plan, isLoading: planLoading, refetch: refetchPlan } = useGetCurrentPlan();
  const { data: streak, refetch: refetchStreak } = useGetStreak();
  const { data: mealsData, refetch: refetchMeals } = useListMeals();
  const { data: waterData, refetch: refetchWater } = useGetWaterToday();
  const logWater = useLogWater();

  const recentMeals = (mealsData as any) ?? [];
  const isLoading = planLoading;

  const refetch = () => {
    refetchPlan();
    refetchStreak();
    refetchMeals();
    refetchWater();
  };

  const todayCalories = recentMeals
    .filter((m: any) => isToday(m.createdAt))
    .reduce((sum: number, m: any) => sum + (m.calories ?? 0), 0);
  const todayProtein = recentMeals
    .filter((m: any) => isToday(m.createdAt))
    .reduce((sum: number, m: any) => sum + (m.protein ?? 0), 0);

  const waterTotalOz: number = (waterData as any)?.totalOz ?? 0;
  const waterTargetOz: number = (waterData as any)?.targetOz ?? 64;
  const waterGlasses = Math.round(waterTotalOz / 8);
  const waterTargetGlasses = Math.round(waterTargetOz / 8);

  const handleLogWater = async (amountOz: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const updated = await logWater.mutateAsync({ data: { amountOz } });
      // Write the mutation response straight into the query cache so the
      // displayed total updates immediately without a separate network request.
      queryClient.setQueryData(getGetWaterTodayQueryKey(), updated);
    } catch {
      // Silently ignore — a background refetch will correct the state.
      refetchWater();
    }
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      <View style={styles.topRow}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            Good {getGreeting()},
          </Text>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]}>
              {user?.username ?? "Coach"}
            </Text>
            {isPro && <ProBadge />}
          </View>
        </View>
        <TouchableOpacity onPress={() => router.push("/settings")} style={styles.logoutBtn}>
          <Feather name="settings" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.emergencyBanner, { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "33" }]}
        onPress={() => router.push("/settings")}
        activeOpacity={0.8}
      >
        <Feather name="alert-octagon" size={12} color={colors.destructive} />
        <Text style={[styles.emergencyText, { color: colors.destructive }]}>
          Chest pain, dizziness, or trouble breathing? Stop and call emergency services immediately.
        </Text>
      </TouchableOpacity>

      {streak && (
        <View style={[styles.streakBanner, { backgroundColor: colors.primary + "1A", borderColor: colors.primary + "44" }]}>
          <Feather name="zap" size={18} color={colors.primary} />
          <Text style={[styles.streakText, { color: colors.primary }]}>
            {(streak as any).currentStreak ?? (streak as any).streak ?? 0} day streak
          </Text>
          <Text style={[styles.streakSub, { color: colors.mutedForeground }]}> · Keep it going!</Text>
        </View>
      )}

      {plan && (
        <>
          <SectionHeader title="Today's Goals" />
          <View style={styles.statsRow}>
            <StatCard
              label="Calories"
              value={`${todayCalories}`}
              unit={`/ ${(plan as any).dailyCalorieTarget ?? "—"}`}
              color={colors.amber}
            />
            <StatCard
              label="Protein"
              value={`${todayProtein}g`}
              unit={`/ ${(plan as any).dailyProteinTarget ?? "—"}g`}
              color={colors.blue}
            />
          </View>

          {/* Water tracker card */}
          <View style={[styles.waterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.waterCardTop}>
              <View style={styles.waterCardLabel}>
                <View style={[styles.waterIcon, { backgroundColor: colors.blue + "22" }]}>
                  <Feather name="droplet" size={16} color={colors.blue} />
                </View>
                <View>
                  <Text style={[styles.waterTitle, { color: colors.foreground }]}>Water Intake</Text>
                  <Text style={[styles.waterSub, { color: colors.mutedForeground }]}>
                    {waterGlasses} / {waterTargetGlasses} glasses · {waterTotalOz} / {waterTargetOz} oz
                  </Text>
                </View>
              </View>
              {logWater.isPending && (
                <ActivityIndicator size="small" color={colors.blue} />
              )}
            </View>

            {/* Progress bar */}
            <View style={[styles.waterTrack, { backgroundColor: colors.muted }]}>
              <View
                style={[
                  styles.waterFill,
                  {
                    backgroundColor: colors.blue,
                    width: `${Math.min(100, Math.round((waterTotalOz / waterTargetOz) * 100))}%` as any,
                  },
                ]}
              />
            </View>

            {/* Quick-add buttons */}
            <View style={styles.waterBtns}>
              <TouchableOpacity
                style={[styles.waterBtn, { backgroundColor: colors.blue + "18", borderColor: colors.blue + "44" }]}
                onPress={() => handleLogWater(8)}
                disabled={logWater.isPending}
                activeOpacity={0.75}
              >
                <Feather name="plus" size={14} color={colors.blue} />
                <Text style={[styles.waterBtnText, { color: colors.blue }]}>1 glass</Text>
                <Text style={[styles.waterBtnSub, { color: colors.blue + "99" }]}>8 oz</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.waterBtn, { backgroundColor: colors.blue + "18", borderColor: colors.blue + "44" }]}
                onPress={() => handleLogWater(16)}
                disabled={logWater.isPending}
                activeOpacity={0.75}
              >
                <Feather name="plus" size={14} color={colors.blue} />
                <Text style={[styles.waterBtnText, { color: colors.blue }]}>2 glasses</Text>
                <Text style={[styles.waterBtnSub, { color: colors.blue + "99" }]}>16 oz</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.waterBtn, { backgroundColor: colors.blue + "18", borderColor: colors.blue + "44" }]}
                onPress={() => handleLogWater(24)}
                disabled={logWater.isPending}
                activeOpacity={0.75}
              >
                <Feather name="plus" size={14} color={colors.blue} />
                <Text style={[styles.waterBtnText, { color: colors.blue }]}>3 glasses</Text>
                <Text style={[styles.waterBtnSub, { color: colors.blue + "99" }]}>24 oz</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      <View style={styles.section}>
        <SectionHeader title="Quick Actions" />
        <View style={styles.actionsGrid}>
          <ActionCard icon="plus-circle" label="Log Meal" color={colors.green} onPress={() => router.push("/(tabs)/meals")} colors={colors} />
          <ActionCard icon="calendar" label="Schedule" color={colors.blue} onPress={() => router.push("/(tabs)/schedule")} colors={colors} />
          <ActionCard icon="message-square" label="Coach Chat" color={colors.purple} onPress={() => router.push("/(tabs)/coach")} colors={colors} />
          <ActionCard icon="bar-chart-2" label="Progress" color={colors.amber} onPress={() => router.push("/(tabs)/progress")} colors={colors} />
        </View>
      </View>

      {recentMeals.length > 0 && (
        <View style={styles.section}>
          <SectionHeader
            title="Recent Meals"
            action={{ label: "See all", onPress: () => router.push("/(tabs)/meals") }}
          />
          {recentMeals.slice(0, 3).map((meal: any, i: number) => (
            <View key={meal.id ?? i} style={[styles.mealRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.mealDot, { backgroundColor: getMealColor(meal.mealType, colors) }]} />
              <View style={styles.mealInfo}>
                <Text style={[styles.mealName, { color: colors.foreground }]} numberOfLines={1}>
                  {meal.description ?? meal.mealType}
                </Text>
                <Text style={[styles.mealMeta, { color: colors.mutedForeground }]}>
                  {meal.calories ? `${meal.calories} kcal` : meal.mealType}
                </Text>
              </View>
              {meal.aiFeedback && <Feather name="check-circle" size={16} color={colors.green} />}
            </View>
          ))}
        </View>
      )}

      {!isPro && (
        <TouchableOpacity
          style={[styles.upgradeCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "44" }]}
          onPress={() => router.push("/paywall")}
          activeOpacity={0.85}
        >
          <Feather name="zap" size={20} color={colors.primary} />
          <View style={styles.upgradeText}>
            <Text style={[styles.upgradeTitle, { color: colors.primary }]}>Unlock Ascend Pro</Text>
            <Text style={[styles.upgradeSub, { color: colors.mutedForeground }]}>
              AI coaching, meal feedback & more
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.primary} />
        </TouchableOpacity>
      )}

      {/* Legal footer */}
      <View style={styles.legalFooter}>
        <TouchableOpacity onPress={() => router.push("/settings")}>
          <Text style={[styles.legalLink, { color: colors.mutedForeground }]}>Terms</Text>
        </TouchableOpacity>
        <Text style={[styles.legalDot, { color: colors.mutedForeground }]}>·</Text>
        <TouchableOpacity onPress={() => router.push("/settings")}>
          <Text style={[styles.legalLink, { color: colors.mutedForeground }]}>Privacy</Text>
        </TouchableOpacity>
        <Text style={[styles.legalDot, { color: colors.mutedForeground }]}>·</Text>
        <Text style={[styles.legalNote, { color: colors.mutedForeground }]}>Not medical advice</Text>
      </View>
    </ScrollView>
  );
}

function ActionCard({
  icon, label, color, onPress, colors,
}: {
  icon: string; label: string; color: string; onPress: () => void; colors: any;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.actionIcon, { backgroundColor: color + "22" }]}>
        <Feather name={icon as any} size={22} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function isToday(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function getMealColor(type: string, colors: any) {
  switch (type?.toLowerCase()) {
    case "breakfast": return colors.amber;
    case "lunch": return colors.green;
    case "dinner": return colors.blue;
    default: return colors.purple;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20 },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 22, fontFamily: "Inter_700Bold" },
  logoutBtn: { padding: 8 },
  emergencyBanner: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 20 },
  emergencyText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 16 },
  streakBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 24 },
  streakText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  streakSub: { fontSize: 14, fontFamily: "Inter_400Regular" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  waterCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 28, gap: 12 },
  waterCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  waterCardLabel: { flexDirection: "row", alignItems: "center", gap: 10 },
  waterIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  waterTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  waterSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  waterTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  waterFill: { height: 6, borderRadius: 3 },
  waterBtns: { flexDirection: "row", gap: 8 },
  waterBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 10, borderWidth: 1, paddingVertical: 10 },
  waterBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  waterBtnSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  section: { marginBottom: 28 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionCard: { width: "47%", borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  mealRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14, gap: 12, marginBottom: 8 },
  mealDot: { width: 10, height: 10, borderRadius: 5 },
  mealInfo: { flex: 1 },
  mealName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  mealMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  upgradeCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, borderWidth: 1.5, padding: 18, marginTop: 4 },
  upgradeText: { flex: 1 },
  upgradeTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  upgradeSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  legalFooter: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 20, marginTop: 8 },
  legalLink: { fontSize: 11, fontFamily: "Inter_400Regular", opacity: 0.6 },
  legalDot: { fontSize: 11, opacity: 0.3 },
  legalNote: { fontSize: 11, fontFamily: "Inter_400Regular", opacity: 0.4 },
});

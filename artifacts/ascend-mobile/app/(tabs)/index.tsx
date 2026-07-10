import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { ProBadge } from "@/components/ProBadge";
import { useColors } from "@/hooks/useColors";
import {
  useGetCurrentPlan,
  useGetStreak,
  useListMeals,
  useGetWaterToday,
  useLogWater,
  useGetDailyScore,
  useListWeighIns,
  useGetTodayWorkout,
  useGetProgressSummary,
  useGetUserProfile,
  getGetWaterTodayQueryKey,
} from "@workspace/api-client-react";

// ─── Habit deduplication / prioritization ─────────────────────────────────────

const HABIT_FAMILIES: Array<{ family: string; keywords: string[] }> = [
  { family: "calorie",  keywords: ["calorie", "caloric", "deficit", "surplus", "kcal"] },
  { family: "protein",  keywords: ["protein", "macro"] },
  { family: "water",    keywords: ["water", "hydrat", "drink"] },
  { family: "log",      keywords: ["log", "track", "scan", "meal"] },
  { family: "train",    keywords: ["train", "workout", "gym", "exercise", "lift", "strength", "cardio", "run", "recover", "recovery", "rest day", "sport", "practice"] },
  { family: "sleep",    keywords: ["sleep", "bed", "night", "wake"] },
  { family: "skin",     keywords: ["skin", "face", "moistur", "spf", "sunscreen"] },
  { family: "mindset",  keywords: ["stress", "meditat", "breath", "journal", "gratitude", "focus"] },
  { family: "steps",    keywords: ["step", "walk", "10k", "active"] },
];

function habitFamily(habit: string): string {
  const lower = habit.toLowerCase();
  for (const { family, keywords } of HABIT_FAMILIES) {
    if (keywords.some((k) => lower.includes(k))) return family;
  }
  return `other:${habit}`;
}

function habitPriorityScore(habit: string): number {
  const lower = habit.toLowerCase();
  for (let i = 0; i < HABIT_FAMILIES.length; i++) {
    if (HABIT_FAMILIES[i].keywords.some((k) => lower.includes(k))) return i;
  }
  return HABIT_FAMILIES.length;
}

function prioritizeHabits(rawHabits: string[]): string[] {
  const byFamily = new Map<string, string>();
  for (const h of rawHabits) {
    const fam = habitFamily(h);
    const existing = byFamily.get(fam);
    if (!existing || h.length < existing.length) byFamily.set(fam, h);
  }
  return Array.from(byFamily.values())
    .sort((a, b) => habitPriorityScore(a) - habitPriorityScore(b))
    .slice(0, 5);
}

// ─── Score Ring (SVG, matches web conic-gradient intent) ──────────────────────

function ScoreRing({ score, size = 80, colors }: { score: number; size?: number; colors: any }) {
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const offset = circumference * (1 - pct);
  const ringColor = score >= 80 ? colors.green : score >= 50 ? colors.blue : colors.amber;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={6} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={ringColor} strokeWidth={6} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: ringColor, lineHeight: 22 }}>{score}</Text>
      <Text style={{ fontSize: 7, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginTop: 1 }}>Score</Text>
    </View>
  );
}

// ─── Intake Bar (matches web IntakeBar component) ──────────────────────────────

function IntakeBar({ icon, label, eaten, target, unit, color, colors }: {
  icon: string; label: string; eaten: number; target: number; unit?: string; color: string; colors: any;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((eaten / target) * 100)) : 0;
  return (
    <View style={[ib.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={ib.top}>
        <View style={[ib.iconWrap, { backgroundColor: color + "22" }]}>
          <Feather name={icon as any} size={14} color={color} />
        </View>
        <Text style={[ib.label, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[ib.pct, { color: colors.mutedForeground }]}>{pct}%</Text>
      </View>
      <Text style={[ib.value, { color: colors.foreground }]}>
        {eaten.toLocaleString()}
        <Text style={[ib.unit, { color: colors.mutedForeground }]}>
          {unit ?? ""} / {target.toLocaleString()}{unit ?? ""}
        </Text>
      </Text>
      <View style={[ib.track, { backgroundColor: colors.muted }]}>
        <View style={[ib.fill, { backgroundColor: color, width: `${pct}%` as any }]} />
      </View>
    </View>
  );
}

const ib = StyleSheet.create({
  card: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14 },
  top: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  iconWrap: { width: 28, height: 28, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, fontSize: 10, fontFamily: "Inter_500Medium" },
  pct: { fontSize: 10, fontFamily: "Inter_400Regular" },
  value: { fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 22, marginBottom: 10 },
  unit: { fontSize: 12, fontFamily: "Inter_400Regular" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
});

// ─── Metric Card (web MetricCard, used in Targets row) ────────────────────────

function MetricCard({ icon, value, unit, label, color, colors }: {
  icon: string; value: string | number; unit?: string; label: string; color: string; colors: any;
}) {
  return (
    <View style={[mc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[mc.iconWrap, { backgroundColor: color + "22" }]}>
        <Feather name={icon as any} size={14} color={color} />
      </View>
      <Text style={[mc.value, { color: colors.foreground }]}>
        {value}
        {unit ? <Text style={[mc.unit, { color: colors.mutedForeground }]}>{unit}</Text> : null}
      </Text>
      <Text style={[mc.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const mc = StyleSheet.create({
  card: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  value: { fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 22 },
  unit: { fontSize: 12, fontFamily: "Inter_400Regular" },
  label: { fontSize: 10, fontFamily: "Inter_500Medium" },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function isToday(dateStr?: string) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function getPhaseLabel(goalType?: string) {
  if (goalType === "fat_loss") return "Cut Phase";
  if (goalType === "muscle_gain") return "Build Phase";
  if (goalType === "maintain") return "Maintenance";
  if (goalType === "recomp") return "Recomp Phase";
  return "Maintenance";
}

function getChecklistKey() {
  const d = new Date();
  return `ascend.checklist.${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const queryClient = useQueryClient();

  const { data: profileData, refetch: refetchProfile } = useGetUserProfile();
  const { data: plan, isLoading: planLoading, refetch: refetchPlan } = useGetCurrentPlan();
  const { data: streak, refetch: refetchStreak } = useGetStreak();
  const { data: mealsData, refetch: refetchMeals } = useListMeals();
  const { data: waterData, refetch: refetchWater } = useGetWaterToday();
  const { data: dailyScoreData, refetch: refetchScore } = useGetDailyScore();
  const { data: todayWorkoutData, refetch: refetchWorkout } = useGetTodayWorkout();
  const { data: progressData } = useGetProgressSummary();
  const logWater = useLogWater();

  const profile = profileData as any;
  const todayWorkout = todayWorkoutData as any;
  const progress = progressData as any;

  const recentMeals = (mealsData as any) ?? [];
  const isLoading = planLoading;
  const dailyScore = (dailyScoreData as any)?.totalScore ?? 0;

  // Derive plan fields
  const planAny = plan as any;
  const goalType = planAny?.goalType;
  const isMaintenance = goalType === "maintain";
  const isBulking = goalType === "muscle_gain";
  const isCutting = goalType === "fat_loss";
  const dayNumber = Math.max(1, Math.floor((Date.now() - new Date((profile?.createdAt ?? Date.now())).getTime()) / 86400000) + 1);

  // Habits from plan.keyHabits (already deduped + prioritized)
  const rawKeyHabits: string[] = planAny && Array.isArray(planAny.keyHabits) ? planAny.keyHabits : [];
  const habits = prioritizeHabits(rawKeyHabits);

  // Today's macro totals from meals
  const todayMeals = recentMeals.filter((m: any) => isToday(m.loggedAt));
  const todayCalories = todayMeals.reduce((s: number, m: any) => s + (m.calories ?? 0), 0);
  const todayProtein = todayMeals.reduce((s: number, m: any) => s + (m.protein ?? 0), 0);

  // Water
  const waterTotalOz: number = (waterData as any)?.totalOz ?? 0;
  const waterTargetOz: number = (waterData as any)?.targetOz ?? 64;

  // Daily checklist state — persisted via AsyncStorage keyed by today's date
  const checklistKeyRef = useRef(getChecklistKey());
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [checklistLoaded, setChecklistLoaded] = useState(false);

  useEffect(() => {
    const key = checklistKeyRef.current;
    AsyncStorage.getItem(key).then(raw => {
      if (raw) { try { setDone(JSON.parse(raw)); } catch {} }
      setChecklistLoaded(true);
    });
  }, []);

  const saveChecklist = useCallback((next: Record<string, boolean>) => {
    AsyncStorage.setItem(checklistKeyRef.current, JSON.stringify(next)).catch(() => {});
  }, []);

  const toggleHabit = async (habit: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDone(prev => {
      const next = { ...prev, [habit]: !prev[habit] };
      saveChecklist(next);
      return next;
    });
  };

  const checklistCompleted = habits.filter(h => done[h]).length;
  const missionComplete = habits.length > 0 && checklistCompleted === habits.length;

  // Water: auto-check water habit when target met
  useEffect(() => {
    if (waterTotalOz > 0 && waterTargetOz > 0 && waterTotalOz >= waterTargetOz) {
      const waterHabit = habits.find(h => h.toLowerCase().includes("water"));
      if (waterHabit && !done[waterHabit] && checklistLoaded) {
        setDone(prev => {
          const next = { ...prev, [waterHabit]: true };
          saveChecklist(next);
          return next;
        });
      }
    }
  }, [waterTotalOz, waterTargetOz, checklistLoaded]); // eslint-disable-line

  // Calorie/protein auto-check
  useEffect(() => {
    if (!planAny || !checklistLoaded) return;
    if (todayCalories > 0 && todayCalories >= planAny.calorieTarget) {
      const h = habits.find(h => ["calorie", "caloric", "deficit", "kcal"].some(k => h.toLowerCase().includes(k)));
      if (h && !done[h]) setDone(prev => { const n = { ...prev, [h]: true }; saveChecklist(n); return n; });
    }
    if (todayProtein > 0 && todayProtein >= planAny.proteinTargetG) {
      const h = habits.find(h => ["protein", "macro"].some(k => h.toLowerCase().includes(k)));
      if (h && !done[h]) setDone(prev => { const n = { ...prev, [h]: true }; saveChecklist(n); return n; });
    }
  }, [todayCalories, todayProtein, checklistLoaded]); // eslint-disable-line

  // Custom water input
  const [customWaterOz, setCustomWaterOz] = useState("");
  const [showCustomWater, setShowCustomWater] = useState(false);

  const handleLogWater = async (amountOz: number) => {
    if (amountOz <= 0) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const updated = await logWater.mutateAsync({ data: { amountOz } });
      queryClient.setQueryData(getGetWaterTodayQueryKey(), updated);
    } catch { refetchWater(); }
  };

  const handleCustomWater = () => {
    const oz = parseFloat(customWaterOz);
    if (!customWaterOz.trim() || isNaN(oz) || oz <= 0) {
      Alert.alert("Invalid amount", "Enter a number greater than 0.");
      return;
    }
    setCustomWaterOz("");
    setShowCustomWater(false);
    handleLogWater(oz);
  };

  const refetch = () => { refetchPlan(); refetchStreak(); refetchMeals(); refetchWater(); refetchScore(); refetchWorkout(); refetchProfile(); };

  // Status badge
  const hasAnyData = todayCalories > 0 || todayProtein > 0 || waterTotalOz > 0 || checklistCompleted > 0;
  const statusBadge = (() => {
    if (!hasAnyData) return null;
    if (dailyScore >= 90) return { text: "Perfect Day", color: colors.green, bg: colors.green + "1A" };
    if (dailyScore >= 65) return { text: "Locked In", color: colors.blue, bg: colors.blue + "1A" };
    if (dailyScore >= 30) return { text: "Building Momentum", color: colors.amber, bg: colors.amber + "1A" };
    return { text: "Comeback Day", color: colors.amber, bg: colors.amber + "15" };
  })();

  // Coach message (mirrors web buildMission)
  const firstName = (profile?.name ?? user?.username ?? "")?.split(" ")[0] || "Coach";
  const calorieDeficit = planAny ? planAny.calorieTarget - todayCalories : 0;
  const proteinDeficit = planAny ? planAny.proteinTargetG - todayProtein : 0;
  const coachMessage = (() => {
    if (missionComplete) return "Day stacked. Every choice you made today built something real.";
    if (isMaintenance && planAny) {
      if (proteinDeficit > 30) return `${proteinDeficit}g protein still to go. Hit your target — protein is what keeps you strong.`;
      return `${firstName}, consistency is the goal. Train, eat well, drink water, protect your sleep.`;
    }
    if (planAny && calorieDeficit > 500) return `You're ${calorieDeficit} calories behind. Fuel up. Every meal counts.`;
    if (planAny && proteinDeficit > 30) return `${proteinDeficit}g protein short. Make the next meal count. You're building.`;
    if (isBulking && planAny) return `${firstName}, you're building. Hit ${planAny.calorieTarget?.toLocaleString()} calories today. Every meal is a choice.`;
    if (isCutting && planAny) return `${firstName}, stay focused: protein, steps, water, clean tracking. Your next move matters.`;
    return planAny?.coachNotes?.trim()?.split(".")?.[0] + "." || "Protein, movement, water, sleep. Small choices, big change.";
  })();

  const nextAction = (() => {
    if (todayMeals.length === 0) return "Next: log your first meal";
    if (planAny && todayCalories < planAny.calorieTarget * 0.5) return "Next: hit your calorie target";
    if (waterTotalOz < waterTargetOz * 0.5) return "Next: drink water";
    return "Next: hit tomorrow's plan";
  })();

  // Proof of Change data
  const startKg = progress?.startWeightKg ?? profile?.currentWeightKg ?? 0;
  const currentKg = progress?.currentWeightKg ?? profile?.currentWeightKg ?? 0;
  const goalKg = progress?.goalWeightKg ?? profile?.goalWeightKg ?? 0;
  const startLbs = Math.round(startKg * 2.2046);
  const currentLbs = Math.round(currentKg * 2.2046);
  const goalLbs = goalKg > 0 ? Math.round(goalKg * 2.2046) : 0;
  const totalChange = Math.round((currentKg - startKg) * 2.2046 * 10) / 10;
  const hasChange = Math.abs(totalChange) > 0;
  const isWeightLoss = totalChange < 0;
  const changeColor = isWeightLoss ? colors.green : totalChange > 0 ? colors.amber : colors.blue;
  const progressPct = goalLbs > 0 && startLbs !== goalLbs
    ? Math.max(0, Math.min(100, Math.round(Math.abs(startLbs - currentLbs) / Math.abs(startLbs - goalLbs) * 100)))
    : 0;

  // Goals chips
  const goals: string[] = Array.isArray(profile?.goals) ? profile.goals : [];

  // Score breakdown
  const scoreBreakdown = dailyScoreData as any;
  const hasScoreBreakdown = scoreBreakdown && typeof scoreBreakdown.totalScore === "number";

  const dayStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <ScrollView
      style={[s.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >

      {/* ── Hero card ─────────────────────────────────────────────────────── */}
      <View style={[s.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.heroRow}>
          <View style={s.heroLeft}>
            <Text style={[s.heroDate, { color: colors.mutedForeground }]}>{dayStr}</Text>
            <View style={s.heroNameRow}>
              <Text style={[s.heroName, { color: colors.foreground }]}>{user?.username ?? firstName}</Text>
              {isPro && <ProBadge />}
            </View>
            <Text style={[s.heroPhase, { color: colors.mutedForeground }]}>
              Day {dayNumber} — {getPhaseLabel(goalType)}
            </Text>
            {statusBadge && (
              <View style={[s.statusBadge, { backgroundColor: statusBadge.bg }]}>
                <Text style={[s.statusBadgeText, { color: statusBadge.color }]}>{statusBadge.text}</Text>
              </View>
            )}
            {streak && (streak as any).currentStreak > 0 && (
              <View style={s.streakRow}>
                <Feather name="zap" size={13} color={colors.amber} />
                <Text style={[s.streakText, { color: colors.amber }]}>
                  {(streak as any).currentStreak}-day streak
                </Text>
              </View>
            )}
          </View>
          <View style={s.heroRight}>
            <ScoreRing score={dailyScore} colors={colors} />
            <Text style={[s.heroScoreLabel, { color: colors.mutedForeground }]}>Ascend Score</Text>
          </View>
        </View>
      </View>

      {/* ── Today's Mission link → schedule ─────────────────────────────── */}
      <TouchableOpacity
        style={[s.missionLink, { backgroundColor: colors.blue + "12", borderColor: colors.blue + "33" }]}
        onPress={() => router.push("/(tabs)/schedule" as any)}
        activeOpacity={0.85}
      >
        <View style={[s.missionLinkIcon, { backgroundColor: colors.blue + "22" }]}>
          <Feather name="target" size={18} color={colors.blue} />
        </View>
        <View style={s.missionLinkText}>
          <Text style={[s.missionLinkLabel, { color: colors.blue }]}>Today's Mission</Text>
          <Text style={[s.missionLinkTitle, { color: colors.foreground }]}>Hit the plan. Keep the streak alive.</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* ── Proof of Change / Consistency ───────────────────────────────── */}
      {planAny && (
        <View style={[s.proofCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.proofTop}>
            <View style={s.proofLeft}>
              <Text style={[s.proofSectionLabel, { color: colors.mutedForeground }]}>
                {isMaintenance ? "CONSISTENCY" : "PROOF OF CHANGE"}
              </Text>
              {isMaintenance ? (
                <View style={s.proofMetricRow}>
                  <Text style={[s.proofBigNum, { color: checklistCompleted > 0 ? colors.green : colors.blue }]}>
                    {checklistCompleted > 0 ? `${Math.round((checklistCompleted / Math.max(1, habits.length)) * 100)}%` : "0%"}
                  </Text>
                  <Text style={[s.proofUnit, { color: colors.mutedForeground }]}> daily mission today</Text>
                </View>
              ) : hasChange ? (
                <View style={s.proofMetricRow}>
                  <Text style={[s.proofBigNum, { color: changeColor }]}>
                    {isWeightLoss ? "" : "+"}{totalChange}
                  </Text>
                  <Text style={[s.proofUnit, { color: colors.mutedForeground }]}> lbs since starting</Text>
                </View>
              ) : (
                <Text style={[s.proofEmpty, { color: colors.mutedForeground }]}>Log a weigh-in to see your change.</Text>
              )}
              <Text style={[s.proofSub, { color: colors.mutedForeground }]}>
                {isMaintenance
                  ? `${(streak as any)?.currentStreak > 0 ? `${(streak as any).currentStreak}-day streak · ` : ""}Stay fit by showing up daily.`
                  : `${startLbs} lbs${hasChange ? ` → ${currentLbs} lbs` : ""}${goalLbs > 0 ? ` → ${goalLbs} goal` : ""}`}
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(tabs)/progress")}>
              <Text style={[s.proofLink, { color: colors.primary }]}>{hasChange ? "Track" : "Weigh In"}</Text>
            </TouchableOpacity>
          </View>
          {!isMaintenance && goalLbs > 0 && startLbs !== goalLbs && (
            <View style={s.proofBarWrap}>
              <View style={[s.proofTrack, { backgroundColor: colors.muted }]}>
                <View style={[s.proofFill, { width: `${progressPct}%` as any, backgroundColor: changeColor }]} />
              </View>
              <Text style={[s.proofBarLabel, { color: colors.mutedForeground }]}>{progressPct}% of the way to goal</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Mission Active / Complete card ──────────────────────────────── */}
      {planAny && (
        missionComplete ? (
          <View style={[s.missionCompleteCard, { backgroundColor: colors.green + "1A", borderColor: colors.green + "44" }]}>
            <View style={[s.missionCompleteIcon, { backgroundColor: colors.green + "22" }]}>
              <Feather name="check-circle" size={16} color={colors.green} />
            </View>
            <View style={s.missionCompleteText}>
              <Text style={[s.missionCompleteTitle, { color: colors.green }]}>Mission Complete</Text>
              <Text style={[s.missionCompleteBody, { color: colors.foreground }]}>You kept the promise today.</Text>
              <Text style={[s.missionCompleteSub, { color: colors.green }]}>
                Stack another win tomorrow. Don't break the chain.
              </Text>
            </View>
          </View>
        ) : (
          <View style={[s.missionActiveCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.missionActiveDot}>
              <View style={[s.pulseDot, { backgroundColor: colors.blue }]} />
              <Text style={[s.missionActiveLabel, { color: colors.blue }]}>Mission Active</Text>
            </View>
            <Text style={[s.missionActiveBody, { color: colors.foreground }]}>{coachMessage}</Text>
            <Text style={[s.missionActiveNext, { color: colors.primary }]}>{nextAction}</Text>
          </View>
        )
      )}

      {/* ── Score Breakdown ──────────────────────────────────────────────── */}
      {hasScoreBreakdown && (
        <View style={[s.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.scoreCardHeader}>
            <Text style={[s.scoreCardHeaderLabel, { color: colors.mutedForeground }]}>SCORE BREAKDOWN</Text>
            <Text style={[s.scoreCardHeaderVal, { color: colors.mutedForeground }]}>{scoreBreakdown.totalScore}/100</Text>
          </View>
          <View style={s.scoreBarsRow}>
            {[
              { label: "Calories", score: scoreBreakdown.caloriesScore, max: 25, color: colors.blue },
              { label: "Protein", score: scoreBreakdown.proteinScore, max: 25, color: colors.green },
              { label: "Water", score: scoreBreakdown.waterScore, max: 20, color: colors.blue },
              { label: "Workout", score: scoreBreakdown.workoutScore, max: 20, color: colors.amber },
              { label: "Sleep", score: scoreBreakdown.sleepScore, max: 10, color: colors.blue },
            ].map((item) => {
              const pct = item.max > 0 ? Math.round((item.score / item.max) * 100) : 0;
              return (
                <View key={item.label} style={s.scoreBarCol}>
                  <View style={[s.scoreBarTrack, { backgroundColor: colors.muted }]}>
                    <View style={[s.scoreBarFill, { height: `${pct}%` as any, backgroundColor: item.color }]} />
                    <Text style={[s.scoreBarNum, { color: colors.foreground }]}>{item.score}</Text>
                  </View>
                  <Text style={[s.scoreBarLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Emergency Coach buttons ──────────────────────────────────────── */}
      <View>
        <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>EMERGENCY COACH</Text>
        <View style={s.emergencyGrid}>
          {([
            { icon: "coffee", label: "Craving junk" },
            { icon: "activity", label: "Missed workout" },
            { icon: "scissors", label: "Overate today" },
            { icon: "frown", label: "Unmotivated" },
            { icon: "alert-triangle", label: "What to eat?" },
          ] as const).map(({ icon, label }) => (
            <TouchableOpacity
              key={label}
              style={[s.emergencyBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/(tabs)/coach" as any)}
              activeOpacity={0.8}
            >
              <View style={[s.emergencyIconWrap, { backgroundColor: colors.amber + "1A" }]}>
                <Feather name={icon} size={13} color={colors.amber} />
              </View>
              <Text style={[s.emergencyLabel, { color: colors.mutedForeground }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Daily Mission Checklist ──────────────────────────────────────── */}
      {habits.length > 0 && (
        <View>
          <View style={s.missionChecklistHeader}>
            <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>DAILY MISSION</Text>
            <View style={s.missionChecklistRight}>
              {missionComplete && (
                <View style={[s.missionCompleteBadge, { backgroundColor: colors.green + "22" }]}>
                  <Text style={[s.missionCompleteBadgeText, { color: colors.green }]}>Complete</Text>
                </View>
              )}
              <Text style={[s.missionCount, { color: colors.mutedForeground }]}>
                {checklistCompleted}/{habits.length}
              </Text>
            </View>
          </View>
          <View style={[s.checklistCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {habits.map((habit, idx) => {
              const isDone = !!done[habit];
              return (
                <TouchableOpacity
                  key={habit}
                  style={[
                    s.checklistRow,
                    { borderBottomColor: colors.border },
                    idx === habits.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => toggleHabit(habit)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    s.checkCircle,
                    isDone ? { backgroundColor: colors.green, borderColor: colors.green } : { borderColor: colors.border },
                  ]}>
                    {isDone && <Feather name="check" size={11} color="#fff" />}
                  </View>
                  <Text style={[
                    s.checkLabel,
                    { color: isDone ? colors.mutedForeground : colors.foreground,
                      textDecorationLine: isDone ? "line-through" : "none" },
                  ]}>
                    {habit}
                  </Text>
                  {isDone && (
                    <Text style={[s.checkDoneTag, { color: colors.green }]}>Done</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          {missionComplete && (
            <Text style={[s.missionAllDoneNote, { color: colors.mutedForeground }]}>
              All done. You're building the habit. Keep the streak going.
            </Text>
          )}
        </View>
      )}

      {/* ── Fuel (Calories + Protein intake bars) ───────────────────────── */}
      {planAny && (
        <View>
          <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>FUEL</Text>
          <View style={s.fuelRow}>
            <IntakeBar
              icon="zap"
              label="Calories"
              eaten={todayCalories}
              target={planAny.calorieTarget ?? 0}
              color={colors.amber}
              colors={colors}
            />
            <IntakeBar
              icon="activity"
              label="Protein"
              eaten={todayProtein}
              target={planAny.proteinTargetG ?? 0}
              unit="g"
              color={colors.green}
              colors={colors}
            />
          </View>
        </View>
      )}

      {/* ── Water Tracker ────────────────────────────────────────────────── */}
      {planAny && (
        <View style={[s.waterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.waterTop}>
            <View style={[s.waterIconWrap, { backgroundColor: colors.blue + "22" }]}>
              <Feather name="droplet" size={14} color={colors.blue} />
            </View>
            <Text style={[s.waterLabelText, { color: colors.mutedForeground }]}>Hydration</Text>
            {waterTotalOz >= waterTargetOz && waterTargetOz > 0 && (
              <View style={[s.waterMetBadge, { backgroundColor: colors.green + "22" }]}>
                <Text style={[s.waterMetText, { color: colors.green }]}>Target Met ✓</Text>
              </View>
            )}
            {logWater.isPending && <ActivityIndicator size="small" color={colors.blue} />}
          </View>
          <Text style={[s.waterOzBig, { color: colors.foreground }]}>
            {waterTotalOz}
            <Text style={[s.waterOzUnit, { color: colors.mutedForeground }]}> oz</Text>
            <Text style={[s.waterOzTarget, { color: colors.mutedForeground }]}> / {waterTargetOz} oz</Text>
          </Text>
          <View style={[s.waterTrack, { backgroundColor: colors.muted }]}>
            <View style={[s.waterFill, {
              backgroundColor: waterTotalOz >= waterTargetOz ? colors.green : colors.blue,
              width: `${Math.min(100, waterTargetOz > 0 ? Math.round((waterTotalOz / waterTargetOz) * 100) : 0)}%` as any,
            }]} />
          </View>
          <View style={s.waterBtns}>
            {[8, 16, 24].map((oz) => (
              <TouchableOpacity
                key={oz}
                style={[s.waterBtn, { backgroundColor: colors.blue + "18", borderColor: colors.blue + "33" }]}
                onPress={() => handleLogWater(oz)}
                disabled={logWater.isPending}
                activeOpacity={0.75}
              >
                <Text style={[s.waterBtnText, { color: colors.blue }]}>+{oz} oz</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[s.waterBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={() => setShowCustomWater(v => !v)}
              activeOpacity={0.75}
            >
              <Text style={[s.waterBtnText, { color: colors.mutedForeground }]}>Custom</Text>
            </TouchableOpacity>
          </View>
          {showCustomWater && (
            <View style={s.customWaterRow}>
              <TextInput
                style={[s.customWaterInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
                placeholder="oz" placeholderTextColor={colors.mutedForeground}
                value={customWaterOz} onChangeText={setCustomWaterOz}
                keyboardType="decimal-pad" autoFocus
              />
              <TouchableOpacity style={[s.customWaterBtn, { backgroundColor: colors.blue }]} onPress={handleCustomWater} activeOpacity={0.85}>
                <Text style={[s.customWaterBtnText, { color: "#fff" }]}>Add</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── Targets ─────────────────────────────────────────────────────── */}
      {planAny && (
        <View>
          <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>TARGETS</Text>
          <View style={s.targetsRow}>
            <MetricCard
              icon="trending-up"
              value={(planAny.stepsTarget ?? 0).toLocaleString()}
              label="Steps"
              color={colors.green}
              colors={colors}
            />
            <MetricCard
              icon="moon"
              value={planAny.sleepTargetHours ?? 8}
              unit="h"
              label="Sleep"
              color={colors.blue}
              colors={colors}
            />
            <MetricCard
              icon="zap"
              value={profile?.workoutDaysPerWeek ?? planAny.workoutDaysPerWeek ?? 3}
              unit="x"
              label="Workouts/wk"
              color={colors.amber}
              colors={colors}
            />
          </View>
        </View>
      )}

      {/* ── Today's Training ─────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[s.trainingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push("/(tabs)/workouts")}
        activeOpacity={0.85}
      >
        <View style={[s.trainingIconWrap, { backgroundColor: colors.blue + "22" }]}>
          <Feather name="activity" size={20} color={colors.blue} />
        </View>
        <View style={s.trainingInfo}>
          <Text style={[s.trainingCaption, { color: colors.mutedForeground }]}>TRAINING</Text>
          <Text style={[s.trainingName, { color: colors.foreground }]} numberOfLines={1}>
            {todayWorkout?.name ?? "View Training Plan"}
          </Text>
          {todayWorkout && (
            <Text style={[s.trainingMeta, { color: colors.mutedForeground }]}>
              {todayWorkout.type} · {todayWorkout.exercises?.length ?? 0} exercises
            </Text>
          )}
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* ── Objectives (goals chips) ─────────────────────────────────────── */}
      {goals.length > 0 && (
        <View>
          <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>OBJECTIVES</Text>
          <View style={s.goalsWrap}>
            {goals.map((g: string) => (
              <View key={g} style={[s.goalChip, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={[s.goalChipText, { color: colors.mutedForeground }]}>{g}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Quick Links (4-col, matches web) ────────────────────────────── */}
      <View>
        <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>QUICK LINKS</Text>
        <View style={s.quickLinksRow}>
          {([
            { icon: "coffee", label: "Meal", path: "/(tabs)/meals" },
            { icon: "message-square", label: "Coach", path: "/(tabs)/coach" },
            { icon: "book-open", label: "Journal", path: "/(tabs)/journal" },
            { icon: "activity", label: "Train", path: "/(tabs)/workouts" },
          ] as const).map(({ icon, label, path }) => (
            <TouchableOpacity
              key={label}
              style={[s.quickLink, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(path as any)}
              activeOpacity={0.75}
            >
              <Feather name={icon} size={18} color={colors.mutedForeground} />
              <Text style={[s.quickLinkLabel, { color: colors.mutedForeground }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },

  // Hero
  heroCard: { borderRadius: 20, borderWidth: 1, padding: 20 },
  heroRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  heroLeft: { flex: 1, gap: 4 },
  heroDate: { fontSize: 10, fontFamily: "Inter_500Medium", marginBottom: 2 },
  heroNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  heroName: { fontSize: 30, fontFamily: "Inter_700Bold", lineHeight: 34 },
  heroPhase: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: 6 },
  statusBadgeText: { fontSize: 9, fontFamily: "Inter_500Medium" },
  streakRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  streakText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  heroRight: { alignItems: "center", gap: 4, paddingTop: 2 },
  heroScoreLabel: { fontSize: 8, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },

  // Mission link
  missionLink: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  missionLinkIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  missionLinkText: { flex: 1 },
  missionLinkLabel: { fontSize: 9, fontFamily: "Inter_500Medium", marginBottom: 2 },
  missionLinkTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },

  // Proof of Change
  proofCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  proofTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  proofLeft: { flex: 1, gap: 4 },
  proofSectionLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  proofMetricRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  proofBigNum: { fontSize: 24, fontFamily: "Inter_700Bold", lineHeight: 28 },
  proofUnit: { fontSize: 11, fontFamily: "Inter_400Regular" },
  proofEmpty: { fontSize: 14, fontFamily: "Inter_500Medium" },
  proofSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  proofLink: { fontSize: 12, fontFamily: "Inter_700Bold" },
  proofBarWrap: { gap: 4 },
  proofTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  proofFill: { height: 6, borderRadius: 3 },
  proofBarLabel: { fontSize: 9, fontFamily: "Inter_400Regular" },

  // Mission Active / Complete
  missionCompleteCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 16, borderWidth: 1, padding: 16 },
  missionCompleteIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  missionCompleteText: { flex: 1, gap: 4 },
  missionCompleteTitle: { fontSize: 9, fontFamily: "Inter_500Medium" },
  missionCompleteBody: { fontSize: 14, fontFamily: "Inter_700Bold" },
  missionCompleteSub: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  missionActiveCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  missionActiveDot: { flexDirection: "row", alignItems: "center", gap: 6 },
  pulseDot: { width: 6, height: 6, borderRadius: 3 },
  missionActiveLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  missionActiveBody: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 20 },
  missionActiveNext: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  // Score Breakdown
  scoreCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  scoreCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreCardHeaderLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  scoreCardHeaderVal: { fontSize: 10, fontFamily: "Inter_700Bold" },
  scoreBarsRow: { flexDirection: "row", gap: 8 },
  scoreBarCol: { flex: 1, alignItems: "center", gap: 6 },
  scoreBarTrack: { width: "100%", height: 64, borderRadius: 8, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  scoreBarFill: { position: "absolute", bottom: 0, left: 0, right: 0, borderRadius: 8 },
  scoreBarNum: { fontSize: 12, fontFamily: "Inter_700Bold", zIndex: 1 },
  scoreBarLabel: { fontSize: 8, fontFamily: "Inter_500Medium", textAlign: "center" },

  // Section label
  sectionLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.8, marginBottom: 4 },

  // Emergency Coach
  emergencyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emergencyBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, width: "30%" as any, flexGrow: 1 },
  emergencyIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  emergencyLabel: { fontSize: 11, fontFamily: "Inter_500Medium", flex: 1, lineHeight: 14 },

  // Daily Mission Checklist
  missionChecklistHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  missionChecklistRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  missionCompleteBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  missionCompleteBadgeText: { fontSize: 8, fontFamily: "Inter_500Medium" },
  missionCount: { fontSize: 10, fontFamily: "Inter_400Regular", fontVariant: ["tabular-nums"] },
  checklistCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  checklistRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  checkCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  checkLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  checkDoneTag: { fontSize: 8, fontFamily: "Inter_500Medium" },
  missionAllDoneNote: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center", marginTop: 8 },

  // Fuel (intake bars)
  fuelRow: { flexDirection: "row", gap: 12 },

  // Water Tracker
  waterCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  waterTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  waterIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  waterLabelText: { flex: 1, fontSize: 10, fontFamily: "Inter_500Medium" },
  waterMetBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  waterMetText: { fontSize: 8, fontFamily: "Inter_500Medium" },
  waterOzBig: { fontSize: 24, fontFamily: "Inter_700Bold", lineHeight: 28 },
  waterOzUnit: { fontSize: 12, fontFamily: "Inter_500Medium" },
  waterOzTarget: { fontSize: 14, fontFamily: "Inter_400Regular" },
  waterTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  waterFill: { height: 6, borderRadius: 3 },
  waterBtns: { flexDirection: "row", gap: 8 },
  waterBtn: { flex: 1, paddingVertical: 8, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  waterBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  customWaterRow: { flexDirection: "row", gap: 8 },
  customWaterInput: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  customWaterBtn: { width: 64, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  customWaterBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Targets
  targetsRow: { flexDirection: "row", gap: 10 },

  // Today's Training
  trainingCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, padding: 16 },
  trainingIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  trainingInfo: { flex: 1 },
  trainingCaption: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.5, marginBottom: 2 },
  trainingName: { fontSize: 14, fontFamily: "Inter_700Bold" },
  trainingMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Objectives
  goalsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  goalChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  goalChipText: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "capitalize" },

  // Quick Links
  quickLinksRow: { flexDirection: "row", gap: 10 },
  quickLink: { flex: 1, borderRadius: 16, borderWidth: 1, paddingVertical: 16, alignItems: "center", gap: 6 },
  quickLinkLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
});

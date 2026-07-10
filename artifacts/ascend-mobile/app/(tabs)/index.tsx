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
  useGetTodayWorkout,
  useGetProgressSummary,
  useGetUserProfile,
  useListGoalCheckIns,
  getGetWaterTodayQueryKey,
} from "@workspace/api-client-react";

// ─── Web-exact color palette ──────────────────────────────────────────────────
// These match dashboard.tsx precisely so mobile and web are visually identical.
const BLUE   = "#6B8BAE";  // web primary / mission / water accent
const GREEN  = "#4A9B78";  // web success / protein / weight-loss
const AMBER  = "#C89A3E";  // web amber / streak / emergency

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

// ─── Score Ring ───────────────────────────────────────────────────────────────
// Uses web-exact color thresholds: ≥80 green, ≥50 blue, <50 amber.

function ScoreRing({ score, size = 80, borderColor, mutedColor }: {
  score: number; size?: number; borderColor: string; mutedColor: string;
}) {
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score, 0), 100) / 100;
  const offset = circumference * (1 - pct);
  const ringColor = score >= 80 ? GREEN : score >= 50 ? BLUE : AMBER;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={borderColor} strokeWidth={6} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={ringColor} strokeWidth={6} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: ringColor, lineHeight: 22 }}>{score}</Text>
      <Text style={{ fontSize: 7, fontFamily: "Inter_500Medium", color: mutedColor, marginTop: 1 }}>Score</Text>
    </View>
  );
}

// ─── Intake Bar ───────────────────────────────────────────────────────────────
// Matches web IntakeBar: icon + label + pct + value/target + progress bar.

function IntakeBar({ icon, label, eaten, target, unit, color, cardBg, cardBorder }: {
  icon: string; label: string; eaten: number; target: number;
  unit?: string; color: string; cardBg: string; cardBorder: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((eaten / target) * 100)) : 0;
  return (
    <View style={[ib.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={ib.top}>
        <View style={[ib.iconWrap, { backgroundColor: color + "22" }]}>
          <Feather name={icon as any} size={14} color={color} />
        </View>
        <Text style={[ib.label, { color: "#64748B" }]}>{label}</Text>
        <Text style={[ib.pct, { color: "#64748B" }]}>{pct}%</Text>
      </View>
      <Text style={[ib.value, { color: "#F8FAFC" }]}>
        {eaten.toLocaleString()}
        <Text style={[ib.unit, { color: "#64748B" }]}>
          {unit ?? ""} / {target.toLocaleString()}{unit ?? ""}
        </Text>
      </Text>
      <View style={[ib.track, { backgroundColor: "#1E2A3A" }]}>
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

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({ icon, value, unit, label, color, cardBg, cardBorder }: {
  icon: string; value: string | number; unit?: string; label: string;
  color: string; cardBg: string; cardBorder: string;
}) {
  return (
    <View style={[mc.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={[mc.iconWrap, { backgroundColor: color + "22" }]}>
        <Feather name={icon as any} size={14} color={color} />
      </View>
      <Text style={[mc.value, { color: "#F8FAFC" }]}>
        {value}
        {unit ? <Text style={[mc.unit, { color: "#64748B" }]}>{unit}</Text> : null}
      </Text>
      <Text style={[mc.label, { color: "#64748B" }]}>{label}</Text>
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

function getChecklistKey() {
  const d = new Date();
  return `ascend.checklist.${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  if (goalType === "recomp") return "Recomp Phase";
  return "Maintenance";
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
  const { data: goalCheckInsData } = useListGoalCheckIns();
  const logWater = useLogWater();

  const profile = profileData as any;
  const todayWorkout = todayWorkoutData as any;
  const progress = progressData as any;
  const planAny = plan as any;

  const recentMeals = (mealsData as any) ?? [];
  const scoreBreakdown = dailyScoreData as any;
  const dailyScore: number = scoreBreakdown?.totalScore ?? 0;
  const hasScoreBreakdown = scoreBreakdown && typeof scoreBreakdown.totalScore === "number";

  // Goal type flags
  const goalType: string | undefined = planAny?.goalType;
  const isMaintenance = goalType === "maintain";
  const isBulking = goalType === "muscle_gain";
  const isCutting = goalType === "fat_loss";
  const dayNumber = Math.max(1, Math.floor((Date.now() - new Date(profile?.createdAt ?? Date.now()).getTime()) / 86400000) + 1);

  // Habits
  const rawKeyHabits: string[] = planAny && Array.isArray(planAny.keyHabits) ? planAny.keyHabits : [];
  const habits = prioritizeHabits(rawKeyHabits);

  // Today's meals / macros
  const todayMeals = recentMeals.filter((m: any) => isToday(m.loggedAt));
  const todayCalories: number = todayMeals.reduce((s: number, m: any) => s + (m.calories ?? 0), 0);
  const todayProtein: number = todayMeals.reduce((s: number, m: any) => s + (m.protein ?? 0), 0);

  // Water
  const waterTotalOz: number = (waterData as any)?.totalOz ?? 0;
  const waterTargetOz: number = (waterData as any)?.targetOz ?? 64;

  // Daily checklist — persisted via AsyncStorage keyed by today
  const checklistKeyRef = useRef(getChecklistKey());
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [checklistLoaded, setChecklistLoaded] = useState(false);

  useEffect(() => {
    const key = checklistKeyRef.current;
    AsyncStorage.getItem(key).then((raw) => {
      if (raw) { try { setDone(JSON.parse(raw)); } catch {} }
      setChecklistLoaded(true);
    });
  }, []);

  const saveChecklist = useCallback((next: Record<string, boolean>) => {
    AsyncStorage.setItem(checklistKeyRef.current, JSON.stringify(next)).catch(() => {});
  }, []);

  const toggleHabit = async (habit: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDone((prev) => {
      const next = { ...prev, [habit]: !prev[habit] };
      saveChecklist(next);
      return next;
    });
  };

  const checklistCompleted = habits.filter((h) => done[h]).length;
  const missionComplete = habits.length > 0 && checklistCompleted === habits.length;

  // Auto-check water / calorie / protein habits when met
  useEffect(() => {
    if (!checklistLoaded) return;
    if (waterTotalOz > 0 && waterTargetOz > 0 && waterTotalOz >= waterTargetOz) {
      const h = habits.find((h) => h.toLowerCase().includes("water"));
      if (h && !done[h]) setDone((prev) => { const n = { ...prev, [h]: true }; saveChecklist(n); return n; });
    }
  }, [waterTotalOz, waterTargetOz, checklistLoaded]); // eslint-disable-line

  useEffect(() => {
    if (!planAny || !checklistLoaded) return;
    if (todayCalories > 0 && todayCalories >= planAny.calorieTarget) {
      const h = habits.find((h) => ["calorie", "caloric", "deficit", "kcal"].some((k) => h.toLowerCase().includes(k)));
      if (h && !done[h]) setDone((prev) => { const n = { ...prev, [h]: true }; saveChecklist(n); return n; });
    }
    if (todayProtein > 0 && todayProtein >= planAny.proteinTargetG) {
      const h = habits.find((h) => ["protein", "macro"].some((k) => h.toLowerCase().includes(k)));
      if (h && !done[h]) setDone((prev) => { const n = { ...prev, [h]: true }; saveChecklist(n); return n; });
    }
  }, [todayCalories, todayProtein, checklistLoaded]); // eslint-disable-line

  // Custom water
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

  const refetch = () => {
    refetchPlan(); refetchStreak(); refetchMeals();
    refetchWater(); refetchScore(); refetchWorkout(); refetchProfile();
  };

  // Status badge (web-exact thresholds + colors)
  const hasAnyData = todayCalories > 0 || todayProtein > 0 || waterTotalOz > 0 || checklistCompleted > 0;
  const statusBadge = (() => {
    if (!hasAnyData) return null;
    if (dailyScore >= 90) return { text: "Perfect Day",       color: GREEN,  bg: GREEN  + "1F", border: GREEN  + "4C" };
    if (dailyScore >= 65) return { text: "Locked In",         color: BLUE,   bg: BLUE   + "1F", border: BLUE   + "4C" };
    if (dailyScore >= 30) return { text: "Building Momentum", color: AMBER,  bg: AMBER  + "1F", border: AMBER  + "4C" };
    return                       { text: "Comeback Day",      color: AMBER,  bg: AMBER  + "1A", border: AMBER  + "40" };
  })();

  // Names + coach message (mirrors web buildMission)
  const firstName = profile?.name?.split(" ")?.[0] ?? user?.username ?? "Coach";
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

  // Proof of Change
  const startKg = progress?.startWeightKg ?? profile?.currentWeightKg ?? 0;
  const currentKg = progress?.currentWeightKg ?? profile?.currentWeightKg ?? 0;
  const goalKg = progress?.goalWeightKg ?? profile?.goalWeightKg ?? 0;
  const startLbs = Math.round(startKg * 2.2046);
  const currentLbs = Math.round(currentKg * 2.2046);
  const goalLbs = goalKg > 0 ? Math.round(goalKg * 2.2046) : 0;
  const totalChange = Math.round((currentKg - startKg) * 2.2046 * 10) / 10;
  const hasChange = Math.abs(totalChange) > 0;
  const isWeightLoss = totalChange < 0;
  const changeColor = isWeightLoss ? GREEN : totalChange > 0 ? AMBER : BLUE;
  const progressPct = goalLbs > 0 && startLbs !== goalLbs
    ? Math.max(0, Math.min(100, Math.round(Math.abs(startLbs - currentLbs) / Math.abs(startLbs - goalLbs) * 100)))
    : 0;

  // Goals chips
  const goals: string[] = Array.isArray(profile?.goals) ? profile.goals : [];

  // Weekly habits (separate from daily mission habits)
  const WEEKLY_KEYWORDS = /\b(this week|weekly|x\/week|per week|days\/week|times a week|times per week)\b/i;
  const weeklyHabits: string[] = rawKeyHabits.filter((h) => WEEKLY_KEYWORDS.test(h));

  // Weekly goal counts — persisted per month via AsyncStorage
  const weeklyMonthKey = `ascend.weekly.${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [weeklyCounts, setWeeklyCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    AsyncStorage.getItem(weeklyMonthKey).then((raw) => {
      if (raw) { try { setWeeklyCounts(JSON.parse(raw)); } catch {} }
    });
  }, [weeklyMonthKey]);

  const updateWeeklyCount = useCallback((habit: string, delta: number) => {
    setWeeklyCounts((prev) => {
      const next = { ...prev, [habit]: Math.max(0, (prev[habit] ?? 0) + delta) };
      AsyncStorage.setItem(weeklyMonthKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [weeklyMonthKey]);

  // Next Mission — derived from goal check-in history
  const goalCheckIns = (goalCheckInsData as any[]) ?? [];
  const nextMissionItems: Array<{ type: "fix" | "keep"; text: string; goal: string }> = (() => {
    const sorted = [...goalCheckIns].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const items: Array<{ type: "fix" | "keep"; text: string; goal: string }> = [];
    const seen = new Set<string>();
    for (const c of sorted) {
      if (c.whatHardened && !seen.has(c.whatHardened)) {
        seen.add(c.whatHardened);
        items.push({ type: "fix", text: c.whatHardened, goal: c.goal });
      }
      if (c.whatHelped && !seen.has(c.whatHelped)) {
        seen.add(c.whatHelped);
        items.push({ type: "keep", text: c.whatHelped, goal: c.goal });
      }
      if (items.length >= 3) break;
    }
    return items;
  })();

  // Trial nudge
  const trialDay = Math.max(1, Math.floor((Date.now() - new Date(profile?.createdAt ?? Date.now()).getTime()) / 86400000) + 1);
  const daysLeft = Math.max(0, 7 - trialDay + 1);
  const showTrialNudge = !isPro && trialDay >= 5 && trialDay <= 7;

  const dayStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // Shared card style tokens
  const CARD_BG     = colors.card;    // #141B27
  const CARD_BORDER = colors.border;  // #1E2A3A
  const MUTED_BG    = "#1E2A3A";
  const MUTED_FG    = "#64748B";
  const FG          = "#F8FAFC";

  return (
    <ScrollView
      style={[s.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={planLoading} onRefresh={refetch} tintColor={BLUE} />}
    >

      {/* ── Hero card ─────────────────────────────────────────────────────── */}
      <View style={[s.heroCard, { backgroundColor: CARD_BG, borderColor: CARD_BORDER }]}>
        <View style={s.heroRow}>
          <View style={s.heroLeft}>
            <Text style={[s.heroDate, { color: MUTED_FG }]}>{dayStr}</Text>
            <View style={s.heroNameRow}>
              <Text style={[s.heroName, { color: FG }]}>{firstName}</Text>
              {isPro && <ProBadge />}
            </View>
            <Text style={[s.heroPhase, { color: MUTED_FG }]}>
              Day {dayNumber} — {getPhaseLabel(goalType)}
            </Text>
            {statusBadge && (
              <View style={[s.statusBadge, { backgroundColor: statusBadge.bg, borderColor: statusBadge.border, borderWidth: 1 }]}>
                <Text style={[s.statusBadgeText, { color: statusBadge.color }]}>{statusBadge.text}</Text>
              </View>
            )}
            {streak && (streak as any).currentStreak > 0 && (
              <View style={s.streakRow}>
                <Feather name="zap" size={13} color={AMBER} />
                <Text style={[s.streakText, { color: AMBER }]}>
                  {(streak as any).currentStreak}-day streak
                </Text>
              </View>
            )}
          </View>
          <View style={s.heroRight}>
            <ScoreRing score={dailyScore} borderColor={CARD_BORDER} mutedColor={MUTED_FG} />
            <Text style={[s.heroScoreLabel, { color: MUTED_FG }]}>Ascend Score</Text>
          </View>
        </View>
      </View>

      {/* ── Today's Mission → /schedule ──────────────────────────────────── */}
      <TouchableOpacity
        style={[s.missionLink, { backgroundColor: BLUE + "14", borderColor: BLUE + "38" }]}
        onPress={() => router.push("/(tabs)/schedule" as any)}
        activeOpacity={0.85}
      >
        <View style={[s.missionLinkIcon, { backgroundColor: BLUE + "1F" }]}>
          <Feather name="target" size={18} color={BLUE} />
        </View>
        <View style={s.missionLinkText}>
          <Text style={[s.missionLinkLabel, { color: BLUE }]}>Today's Mission</Text>
          <Text style={[s.missionLinkTitle, { color: FG }]}>Hit the plan. Keep the streak alive.</Text>
        </View>
        <Feather name="chevron-right" size={18} color={MUTED_FG} />
      </TouchableOpacity>

      {/* ── Proof of Change / Consistency ────────────────────────────────── */}
      {planAny && (
        <View style={[s.proofCard, { backgroundColor: CARD_BG, borderColor: CARD_BORDER }]}>
          <View style={s.proofTop}>
            <View style={s.proofLeft}>
              <Text style={[s.capLabel, { color: MUTED_FG }]}>
                {isMaintenance ? "CONSISTENCY" : "PROOF OF CHANGE"}
              </Text>
              {isMaintenance ? (
                <View style={s.proofMetricRow}>
                  <Text style={[s.proofBigNum, { color: checklistCompleted > 0 ? GREEN : BLUE }]}>
                    {checklistCompleted > 0 ? `${Math.round((checklistCompleted / Math.max(1, habits.length)) * 100)}%` : "0%"}
                  </Text>
                  <Text style={[s.proofUnit, { color: MUTED_FG }]}> daily mission today</Text>
                </View>
              ) : hasChange ? (
                <View style={s.proofMetricRow}>
                  <Text style={[s.proofBigNum, { color: changeColor }]}>
                    {isWeightLoss ? "" : "+"}{totalChange}
                  </Text>
                  <Text style={[s.proofUnit, { color: MUTED_FG }]}> lbs since starting</Text>
                </View>
              ) : (
                <Text style={[s.proofEmpty, { color: MUTED_FG }]}>Log a weigh-in to see your change.</Text>
              )}
              <Text style={[s.proofSub, { color: MUTED_FG }]}>
                {isMaintenance
                  ? `${(streak as any)?.currentStreak > 0 ? `${(streak as any).currentStreak}-day streak · ` : ""}Stay fit by showing up daily.`
                  : `${startLbs} lbs${hasChange ? ` → ${currentLbs} lbs` : ""}${goalLbs > 0 ? ` → ${goalLbs} goal` : ""}`}
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(tabs)/progress")}>
              <Text style={[s.proofLink, { color: BLUE }]}>{hasChange ? "Track" : "Weigh In"}</Text>
            </TouchableOpacity>
          </View>
          {!isMaintenance && goalLbs > 0 && startLbs !== goalLbs && (
            <View style={s.proofBarWrap}>
              <View style={[s.track, { backgroundColor: MUTED_BG }]}>
                <View style={[s.fill, { width: `${progressPct}%` as any, backgroundColor: changeColor }]} />
              </View>
              <Text style={[s.barLabel, { color: MUTED_FG }]}>{progressPct}% of the way to goal</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Next Mission ─────────────────────────────────────────────────── */}
      {nextMissionItems.length > 0 && (
        <View style={[s.nextMissionCard, { backgroundColor: BLUE + "0D", borderColor: BLUE + "26" }]}>
          <View style={s.nextMissionHeader}>
            <Feather name="target" size={14} color={BLUE} />
            <Text style={[s.capLabel, { color: BLUE }]}>NEXT MISSION</Text>
          </View>
          <View style={s.nextMissionItems}>
            {nextMissionItems.map((item, i) => (
              <View key={i} style={s.nextMissionRow}>
                <View style={[s.nextMissionBadge, {
                  backgroundColor: item.type === "fix" ? AMBER + "26" : GREEN + "26",
                }]}>
                  <Text style={[s.nextMissionBadgeText, { color: item.type === "fix" ? AMBER : GREEN }]}>
                    {item.type === "fix" ? "Reduce" : "Keep"}
                  </Text>
                </View>
                <View style={s.nextMissionTextWrap}>
                  <Text style={[s.nextMissionText, { color: FG }]}>{item.text}</Text>
                  <Text style={[s.nextMissionGoal, { color: MUTED_FG }]}>{item.goal}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={[s.nextMissionNote, { color: MUTED_FG }]}>Based on your last check-in — track the pattern.</Text>
        </View>
      )}

      {/* ── Mission Active / Complete ─────────────────────────────────────── */}
      {planAny && (
        missionComplete ? (
          <View style={[s.missionCompleteCard, { backgroundColor: GREEN + "1A", borderColor: GREEN + "40" }]}>
            <View style={[s.missionCompleteIcon, { backgroundColor: GREEN + "1F" }]}>
              <Feather name="check-circle" size={16} color={GREEN} />
            </View>
            <View style={s.missionCompleteText}>
              <Text style={[s.missionCompleteTitle, { color: GREEN }]}>Mission Complete</Text>
              <Text style={[s.missionCompleteBody, { color: FG }]}>You kept the promise today.</Text>
              <Text style={[s.missionCompleteSub, { color: GREEN }]}>
                Stack another win tomorrow. Don't break the chain.
              </Text>
            </View>
          </View>
        ) : (
          <View style={[s.missionActiveCard, { backgroundColor: CARD_BG, borderColor: CARD_BORDER }]}>
            <View style={s.missionActiveDot}>
              <View style={[s.pulseDot, { backgroundColor: BLUE }]} />
              <Text style={[s.missionActiveLabel, { color: BLUE }]}>Mission Active</Text>
            </View>
            <Text style={[s.missionActiveBody, { color: FG }]}>{coachMessage}</Text>
            <Text style={[s.missionActiveNext, { color: AMBER }]}>{nextAction}</Text>
          </View>
        )
      )}

      {/* ── Score Breakdown ───────────────────────────────────────────────── */}
      {hasScoreBreakdown && (
        <View style={[s.scoreCard, { backgroundColor: CARD_BG, borderColor: CARD_BORDER }]}>
          <View style={s.scoreCardHeader}>
            <Text style={[s.capLabel, { color: MUTED_FG }]}>SCORE BREAKDOWN</Text>
            <Text style={[s.scoreCardHeaderVal, { color: MUTED_FG }]}>{scoreBreakdown.totalScore}/100</Text>
          </View>
          <View style={s.scoreBarsRow}>
            {[
              { label: "Calories", score: scoreBreakdown.caloriesScore, max: 25, color: BLUE  },
              { label: "Protein",  score: scoreBreakdown.proteinScore,  max: 25, color: GREEN },
              { label: "Water",    score: scoreBreakdown.waterScore,    max: 20, color: BLUE  },
              { label: "Workout",  score: scoreBreakdown.workoutScore,  max: 20, color: AMBER },
              { label: "Sleep",    score: scoreBreakdown.sleepScore,    max: 10, color: BLUE  },
            ].map((item) => {
              const pct = item.max > 0 ? Math.round((item.score / item.max) * 100) : 0;
              return (
                <View key={item.label} style={s.scoreBarCol}>
                  <View style={[s.scoreBarTrack, { backgroundColor: MUTED_BG }]}>
                    <View style={[s.scoreBarFill, { height: `${pct}%` as any, backgroundColor: item.color }]} />
                    <Text style={[s.scoreBarNum, { color: FG }]}>{item.score}</Text>
                  </View>
                  <Text style={[s.scoreBarLabel, { color: MUTED_FG }]}>{item.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Emergency Coach ───────────────────────────────────────────────── */}
      <View>
        <Text style={[s.capLabel, { color: MUTED_FG, marginBottom: 10 }]}>EMERGENCY COACH</Text>
        <View style={s.emergencyGrid}>
          {([
            { icon: "coffee",         label: "Craving junk"   },
            { icon: "activity",       label: "Missed workout" },
            { icon: "scissors",       label: "Overate today"  },
            { icon: "frown",          label: "Unmotivated"    },
            { icon: "alert-triangle", label: "What to eat?"   },
          ] as const).map(({ icon, label }) => (
            <TouchableOpacity
              key={label}
              style={[s.emergencyBtn, { backgroundColor: CARD_BG, borderColor: CARD_BORDER }]}
              onPress={() => router.push("/(tabs)/coach" as any)}
              activeOpacity={0.8}
            >
              <View style={[s.emergencyIconWrap, { backgroundColor: AMBER + "1F" }]}>
                <Feather name={icon} size={13} color={AMBER} />
              </View>
              <Text style={[s.emergencyLabel, { color: MUTED_FG }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Daily Mission Checklist ───────────────────────────────────────── */}
      {habits.length > 0 && (
        <View>
          <View style={s.missionChecklistHeader}>
            <Text style={[s.capLabel, { color: MUTED_FG }]}>DAILY MISSION</Text>
            <View style={s.missionChecklistRight}>
              {missionComplete && (
                <View style={[s.missionCompleteBadge, { backgroundColor: GREEN + "22" }]}>
                  <Text style={[s.missionCompleteBadgeText, { color: GREEN }]}>Complete</Text>
                </View>
              )}
              <Text style={[s.missionCount, { color: MUTED_FG }]}>{checklistCompleted}/{habits.length}</Text>
            </View>
          </View>
          <View style={[s.checklistCard, { backgroundColor: CARD_BG, borderColor: CARD_BORDER }]}>
            {habits.map((habit, idx) => {
              const isDone = !!done[habit];
              return (
                <TouchableOpacity
                  key={habit}
                  style={[
                    s.checklistRow,
                    { borderBottomColor: CARD_BORDER },
                    idx === habits.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => toggleHabit(habit)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    s.checkCircle,
                    isDone
                      ? { backgroundColor: GREEN, borderColor: GREEN }
                      : { borderColor: CARD_BORDER },
                  ]}>
                    {isDone && <Feather name="check" size={11} color="#fff" />}
                  </View>
                  <Text style={[
                    s.checkLabel,
                    { color: isDone ? MUTED_FG : FG,
                      textDecorationLine: isDone ? "line-through" : "none" },
                  ]}>
                    {habit}
                  </Text>
                  {isDone && <Text style={[s.checkDoneTag, { color: GREEN }]}>Done</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
          {missionComplete && (
            <Text style={[s.missionAllDoneNote, { color: MUTED_FG }]}>
              All done. You're building the habit. Keep the streak going.
            </Text>
          )}
        </View>
      )}

      {/* ── Weekly Goals ──────────────────────────────────────────────────── */}
      {weeklyHabits.length > 0 && (
        <View>
          <Text style={[s.capLabel, { color: MUTED_FG, marginBottom: 10 }]}>WEEKLY GOALS</Text>
          <View style={[s.weeklyCard, { backgroundColor: CARD_BG, borderColor: CARD_BORDER }]}>
            {weeklyHabits.map((habit, idx) => {
              const isWorkoutFreq = /\b(train|workout|strength|gym|exercise|lift|cardio|run|sport|practice)\b/i.test(habit) && WEEKLY_KEYWORDS.test(habit);
              const liveDays = profile?.workoutDaysPerWeek ?? 3;
              const targetCount = isWorkoutFreq && liveDays > 0 ? liveDays : 1;
              const count = weeklyCounts[habit] ?? 0;
              const isDone = count >= targetCount;
              const displayHabit = isWorkoutFreq && liveDays > 0 ? `Train ${liveDays}x this week` : habit;
              return (
                <View
                  key={habit}
                  style={[
                    s.weeklyRow,
                    { borderBottomColor: CARD_BORDER },
                    idx === weeklyHabits.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      s.weeklyCircle,
                      isDone ? { backgroundColor: GREEN, borderColor: GREEN } : { borderColor: CARD_BORDER },
                    ]}
                    onPress={() => updateWeeklyCount(habit, isDone ? -1 : 1)}
                    activeOpacity={0.7}
                  >
                    {isDone && <Feather name="check" size={11} color="#fff" />}
                  </TouchableOpacity>
                  <Text style={[
                    s.weeklyLabel,
                    { color: isDone ? MUTED_FG : FG, textDecorationLine: isDone ? "line-through" : "none" },
                  ]}>{displayHabit}</Text>
                  <View style={s.weeklyCounter}>
                    <TouchableOpacity
                      style={[s.weeklyCountBtn, { borderColor: CARD_BORDER }]}
                      onPress={() => updateWeeklyCount(habit, -1)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.weeklyCountBtnText, { color: MUTED_FG }]}>−</Text>
                    </TouchableOpacity>
                    <Text style={[s.weeklyCountNum, { color: FG }]}>{count}/{targetCount}</Text>
                    <TouchableOpacity
                      style={[s.weeklyCountBtn, { borderColor: CARD_BORDER }]}
                      onPress={() => updateWeeklyCount(habit, 1)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.weeklyCountBtnText, { color: FG }]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Fuel — Calories (blue) + Protein (green) ─────────────────────── */}
      {planAny && (
        <View>
          <Text style={[s.capLabel, { color: MUTED_FG, marginBottom: 10 }]}>FUEL</Text>
          <View style={s.fuelRow}>
            <IntakeBar
              icon="zap"
              label="Calories"
              eaten={todayCalories}
              target={planAny.calorieTarget ?? 0}
              color={BLUE}
              cardBg={CARD_BG}
              cardBorder={CARD_BORDER}
            />
            <IntakeBar
              icon="activity"
              label="Protein"
              eaten={todayProtein}
              target={planAny.proteinTargetG ?? 0}
              unit="g"
              color={GREEN}
              cardBg={CARD_BG}
              cardBorder={CARD_BORDER}
            />
          </View>
        </View>
      )}

      {/* ── Water Tracker ─────────────────────────────────────────────────── */}
      {planAny && (
        <View style={[s.waterCard, { backgroundColor: CARD_BG, borderColor: CARD_BORDER }]}>
          <View style={s.waterTop}>
            <View style={[s.waterIconWrap, { backgroundColor: BLUE + "1F" }]}>
              <Feather name="droplet" size={14} color={BLUE} />
            </View>
            <Text style={[s.waterLabelText, { color: MUTED_FG }]}>Hydration</Text>
            {waterTotalOz >= waterTargetOz && waterTargetOz > 0 && (
              <View style={[s.waterMetBadge, { backgroundColor: GREEN + "22" }]}>
                <Text style={[s.waterMetText, { color: GREEN }]}>Target Met ✓</Text>
              </View>
            )}
            {logWater.isPending && <ActivityIndicator size="small" color={BLUE} />}
          </View>
          <Text style={[s.waterOzBig, { color: FG }]}>
            {waterTotalOz}
            <Text style={[s.waterOzUnit, { color: MUTED_FG }]}> oz</Text>
            <Text style={[s.waterOzTarget, { color: MUTED_FG }]}> / {waterTargetOz} oz</Text>
          </Text>
          <View style={[s.track, { backgroundColor: MUTED_BG }]}>
            <View style={[s.fill, {
              backgroundColor: waterTotalOz >= waterTargetOz ? GREEN : BLUE,
              width: `${Math.min(100, waterTargetOz > 0 ? Math.round((waterTotalOz / waterTargetOz) * 100) : 0)}%` as any,
            }]} />
          </View>
          <View style={s.waterBtns}>
            {[8, 16, 24].map((oz) => (
              <TouchableOpacity
                key={oz}
                style={[s.waterBtn, { backgroundColor: BLUE + "1A", borderColor: BLUE + "38" }]}
                onPress={() => handleLogWater(oz)}
                disabled={logWater.isPending}
                activeOpacity={0.75}
              >
                <Text style={[s.waterBtnText, { color: BLUE }]}>+{oz} oz</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[s.waterBtn, { backgroundColor: MUTED_BG, borderColor: CARD_BORDER }]}
              onPress={() => setShowCustomWater((v) => !v)}
              activeOpacity={0.75}
            >
              <Text style={[s.waterBtnText, { color: MUTED_FG }]}>Custom</Text>
            </TouchableOpacity>
          </View>
          {showCustomWater && (
            <View style={s.customWaterRow}>
              <TextInput
                style={[s.customWaterInput, { color: FG, backgroundColor: MUTED_BG, borderColor: CARD_BORDER }]}
                placeholder="oz" placeholderTextColor={MUTED_FG}
                value={customWaterOz} onChangeText={setCustomWaterOz}
                keyboardType="decimal-pad" autoFocus
              />
              <TouchableOpacity
                style={[s.customWaterBtn, { backgroundColor: BLUE }]}
                onPress={handleCustomWater}
                activeOpacity={0.85}
              >
                <Text style={s.customWaterBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── Targets: Steps (green) · Sleep (blue) · Workouts (amber) ─────── */}
      {planAny && (
        <View>
          <Text style={[s.capLabel, { color: MUTED_FG, marginBottom: 10 }]}>TARGETS</Text>
          <View style={s.targetsRow}>
            <MetricCard
              icon="trending-up"
              value={(planAny.stepsTarget ?? 0).toLocaleString()}
              label="Steps"
              color={GREEN}
              cardBg={CARD_BG}
              cardBorder={CARD_BORDER}
            />
            <MetricCard
              icon="moon"
              value={planAny.sleepTargetHours ?? 8}
              unit="h"
              label="Sleep"
              color={BLUE}
              cardBg={CARD_BG}
              cardBorder={CARD_BORDER}
            />
            <MetricCard
              icon="zap"
              value={profile?.workoutDaysPerWeek ?? planAny.workoutDaysPerWeek ?? 3}
              unit="x"
              label="Workouts/wk"
              color={AMBER}
              cardBg={CARD_BG}
              cardBorder={CARD_BORDER}
            />
          </View>
        </View>
      )}

      {/* ── Today's Training ──────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[s.trainingCard, { backgroundColor: CARD_BG, borderColor: CARD_BORDER }]}
        onPress={() => router.push("/(tabs)/workouts")}
        activeOpacity={0.85}
      >
        <View style={[s.trainingIconWrap, { backgroundColor: BLUE + "1F" }]}>
          <Feather name="activity" size={20} color={BLUE} />
        </View>
        <View style={s.trainingInfo}>
          <Text style={[s.trainingCaption, { color: MUTED_FG }]}>TRAINING</Text>
          <Text style={[s.trainingName, { color: FG }]} numberOfLines={1}>
            {todayWorkout?.name ?? "View Training Plan"}
          </Text>
          {todayWorkout && (
            <Text style={[s.trainingMeta, { color: MUTED_FG }]}>
              {todayWorkout.type} · {todayWorkout.exercises?.length ?? 0} exercises
            </Text>
          )}
        </View>
        <Feather name="chevron-right" size={18} color={MUTED_FG} />
      </TouchableOpacity>

      {/* ── Trial Nudge (days 5-7) ───────────────────────────────────────── */}
      {showTrialNudge && (
        <TouchableOpacity
          style={[s.trialNudge, { backgroundColor: AMBER + "12", borderColor: AMBER + "38" }]}
          onPress={() => router.push("/(tabs)/coach" as any)}
          activeOpacity={0.85}
        >
          <Feather name="zap" size={14} color={AMBER} />
          <View style={s.trialNudgeText}>
            <Text style={[s.trialNudgeTitle, { color: FG }]}>
              {daysLeft === 1
                ? "Last day of your trial. See what you've built."
                : `Day ${trialDay} of 7 — ${daysLeft} days left in your free trial`}
            </Text>
          </View>
          <Feather name="chevron-right" size={14} color={MUTED_FG} />
        </TouchableOpacity>
      )}

      {/* ── Objectives chips ──────────────────────────────────────────────── */}
      {goals.length > 0 && (
        <View>
          <Text style={[s.capLabel, { color: MUTED_FG, marginBottom: 10 }]}>OBJECTIVES</Text>
          <View style={s.goalsWrap}>
            {goals.map((g: string) => (
              <View key={g} style={[s.goalChip, { backgroundColor: MUTED_BG, borderColor: CARD_BORDER }]}>
                <Text style={[s.goalChipText, { color: MUTED_FG }]}>{g}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Quick Links 4-col ─────────────────────────────────────────────── */}
      <View>
        <Text style={[s.capLabel, { color: MUTED_FG, marginBottom: 10 }]}>QUICK LINKS</Text>
        <View style={s.quickLinksRow}>
          {([
            { icon: "coffee",         label: "Meal",    path: "/(tabs)/meals"    },
            { icon: "message-square", label: "Coach",   path: "/(tabs)/coach"   },
            { icon: "book-open",      label: "Journal", path: "/(tabs)/journal" },
            { icon: "activity",       label: "Train",   path: "/(tabs)/workouts"},
          ] as const).map(({ icon, label, path }) => (
            <TouchableOpacity
              key={label}
              style={[s.quickLink, { backgroundColor: CARD_BG, borderColor: CARD_BORDER }]}
              onPress={() => router.push(path as any)}
              activeOpacity={0.75}
            >
              <Feather name={icon} size={18} color={MUTED_FG} />
              <Text style={[s.quickLinkLabel, { color: MUTED_FG }]}>{label}</Text>
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

  // Proof / Consistency
  proofCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  proofTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  proofLeft: { flex: 1, gap: 4 },
  proofMetricRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  proofBigNum: { fontSize: 24, fontFamily: "Inter_700Bold", lineHeight: 28 },
  proofUnit: { fontSize: 11, fontFamily: "Inter_400Regular" },
  proofEmpty: { fontSize: 14, fontFamily: "Inter_500Medium" },
  proofSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  proofLink: { fontSize: 12, fontFamily: "Inter_700Bold" },
  proofBarWrap: { gap: 4 },
  barLabel: { fontSize: 9, fontFamily: "Inter_400Regular" },

  // Shared progress bar
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },

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
  scoreCardHeaderVal: { fontSize: 10, fontFamily: "Inter_700Bold" },
  scoreBarsRow: { flexDirection: "row", gap: 8 },
  scoreBarCol: { flex: 1, alignItems: "center", gap: 6 },
  scoreBarTrack: { width: "100%", height: 64, borderRadius: 8, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  scoreBarFill: { position: "absolute", bottom: 0, left: 0, right: 0, borderRadius: 8 },
  scoreBarNum: { fontSize: 12, fontFamily: "Inter_700Bold", zIndex: 1 },
  scoreBarLabel: { fontSize: 8, fontFamily: "Inter_500Medium", textAlign: "center" },

  // Shared caps label
  capLabel: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },

  // Emergency Coach
  emergencyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emergencyBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, minWidth: "30%", flexGrow: 1 },
  emergencyIconWrap: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  emergencyLabel: { fontSize: 11, fontFamily: "Inter_500Medium", flex: 1, lineHeight: 14 },

  // Daily Mission Checklist
  missionChecklistHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
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

  // Fuel
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
  waterBtns: { flexDirection: "row", gap: 8 },
  waterBtn: { flex: 1, paddingVertical: 8, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  waterBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  customWaterRow: { flexDirection: "row", gap: 8 },
  customWaterInput: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  customWaterBtn: { width: 64, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  customWaterBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },

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

  // Next Mission
  nextMissionCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  nextMissionHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  nextMissionItems: { gap: 10 },
  nextMissionRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  nextMissionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  nextMissionBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  nextMissionTextWrap: { flex: 1, gap: 2 },
  nextMissionText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16, textTransform: "capitalize" },
  nextMissionGoal: { fontSize: 10, fontFamily: "Inter_400Regular", textTransform: "capitalize" },
  nextMissionNote: { fontSize: 10, fontFamily: "Inter_400Regular", lineHeight: 14 },

  // Weekly Goals
  weeklyCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  weeklyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  weeklyCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  weeklyLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  weeklyCounter: { flexDirection: "row", alignItems: "center", gap: 8 },
  weeklyCountBtn: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  weeklyCountBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", lineHeight: 18 },
  weeklyCountNum: { fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "center", minWidth: 32, fontVariant: ["tabular-nums"] },

  // Trial Nudge
  trialNudge: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  trialNudgeText: { flex: 1 },
  trialNudgeTitle: { fontSize: 12, fontFamily: "Inter_700Bold", lineHeight: 16 },
});

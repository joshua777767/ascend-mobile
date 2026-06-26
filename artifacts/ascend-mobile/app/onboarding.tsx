import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateUserProfile,
  useGeneratePlan,
  getGetCurrentPlanQueryKey,
  getGetUserProfileQueryKey,
  type UserProfileInput,
} from "@workspace/api-client-react";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const GOALS = [
  { label: "Lose Weight", value: "lose weight", emoji: "🔥" },
  { label: "Gain Muscle", value: "gain muscle", emoji: "💪" },
  { label: "Gain Weight + Muscle", value: "gain weight and muscle", emoji: "⬆️" },
  { label: "Stay Fit", value: "stay fit", emoji: "⚡" },
] as const;

const WAKE_OPTIONS = [
  { label: "5–7 AM", emoji: "🌅", wakeTime: "06:00", wakeTimeRange: JSON.stringify({ start: "05:00", end: "07:00" }) },
  { label: "7–9 AM", emoji: "☀️", wakeTime: "08:00", wakeTimeRange: JSON.stringify({ start: "07:00", end: "09:00" }) },
  { label: "9–11 AM", emoji: "🕙", wakeTime: "10:00", wakeTimeRange: JSON.stringify({ start: "09:00", end: "11:00" }) },
  { label: "After 11 AM", emoji: "🌤️", wakeTime: "11:30", wakeTimeRange: null },
  { label: "Varies", emoji: "🔀", wakeTime: "07:30", wakeTimeRange: null },
] as const;

const WEIGHT_GOALS = new Set(["lose weight", "gain weight and muscle"]);
const TOTAL_STEPS = 5;

function lbsToKg(lbs: number) {
  return Math.round((lbs / 2.2046226) * 10) / 10;
}
function ftInToCm(ft: number, inches: number) {
  return Math.round((ft * 12 + inches) * 2.54 * 10) / 10;
}

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const createProfile = useCreateUserProfile();
  const generatePlan = useGeneratePlan();

  const [step, setStep] = useState(1);
  const [selectedGoal, setSelectedGoal] = useState("");
  const [currentWeightLbs, setCurrentWeightLbs] = useState("");
  const [goalWeightLbs, setGoalWeightLbs] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [age, setAge] = useState("");
  const [wakeOption, setWakeOption] = useState("");
  const [error, setError] = useState("");

  const isLoading = createProfile.isPending || generatePlan.isPending;
  const isWeightGoal = WEIGHT_GOALS.has(selectedGoal);

  const next = (s: number) => {
    setError("");
    setStep(s);
    Haptics.selectionAsync();
  };

  const handleStep1 = () => {
    if (!selectedGoal) return setError("Pick a goal to continue.");
    next(2);
  };
  const handleStep2 = () => {
    const cw = parseFloat(currentWeightLbs);
    if (!currentWeightLbs || isNaN(cw) || cw < 50 || cw > 700)
      return setError("Enter a valid current weight between 50 and 700 lbs.");
    if (isWeightGoal) {
      const gw = parseFloat(goalWeightLbs);
      if (!goalWeightLbs || isNaN(gw) || gw < 50 || gw > 700)
        return setError("Enter a valid goal weight between 50 and 700 lbs.");
    }
    next(3);
  };
  const handleStep3 = () => {
    const ft = parseInt(heightFt, 10);
    const inches = parseInt(heightIn, 10) || 0;
    if (!heightFt || isNaN(ft) || ft < 3 || ft > 8 || inches < 0 || inches > 11)
      return setError("Enter a valid height.");
    next(4);
  };
  const handleStep4 = () => {
    const a = parseInt(age, 10);
    if (!age || isNaN(a) || a < 13 || a > 100)
      return setError("Enter a valid age between 13 and 100.");
    next(5);
  };

  const handleSubmit = async () => {
    if (!wakeOption) return setError("Pick your usual wake-up time to continue.");
    setError("");

    const ft = parseInt(heightFt, 10) || 0;
    const inches = parseInt(heightIn, 10) || 0;
    const a = parseInt(age, 10);
    const currentWeightKg = lbsToKg(parseFloat(currentWeightLbs));
    const goalWeightKg = goalWeightLbs ? lbsToKg(parseFloat(goalWeightLbs)) : currentWeightKg;
    const selectedWake = WAKE_OPTIONS.find((o) => o.label === wakeOption);

    const payload: UserProfileInput = {
      name: user?.username ?? user?.email?.split("@")[0] ?? "User",
      age: a,
      gender: "prefer not to say",
      heightCm: ftInToCm(ft, inches),
      currentWeightKg,
      goalWeightKg,
      bodyType: "average",
      goals: [selectedGoal],
      skinConcerns: [],
      digestionConcerns: [],
      fitnessLevel: "beginner",
      gymAccess: "no",
      workoutDaysPerWeek: 3,
      wakeTime: selectedWake?.wakeTime ?? "07:00",
      wakeTimeRange: selectedWake?.wakeTimeRange ?? null,
      sleepTime: "22:30",
      sleepQuality: 5,
      energyLevel: 5,
      stressLevel: 5,
      mealsPerDay: 3,
      waterIntakeLiters: 2,
      commitmentLevel: "serious",
    };

    try {
      const created = await createProfile.mutateAsync({ data: payload });
      // Prime the cache so the root gate immediately sees a profile and routes
      // the user to the paywall (no flicker back to onboarding).
      queryClient.setQueryData(getGetUserProfileQueryKey(), created);
      try {
        await generatePlan.mutateAsync();
        queryClient.invalidateQueries({ queryKey: getGetCurrentPlanQueryKey() });
      } catch {
        // Plan generation is best-effort; the profile is what gates routing.
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Root gate redirects to the paywall once a profile exists and the user
      // is not yet Pro.
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  const numInput = [styles.numInput, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#F59E0B1A", "#080D12"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
      />
      {/* Header + progress */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.brand, { color: colors.foreground }]}>
            Ascend<Text style={{ color: colors.primary }}>Fit</Text>
          </Text>
          <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>
            Step {step} of {TOTAL_STEPS}
          </Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.primary, width: `${(step / TOTAL_STEPS) * 100}%` },
            ]}
          />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && (
            <>
              <Text style={[styles.title, { color: colors.foreground }]}>What's your main goal?</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Pick the one that matters most right now.
              </Text>
              <View style={styles.goalGrid}>
                {GOALS.map((g) => {
                  const active = selectedGoal === g.value;
                  return (
                    <TouchableOpacity
                      key={g.value}
                      activeOpacity={0.85}
                      onPress={() => { setSelectedGoal(g.value); setError(""); }}
                      style={[
                        styles.goalCard,
                        {
                          backgroundColor: active ? colors.primary + "1A" : colors.card,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={styles.goalEmoji}>{g.emoji}</Text>
                      <Text
                        style={[styles.goalLabel, { color: active ? colors.primary : colors.foreground }]}
                      >
                        {g.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {!!error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
              <PrimaryButton label="Continue" onPress={handleStep1} colors={colors} disabled={!selectedGoal} />
            </>
          )}

          {step === 2 && (
            <>
              <Text style={[styles.title, { color: colors.foreground }]}>Your weight</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {isWeightGoal
                  ? "We use these to track your progress and build your plan."
                  : "We use this to calibrate your daily targets."}
              </Text>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Current weight</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={numInput}
                  value={currentWeightLbs}
                  onChangeText={(t) => { setCurrentWeightLbs(t); setError(""); }}
                  placeholder="185"
                  placeholderTextColor={colors.mutedForeground + "66"}
                  keyboardType="decimal-pad"
                  autoFocus
                />
                <Text style={[styles.unit, { color: colors.mutedForeground }]}>lbs</Text>
              </View>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
                Goal weight {!isWeightGoal && <Text style={{ color: colors.mutedForeground }}>(optional)</Text>}
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={numInput}
                  value={goalWeightLbs}
                  onChangeText={(t) => { setGoalWeightLbs(t); setError(""); }}
                  placeholder={isWeightGoal ? (selectedGoal === "lose weight" ? "165" : "200") : "Optional"}
                  placeholderTextColor={colors.mutedForeground + "66"}
                  keyboardType="decimal-pad"
                />
                {!!goalWeightLbs && <Text style={[styles.unit, { color: colors.mutedForeground }]}>lbs</Text>}
              </View>
              {!!error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
              <NavRow onBack={() => next(1)} onNext={handleStep2} colors={colors} />
            </>
          )}

          {step === 3 && (
            <>
              <Text style={[styles.title, { color: colors.foreground }]}>How tall are you?</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Used to calibrate your calorie and nutrition targets.
              </Text>
              <View style={styles.heightRow}>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[numInput, styles.flex]}
                    value={heightFt}
                    onChangeText={(t) => { setHeightFt(t); setError(""); }}
                    placeholder="5"
                    placeholderTextColor={colors.mutedForeground + "66"}
                    keyboardType="number-pad"
                    autoFocus
                  />
                  <Text style={[styles.unit, { color: colors.mutedForeground }]}>ft</Text>
                </View>
                <View style={styles.inputRow}>
                  <TextInput
                    style={[numInput, styles.flex]}
                    value={heightIn}
                    onChangeText={(t) => { setHeightIn(t); setError(""); }}
                    placeholder="10"
                    placeholderTextColor={colors.mutedForeground + "66"}
                    keyboardType="number-pad"
                  />
                  <Text style={[styles.unit, { color: colors.mutedForeground }]}>in</Text>
                </View>
              </View>
              {!!error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
              <NavRow onBack={() => next(2)} onNext={handleStep3} colors={colors} />
            </>
          )}

          {step === 4 && (
            <>
              <Text style={[styles.title, { color: colors.foreground }]}>How old are you?</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Your age affects your metabolism and daily targets.
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={numInput}
                  value={age}
                  onChangeText={(t) => { setAge(t); setError(""); }}
                  placeholder="25"
                  placeholderTextColor={colors.mutedForeground + "66"}
                  keyboardType="number-pad"
                  autoFocus
                />
                <Text style={[styles.unit, { color: colors.mutedForeground }]}>yrs</Text>
              </View>
              {!!error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
              <NavRow onBack={() => next(3)} onNext={handleStep4} colors={colors} />
            </>
          )}

          {step === 5 && (
            <>
              <Text style={[styles.title, { color: colors.foreground }]}>When do you usually wake up?</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                We use this to build your daily schedule — meals, workouts, and reminders.
              </Text>
              <View style={styles.wakeList}>
                {WAKE_OPTIONS.map((o) => {
                  const active = wakeOption === o.label;
                  return (
                    <TouchableOpacity
                      key={o.label}
                      activeOpacity={0.85}
                      onPress={() => { setWakeOption(o.label); setError(""); }}
                      style={[
                        styles.wakeRow,
                        {
                          backgroundColor: active ? colors.primary + "1A" : colors.card,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={styles.wakeEmoji}>{o.emoji}</Text>
                      <Text style={[styles.wakeLabel, { color: active ? colors.primary : colors.foreground }]}>
                        {o.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {!!error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
              <View style={[styles.disclaimer, { backgroundColor: colors.amber + "12", borderColor: colors.amber + "44" }]}>
                <Feather name="alert-triangle" size={14} color={colors.amber} style={{ marginTop: 1 }} />
                <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>Not medical advice. </Text>
                  Consult a healthcare professional before starting any diet or exercise program.
                </Text>
              </View>
              <View style={styles.navRow}>
                <TouchableOpacity
                  style={[styles.backBtn, { borderColor: colors.border }]}
                  onPress={() => next(4)}
                  disabled={isLoading}
                >
                  <Text style={[styles.backText, { color: colors.mutedForeground }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.flex, { backgroundColor: colors.primary, opacity: isLoading || !wakeOption ? 0.6 : 1 }]}
                  onPress={handleSubmit}
                  disabled={isLoading || !wakeOption}
                  activeOpacity={0.85}
                >
                  {isLoading ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>Build My Plan →</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function PrimaryButton({
  label, onPress, colors, disabled,
}: { label: string; onPress: () => void; colors: ReturnType<typeof useColors>; disabled?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: disabled ? 0.4 : 1 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function NavRow({
  onBack, onNext, colors,
}: { onBack: () => void; onNext: () => void; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.navRow}>
      <TouchableOpacity style={[styles.backBtn, { borderColor: colors.border }]} onPress={onBack}>
        <Text style={[styles.backText, { color: colors.mutedForeground }]}>Back</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.primaryBtn, styles.flex, { backgroundColor: colors.primary }]}
        onPress={onNext}
        activeOpacity={0.85}
      >
        <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: 24, paddingBottom: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  brand: { fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  stepLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  scroll: { paddingHorizontal: 24, paddingTop: 12, gap: 8 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 12 },
  goalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 4 },
  goalCard: {
    width: "47%", flexGrow: 1, alignItems: "center", justifyContent: "center",
    gap: 10, borderRadius: 18, borderWidth: 1.5, paddingVertical: 22,
  },
  goalEmoji: { fontSize: 30 },
  goalLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 12, marginBottom: 6 },
  inputRow: { position: "relative", justifyContent: "center" },
  numInput: {
    height: 68, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 18,
    fontSize: 28, fontFamily: "Inter_700Bold", textAlign: "center",
  },
  unit: { position: "absolute", right: 18, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  heightRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  wakeList: { gap: 12, marginTop: 4 },
  wakeRow: {
    flexDirection: "row", alignItems: "center", gap: 16,
    borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 18, paddingVertical: 16,
  },
  wakeEmoji: { fontSize: 22 },
  wakeLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  error: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 10 },
  disclaimer: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 16,
  },
  disclaimerText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  navRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  primaryBtn: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  primaryText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  backBtn: { height: 56, paddingHorizontal: 22, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});

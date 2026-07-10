import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  useGetUserProfile,
  useUpdateUserProfile,
  useGeneratePlan,
  getGetUserProfileQueryKey,
  getGetCurrentPlanQueryKey,
} from "@workspace/api-client-react";

// ─── Constants (identical to web settings.tsx) ─────────────────────────────────

const GOALS = ["lose weight", "gain muscle", "gain weight and muscle", "stay fit"];
const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];
const BODY_TYPES = ["Slim", "Athletic", "Average", "Stocky", "Heavy"];
const FITNESS_LEVELS = ["Beginner", "Intermediate", "Advanced", "Athlete"];
const GYM_ACCESS_OPTIONS = ["Yes", "No", "Home gym"];
const WORKOUT_TIME_OPTIONS = ["Early morning", "Morning", "Afternoon", "Evening", "Night"];
const SPORTS = ["No sport", "Football", "Basketball", "Soccer", "Track", "Boxing/MMA", "Baseball/Softball", "Volleyball", "Wrestling", "Other"];
const WORKOUT_FOCUSES = [
  { label: "Lose fat", value: "lose_fat" },
  { label: "Build muscle", value: "build_muscle" },
  { label: "Strength", value: "strength" },
  { label: "Athletic performance", value: "athletic_performance" },
  { label: "Conditioning", value: "conditioning" },
  { label: "General fitness", value: "general_fitness" },
];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const COMMITMENT_LEVELS = [
  { value: "casual", label: "Casual", desc: "Small changes, no pressure." },
  { value: "serious", label: "Serious", desc: "Follow the plan and track daily." },
  { value: "locked_in", label: "All In", desc: "Real results and honest accountability." },
  { value: "extreme_discipline", label: "Deep Focus", desc: "Strong habits, consistent effort. Small wins compound." },
];
const DIET_STYLES = ["None", "Vegan", "Vegetarian", "Pescatarian", "Keto", "Paleo", "Mediterranean", "Halal", "Kosher"];

// ─── Unit helpers (identical to web settings.tsx) ──────────────────────────────

function lbsToKg(lbs: number) { return Math.round((lbs / 2.20462) * 10) / 10; }
function kgToLbs(kg: number) { return Math.round(kg * 2.20462 * 10) / 10; }
function cmToFtIn(cm: number) {
  const totalIn = cm / 2.54;
  return { ft: Math.floor(totalIn / 12), inches: Math.round(totalIn % 12) };
}
function ftInToCm(ft: number, inches: number) { return Math.round((ft * 12 + inches) * 2.54 * 10) / 10; }

// ─── Shared sub-components ─────────────────────────────────────────────────────

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {sub && <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>{sub}</Text>}
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  const colors = useColors();
  return <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>;
}

function ChipRow({ options, selected, onToggle, multi }: {
  options: string[];
  selected: string | string[];
  onToggle: (v: string) => void;
  multi?: boolean;
}) {
  const colors = useColors();
  const isSelected = (v: string) =>
    multi ? (selected as string[]).includes(v) : (selected as string).toLowerCase() === v.toLowerCase();
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          onPress={() => onToggle(opt)}
          activeOpacity={0.75}
          style={[
            styles.chip,
            {
              backgroundColor: isSelected(opt) ? colors.primary : colors.card,
              borderColor: isSelected(opt) ? colors.primary : colors.border,
            },
          ]}
        >
          <Text style={[styles.chipText, { color: isSelected(opt) ? colors.primaryForeground : colors.mutedForeground }]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Input({ value, onChange, placeholder, keyboardType = "default", multiline }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
}) {
  const colors = useColors();
  return (
    <TextInput
      style={[
        styles.input,
        multiline && styles.inputMulti,
        { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border },
      ]}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      keyboardType={keyboardType}
      autoCapitalize="none"
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      textAlignVertical={multiline ? "top" : "center"}
    />
  );
}

function Stepper({ value, min, max, onChange, label }: {
  value: number; min: number; max: number;
  onChange: (v: number) => void; label?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.stepperRow}>
      {label && <Text style={[styles.stepperLabel, { color: colors.mutedForeground }]}>{label}</Text>}
      <View style={[styles.stepperControl, { borderColor: colors.border }]}>
        <TouchableOpacity onPress={() => onChange(Math.max(min, value - 1))} style={[styles.stepperBtn, { backgroundColor: colors.card }]}>
          <Feather name="minus" size={16} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.stepperValue, { color: colors.foreground }]}>{value}</Text>
        <TouchableOpacity onPress={() => onChange(Math.min(max, value + 1))} style={[styles.stepperBtn, { backgroundColor: colors.card }]}>
          <Feather name="plus" size={16} color={colors.foreground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SaveBtn({ onPress, saved, pending }: { onPress: () => void; saved: boolean; pending: boolean }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={pending}
      activeOpacity={0.85}
      style={[
        styles.saveBtn,
        {
          backgroundColor: saved ? colors.green + "18" : colors.primary,
          borderColor: saved ? colors.green + "50" : "transparent",
          borderWidth: saved ? 1 : 0,
          opacity: pending ? 0.6 : 1,
        },
      ]}
    >
      {pending ? (
        <ActivityIndicator color={colors.primaryForeground} size="small" />
      ) : saved ? (
        <>
          <Feather name="check-circle" size={16} color={colors.green} />
          <Text style={[styles.saveBtnText, { color: colors.green }]}>Saved — plan regenerated</Text>
        </>
      ) : (
        <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save & Regenerate Plan</Text>
      )}
    </TouchableOpacity>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: profileData } = useGetUserProfile();
  const updateProfile = useUpdateUserProfile();
  const generatePlan = useGeneratePlan();

  const isSaving = updateProfile.isPending || generatePlan.isPending;
  const [savedIdx, setSavedIdx] = useState<number | null>(null);

  // ── Section 1: Personal Info ─────────────────────────────────────────────
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [currentWeightLbs, setCurrentWeightLbs] = useState("");
  const [goalWeightLbs, setGoalWeightLbs] = useState("");
  const [bodyType, setBodyType] = useState("");

  // ── Section 2: Goals ─────────────────────────────────────────────────────
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState("");

  // ── Section 3: Nutrition ─────────────────────────────────────────────────
  const [dietStyle, setDietStyle] = useState("");
  const [allergies, setAllergies] = useState("");
  const [dislikedFoods, setDislikedFoods] = useState("");

  // ── Section 4: Training ──────────────────────────────────────────────────
  const [fitnessLevel, setFitnessLevel] = useState("");
  const [gymAccess, setGymAccess] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [workoutDaysPerWeek, setWorkoutDaysPerWeek] = useState(3);
  const [preferredWorkoutTime, setPreferredWorkoutTime] = useState("");
  const [selectedSport, setSelectedSport] = useState("");
  const [sportCustomText, setSportCustomText] = useState("");
  const [sportDays, setSportDays] = useState<string[]>([]);
  const [sportStartTime, setSportStartTime] = useState("16:00");
  const [sportDurationRaw, setSportDurationRaw] = useState("90");
  const [sportIntensity, setSportIntensity] = useState("moderate");
  const [sportGameDays, setSportGameDays] = useState<string[]>([]);
  const [scheduleChoice, setScheduleChoice] = useState<"" | "yes" | "no">("");
  const [ownScheduleText, setOwnScheduleText] = useState("");
  const [selectedWorkoutFocus, setSelectedWorkoutFocus] = useState("");

  // ── Section 5: Daily Schedule ─────────────────────────────────────────────
  const [wakeMode, setWakeMode] = useState<"exact" | "range">("exact");
  const [wakeTime, setWakeTime] = useState("");
  const [wakeRangeStart, setWakeRangeStart] = useState("");
  const [wakeRangeEnd, setWakeRangeEnd] = useState("");
  const [sleepMode, setSleepMode] = useState<"exact" | "range">("exact");
  const [sleepTime, setSleepTime] = useState("");
  const [sleepRangeStart, setSleepRangeStart] = useState("");
  const [sleepRangeEnd, setSleepRangeEnd] = useState("");
  const [mealsPerDay, setMealsPerDay] = useState(3);
  const [waterIntakeLiters, setWaterIntakeLiters] = useState(2);

  // ── Section 6: Preferences ───────────────────────────────────────────────
  const [commitmentLevel, setCommitmentLevel] = useState("");

  // ── Load profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profileData) return;
    const p = profileData as any;

    if (p.name) setName(p.name);
    if (p.age) setAge(String(p.age));
    if (p.gender) setGender(p.gender);
    if (p.heightCm) {
      const { ft, inches } = cmToFtIn(p.heightCm);
      setHeightFt(String(ft));
      setHeightIn(String(inches));
    }
    if (p.currentWeightKg) setCurrentWeightLbs(String(kgToLbs(p.currentWeightKg)));
    if (p.goalWeightKg) setGoalWeightLbs(String(kgToLbs(p.goalWeightKg)));
    if (p.bodyType) setBodyType(p.bodyType);

    if (Array.isArray(p.goals) && p.goals.length > 0) setSelectedGoals(p.goals);
    if (p.targetDate) setTargetDate(p.targetDate);

    if (p.dietStyle) setDietStyle(p.dietStyle);
    if (p.allergies) setAllergies(p.allergies);
    if (p.dislikedFoods) setDislikedFoods(p.dislikedFoods);

    if (p.fitnessLevel) setFitnessLevel(p.fitnessLevel);
    if (p.gymAccess) setGymAccess(p.gymAccess);
    if (p.equipment) {
      try {
        const eq = JSON.parse(p.equipment);
        if (Array.isArray(eq)) setSelectedEquipment(eq);
      } catch { /* ignore */ }
    }
    if (p.workoutDaysPerWeek) setWorkoutDaysPerWeek(p.workoutDaysPerWeek);
    if (p.preferredWorkoutTime) setPreferredWorkoutTime(p.preferredWorkoutTime);
    if (p.sport) setSelectedSport(p.sport);
    if (p.sportCustom) setSportCustomText(p.sportCustom);
    if (p.hasOwnSchedule) setScheduleChoice(p.hasOwnSchedule as "yes" | "no");
    if (p.ownSchedule) setOwnScheduleText(p.ownSchedule);
    if (p.workoutFocus) setSelectedWorkoutFocus(p.workoutFocus);
    if (p.sportSchedule) {
      try {
        const ss = JSON.parse(p.sportSchedule);
        if (ss.days) setSportDays(ss.days);
        if (ss.startTime) setSportStartTime(ss.startTime);
        if (ss.durationMinutes) setSportDurationRaw(String(ss.durationMinutes));
        if (ss.intensity) setSportIntensity(ss.intensity);
        if (ss.gameDays) setSportGameDays(ss.gameDays);
      } catch { /* ignore */ }
    }

    if (p.wakeTime) setWakeTime(p.wakeTime);
    if (p.sleepTime) setSleepTime(p.sleepTime);
    if (p.wakeTimeRange) {
      try {
        const wr = JSON.parse(p.wakeTimeRange);
        if (wr.start && wr.end) { setWakeMode("range"); setWakeRangeStart(wr.start); setWakeRangeEnd(wr.end); }
      } catch { /* ignore */ }
    }
    if (p.sleepTimeRange) {
      try {
        const sr = JSON.parse(p.sleepTimeRange);
        if (sr.start && sr.end) { setSleepMode("range"); setSleepRangeStart(sr.start); setSleepRangeEnd(sr.end); }
      } catch { /* ignore */ }
    }
    if (p.mealsPerDay) setMealsPerDay(p.mealsPerDay);
    if (p.waterIntakeLiters) setWaterIntakeLiters(p.waterIntakeLiters);

    if (p.commitmentLevel) setCommitmentLevel(p.commitmentLevel);
  }, [profileData]);

  // ── Save helper (matches web saveAndRegenerate) ────────────────────────────
  const saveSection = async (payload: Record<string, unknown>, idx: number) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateProfile.mutateAsync({ data: payload as any });
      await generatePlan.mutateAsync();
      queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetCurrentPlanQueryKey() });
      setSavedIdx(idx);
      setTimeout(() => setSavedIdx(null), 4000);
    } catch {
      Alert.alert("Error", "Could not save settings. Please try again.");
    }
  };

  // ── Section save handlers (match web exactly) ──────────────────────────────

  const handleSavePersonal = () => {
    const ft = parseInt(heightFt) || 0;
    const ins = parseInt(heightIn) || 0;
    const payload: Record<string, unknown> = {};
    if (name.trim()) payload.name = name.trim();
    if (age) payload.age = parseInt(age);
    if (gender) payload.gender = gender;
    if (ft > 0) payload.heightCm = ftInToCm(ft, ins);
    if (currentWeightLbs) payload.currentWeightKg = lbsToKg(parseFloat(currentWeightLbs));
    if (goalWeightLbs) payload.goalWeightKg = lbsToKg(parseFloat(goalWeightLbs));
    if (bodyType) payload.bodyType = bodyType;
    saveSection(payload, 1);
  };

  const handleSaveGoals = () => {
    const payload: Record<string, unknown> = { goals: selectedGoals };
    if (targetDate) payload.targetDate = targetDate;
    saveSection(payload, 2);
  };

  const handleSaveNutrition = () => {
    const payload: Record<string, unknown> = {};
    if (dietStyle) payload.dietStyle = dietStyle;
    if (allergies.trim()) payload.allergies = allergies.trim();
    if (dislikedFoods.trim()) payload.dislikedFoods = dislikedFoods.trim();
    saveSection(payload, 3);
  };

  const handleSaveTraining = () => {
    const sportValue = selectedSport.toLowerCase();
    const payload: Record<string, unknown> = {};
    if (fitnessLevel) payload.fitnessLevel = fitnessLevel;
    if (gymAccess) payload.gymAccess = gymAccess;
    payload.equipment = JSON.stringify(selectedEquipment);
    payload.workoutDaysPerWeek = workoutDaysPerWeek;
    if (preferredWorkoutTime) payload.preferredWorkoutTime = preferredWorkoutTime;
    if (sportValue) payload.sport = sportValue;
    if (sportValue === "other" && sportCustomText) payload.sportCustom = sportCustomText;
    if (scheduleChoice) payload.hasOwnSchedule = scheduleChoice;
    if (scheduleChoice === "yes" && ownScheduleText) payload.ownSchedule = ownScheduleText;
    if (scheduleChoice === "no" && selectedWorkoutFocus) payload.workoutFocus = selectedWorkoutFocus;
    if (sportValue && sportValue !== "no sport" && sportDays.length > 0) {
      const dur = parseInt(sportDurationRaw) || 90;
      payload.sportSchedule = JSON.stringify({
        sport: sportCustomText || sportValue,
        days: sportDays,
        startTime: sportStartTime,
        durationMinutes: Math.max(15, Math.min(300, dur)),
        intensity: sportIntensity,
        gameDays: sportGameDays.length > 0 ? sportGameDays : undefined,
      });
    }
    saveSection(payload, 4);
  };

  const handleSaveSchedule = () => {
    const payload: Record<string, unknown> = {};
    if (wakeMode === "range" && wakeRangeStart && wakeRangeEnd) {
      const [wsh, wsm] = wakeRangeStart.split(":").map(Number);
      const [weh, wem] = wakeRangeEnd.split(":").map(Number);
      const midMins = ((wsh! * 60 + wsm!) + (weh! * 60 + wem!)) / 2;
      const mh = Math.floor(midMins / 60), mm = Math.round(midMins % 60);
      payload.wakeTime = `${String(mh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      payload.wakeTimeRange = JSON.stringify({ start: wakeRangeStart, end: wakeRangeEnd });
    } else {
      if (wakeTime) payload.wakeTime = wakeTime;
      payload.wakeTimeRange = null;
    }
    if (sleepMode === "range" && sleepRangeStart && sleepRangeEnd) {
      const [ssh, ssm] = sleepRangeStart.split(":").map(Number);
      const [seh, sem] = sleepRangeEnd.split(":").map(Number);
      const midMins = ((ssh! * 60 + ssm!) + (seh! * 60 + sem!)) / 2;
      const mh = Math.floor(midMins / 60), mm = Math.round(midMins % 60);
      payload.sleepTime = `${String(mh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      payload.sleepTimeRange = JSON.stringify({ start: sleepRangeStart, end: sleepRangeEnd });
    } else {
      if (sleepTime) payload.sleepTime = sleepTime;
      payload.sleepTimeRange = null;
    }
    payload.mealsPerDay = mealsPerDay;
    payload.waterIntakeLiters = waterIntakeLiters;
    saveSection(payload, 5);
  };

  const handleSavePreferences = () => {
    const payload: Record<string, unknown> = {};
    if (commitmentLevel) payload.commitmentLevel = commitmentLevel;
    saveSection(payload, 6);
  };

  const sportHasPractice = selectedSport && selectedSport.toLowerCase() !== "no sport" && selectedSport.toLowerCase() !== "";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── 1. Personal Info ──────────────────────────────────────────────── */}
        <SectionCard>
          <SectionTitle title="Personal Info" />

          <FieldLabel label="Name" />
          <Input value={name} onChange={setName} placeholder="Your name" />

          <View style={styles.row2}>
            <View style={styles.half}>
              <FieldLabel label="Age" />
              <Input value={age} onChange={setAge} placeholder="25" keyboardType="number-pad" />
            </View>
          </View>

          <FieldLabel label="Gender" />
          <ChipRow options={GENDERS} selected={gender} onToggle={(g) => setGender(prev => prev.toLowerCase() === g.toLowerCase() ? "" : g)} />

          <FieldLabel label="Height" />
          <View style={styles.row2}>
            <View style={styles.half}>
              <Input value={heightFt} onChange={setHeightFt} placeholder="6 ft" keyboardType="number-pad" />
            </View>
            <View style={styles.half}>
              <Input value={heightIn} onChange={setHeightIn} placeholder="0 in" keyboardType="number-pad" />
            </View>
          </View>

          <FieldLabel label="Current weight (lbs)" />
          <Input value={currentWeightLbs} onChange={setCurrentWeightLbs} placeholder="180" keyboardType="decimal-pad" />

          <FieldLabel label="Goal weight (lbs)" />
          <Input value={goalWeightLbs} onChange={setGoalWeightLbs} placeholder="160" keyboardType="decimal-pad" />

          <FieldLabel label="Body type" />
          <ChipRow options={BODY_TYPES} selected={bodyType} onToggle={(t) => setBodyType(prev => prev.toLowerCase() === t.toLowerCase() ? "" : t.toLowerCase())} />

          <SaveBtn onPress={handleSavePersonal} saved={savedIdx === 1} pending={isSaving && savedIdx !== 1} />
        </SectionCard>

        {/* ── 2. Goals ──────────────────────────────────────────────────────── */}
        <SectionCard>
          <SectionTitle title="Goals" sub="Select all that apply." />

          <ChipRow options={GOALS} selected={selectedGoals} onToggle={(g) => setSelectedGoals(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])} multi />

          <FieldLabel label="Target date (optional, YYYY-MM-DD)" />
          <Input value={targetDate} onChange={setTargetDate} placeholder="2025-12-31" />

          <SaveBtn onPress={handleSaveGoals} saved={savedIdx === 2} pending={isSaving && savedIdx !== 2} />
        </SectionCard>

        {/* ── 3. Nutrition ──────────────────────────────────────────────────── */}
        <SectionCard>
          <SectionTitle title="Nutrition" sub="Helps your plan avoid foods that don't work for you." />

          <FieldLabel label="Diet style" />
          <ChipRow options={DIET_STYLES} selected={dietStyle} onToggle={(d) => setDietStyle(prev => prev.toLowerCase() === d.toLowerCase() ? "" : d.toLowerCase())} />

          <FieldLabel label="Allergies or intolerances (optional)" />
          <Input value={allergies} onChange={setAllergies} placeholder="e.g. peanuts, dairy, gluten" multiline />

          <FieldLabel label="Foods you dislike (optional)" />
          <Input value={dislikedFoods} onChange={setDislikedFoods} placeholder="e.g. brussels sprouts, beets" multiline />

          <SaveBtn onPress={handleSaveNutrition} saved={savedIdx === 3} pending={isSaving && savedIdx !== 3} />
        </SectionCard>

        {/* ── 4. Training ───────────────────────────────────────────────────── */}
        <SectionCard>
          <SectionTitle title="Training" />

          <FieldLabel label="Fitness level" />
          <ChipRow options={FITNESS_LEVELS} selected={fitnessLevel} onToggle={(l) => setFitnessLevel(prev => prev.toLowerCase() === l.toLowerCase() ? "" : l.toLowerCase())} />

          <FieldLabel label="Gym access" />
          <ChipRow options={GYM_ACCESS_OPTIONS} selected={gymAccess} onToggle={(g) => setGymAccess(prev => prev.toLowerCase() === g.toLowerCase() ? "" : g.toLowerCase())} />

          {gymAccess.toLowerCase() === "home gym" && (
            <>
              <FieldLabel label="Home gym equipment (select all you have)" />
              <ChipRow
                options={["Dumbbells", "Barbell & plates", "Pull-up bar", "Resistance bands", "Kettlebells", "Bench", "Squat rack", "Jump rope"]}
                selected={selectedEquipment}
                onToggle={(eq) => setSelectedEquipment(prev => prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq])}
                multi
              />
            </>
          )}

          <FieldLabel label={`Workout days — ${workoutDaysPerWeek} per week`} />
          <Stepper value={workoutDaysPerWeek} min={1} max={7} onChange={setWorkoutDaysPerWeek} />

          <FieldLabel label="Preferred workout time" />
          <ChipRow options={WORKOUT_TIME_OPTIONS} selected={preferredWorkoutTime} onToggle={(t) => setPreferredWorkoutTime(prev => prev === t ? "" : t)} />

          <FieldLabel label="Sport" />
          <ChipRow options={SPORTS} selected={selectedSport} onToggle={(s) => setSelectedSport(prev => prev.toLowerCase() === s.toLowerCase() ? "" : s)} />

          {selectedSport.toLowerCase() === "other" && (
            <>
              <FieldLabel label="Sport name" />
              <Input value={sportCustomText} onChange={setSportCustomText} placeholder="What sport do you play?" />
            </>
          )}

          {sportHasPractice && (
            <>
              <FieldLabel label="Practice days" />
              <ChipRow
                options={DAY_NAMES.map(d => d.slice(0, 3))}
                selected={sportDays.map(d => d.slice(0, 3))}
                onToggle={(abbr) => {
                  const full = DAY_NAMES.find(d => d.slice(0, 3) === abbr)!;
                  setSportDays(prev => prev.includes(full) ? prev.filter(x => x !== full) : [...prev, full]);
                }}
                multi
              />

              <View style={styles.row2}>
                <View style={styles.half}>
                  <FieldLabel label="Start time (HH:MM)" />
                  <Input value={sportStartTime} onChange={setSportStartTime} placeholder="16:00" />
                </View>
                <View style={styles.half}>
                  <FieldLabel label="Duration (min)" />
                  <Input value={sportDurationRaw} onChange={setSportDurationRaw} placeholder="90" keyboardType="number-pad" />
                </View>
              </View>

              <FieldLabel label="Intensity" />
              <ChipRow options={["light", "moderate", "hard"]} selected={sportIntensity} onToggle={(i) => setSportIntensity(i)} />

              <FieldLabel label="Game days (optional)" />
              <ChipRow
                options={DAY_NAMES.map(d => d.slice(0, 3))}
                selected={sportGameDays.map(d => d.slice(0, 3))}
                onToggle={(abbr) => {
                  const full = DAY_NAMES.find(d => d.slice(0, 3) === abbr)!;
                  setSportGameDays(prev => prev.includes(full) ? prev.filter(x => x !== full) : [...prev, full]);
                }}
                multi
              />
            </>
          )}

          <FieldLabel label="Workout schedule" />
          <View style={styles.chipRow}>
            {[{ label: "I have my own schedule", val: "yes" }, { label: "Generate one for me", val: "no" }].map(({ label, val }) => (
              <TouchableOpacity
                key={val}
                onPress={() => setScheduleChoice(prev => prev === val ? "" : val as "yes" | "no")}
                activeOpacity={0.75}
                style={[styles.chip, { backgroundColor: scheduleChoice === val ? colors.primary : colors.card, borderColor: scheduleChoice === val ? colors.primary : colors.border }]}
              >
                <Text style={[styles.chipText, { color: scheduleChoice === val ? colors.primaryForeground : colors.mutedForeground }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {scheduleChoice === "yes" && (
            <>
              <FieldLabel label="Describe your schedule" />
              <Input value={ownScheduleText} onChange={setOwnScheduleText} placeholder="Mon: chest/back, Tue: practice, Wed: legs..." multiline />
            </>
          )}

          {scheduleChoice === "no" && (
            <>
              <FieldLabel label="Workout focus" />
              <ChipRow
                options={WORKOUT_FOCUSES.map(f => f.label)}
                selected={WORKOUT_FOCUSES.find(f => f.value === selectedWorkoutFocus)?.label ?? ""}
                onToggle={(label) => {
                  const f = WORKOUT_FOCUSES.find(x => x.label === label);
                  if (f) setSelectedWorkoutFocus(prev => prev === f.value ? "" : f.value);
                }}
              />
            </>
          )}

          <SaveBtn onPress={handleSaveTraining} saved={savedIdx === 4} pending={isSaving && savedIdx !== 4} />
        </SectionCard>

        {/* ── 5. Daily Schedule ─────────────────────────────────────────────── */}
        <SectionCard>
          <SectionTitle title="Daily Schedule" />

          <FieldLabel label="Wake time" />
          <View style={styles.modeRow}>
            {(["exact", "range"] as const).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setWakeMode(m)}
                style={[styles.modeBtn, { backgroundColor: wakeMode === m ? colors.primary : colors.card, borderColor: wakeMode === m ? colors.primary : colors.border }]}
              >
                <Text style={[styles.modeBtnText, { color: wakeMode === m ? colors.primaryForeground : colors.mutedForeground }]}>{m.charAt(0).toUpperCase() + m.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {wakeMode === "exact" ? (
            <Input value={wakeTime} onChange={setWakeTime} placeholder="06:30" />
          ) : (
            <View style={styles.row2}>
              <View style={styles.half}>
                <FieldLabel label="Earliest" />
                <Input value={wakeRangeStart} onChange={setWakeRangeStart} placeholder="05:00" />
              </View>
              <View style={styles.half}>
                <FieldLabel label="Latest" />
                <Input value={wakeRangeEnd} onChange={setWakeRangeEnd} placeholder="07:00" />
              </View>
            </View>
          )}

          <FieldLabel label="Sleep time" />
          <View style={styles.modeRow}>
            {(["exact", "range"] as const).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setSleepMode(m)}
                style={[styles.modeBtn, { backgroundColor: sleepMode === m ? colors.primary : colors.card, borderColor: sleepMode === m ? colors.primary : colors.border }]}
              >
                <Text style={[styles.modeBtnText, { color: sleepMode === m ? colors.primaryForeground : colors.mutedForeground }]}>{m.charAt(0).toUpperCase() + m.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {sleepMode === "exact" ? (
            <Input value={sleepTime} onChange={setSleepTime} placeholder="22:30" />
          ) : (
            <View style={styles.row2}>
              <View style={styles.half}>
                <FieldLabel label="Earliest" />
                <Input value={sleepRangeStart} onChange={setSleepRangeStart} placeholder="21:00" />
              </View>
              <View style={styles.half}>
                <FieldLabel label="Latest" />
                <Input value={sleepRangeEnd} onChange={setSleepRangeEnd} placeholder="23:00" />
              </View>
            </View>
          )}

          <FieldLabel label={`Meals per day — ${mealsPerDay}`} />
          <Stepper value={mealsPerDay} min={1} max={8} onChange={setMealsPerDay} />

          <FieldLabel label={`Daily water — ${waterIntakeLiters}L`} />
          <Stepper value={waterIntakeLiters} min={1} max={6} onChange={setWaterIntakeLiters} />

          <SaveBtn onPress={handleSaveSchedule} saved={savedIdx === 5} pending={isSaving && savedIdx !== 5} />
        </SectionCard>

        {/* ── 6. Preferences ────────────────────────────────────────────────── */}
        <SectionCard>
          <SectionTitle title="Preferences" />

          <FieldLabel label="Commitment level" />
          {COMMITMENT_LEVELS.map((cl) => (
            <TouchableOpacity
              key={cl.value}
              onPress={() => setCommitmentLevel(prev => prev === cl.value ? "" : cl.value)}
              activeOpacity={0.75}
              style={[
                styles.commitRow,
                {
                  backgroundColor: commitmentLevel === cl.value ? colors.primary + "18" : colors.background,
                  borderColor: commitmentLevel === cl.value ? colors.primary : colors.border,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.commitLabel, { color: commitmentLevel === cl.value ? colors.primary : colors.foreground }]}>{cl.label}</Text>
                <Text style={[styles.commitDesc, { color: colors.mutedForeground }]}>{cl.desc}</Text>
              </View>
              {commitmentLevel === cl.value && <Feather name="check-circle" size={18} color={colors.primary} />}
            </TouchableOpacity>
          ))}

          <SaveBtn onPress={handleSavePreferences} saved={savedIdx === 6} pending={isSaving && savedIdx !== 6} />
        </SectionCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "SpaceMono_700Bold" },
  content: { paddingHorizontal: 16, paddingTop: 20, gap: 16 },
  sectionCard: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: "SpaceMono_700Bold" },
  sectionSub: { fontSize: 12, fontFamily: "SpaceMono_400Regular", marginTop: 2 },
  fieldLabel: { fontSize: 11, fontFamily: "SpaceMono_700Bold", textTransform: "uppercase", letterSpacing: 0.6, marginTop: 6 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "SpaceMono_400Regular", marginTop: 4 },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
  row2: { flexDirection: "row", gap: 10, marginTop: 4 },
  half: { flex: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "SpaceMono_400Regular" },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, height: 48, borderRadius: 14, marginTop: 12,
  },
  saveBtnText: { fontSize: 14, fontFamily: "SpaceMono_700Bold" },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  stepperLabel: { fontSize: 14, fontFamily: "SpaceMono_400Regular" },
  stepperControl: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  stepperBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  stepperValue: { width: 40, textAlign: "center", fontSize: 16, fontFamily: "SpaceMono_700Bold" },
  modeRow: { flexDirection: "row", gap: 8, marginTop: 4, marginBottom: 6 },
  modeBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  modeBtnText: { fontSize: 13, fontFamily: "SpaceMono_700Bold" },
  commitRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14, gap: 10, marginTop: 4 },
  commitLabel: { fontSize: 14, fontFamily: "SpaceMono_700Bold" },
  commitDesc: { fontSize: 12, fontFamily: "SpaceMono_400Regular", marginTop: 2 },
});

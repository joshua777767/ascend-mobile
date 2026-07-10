import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Polyline, Line, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { SectionHeader } from "@/components/SectionHeader";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListWeighIns,
  useCreateWeighIn,
  useGetProgressSummary,
  useGetWeeklyRecap,
  useGetWeeklyReview,
  useGetDailyScoreHistory,
  useListGoalCheckIns,
  useCreateGoalCheckIn,
  useGetMilestones,
  useUpdateGoal,
  getGetProgressSummaryQueryKey,
  getGetUserProfileQueryKey,
} from "@workspace/api-client-react";

// ─── Unit conversion helpers ───────────────────────────────────────────────────
const kgToLbs = (kg: number) => Math.round(kg * 2.2046226 * 10) / 10;
const lbsToKg = (lbs: number) => lbs * 0.453592;

type WeighIn = {
  id?: number;
  weightKg: number;
  notes?: string;
  weekNumber?: number;
  createdAt?: string;
};

type ScorePoint = {
  date: string;
  score: number;
};

const SCREEN_W = Dimensions.get("window").width;

// ─── Weight Chart ──────────────────────────────────────────────────────────────

function WeightChart({ data, colors }: { data: { label: string; weight: number }[]; colors: any }) {
  if (data.length < 2) return null;
  const width = SCREEN_W - 40;
  const height = 140;
  const pad = { top: 16, right: 12, bottom: 28, left: 44 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const weights = data.map(d => d.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const range = maxW - minW || 1;

  const toX = (i: number) => pad.left + (i / (data.length - 1)) * chartW;
  const toY = (w: number) => pad.top + ((maxW - w) / range) * chartH;

  const pts = data.map((d, i) => `${toX(i)},${toY(d.weight)}`).join(" ");
  const yLabels = [minW, (minW + maxW) / 2, maxW];

  return (
    <Svg width={width} height={height}>
      {yLabels.map((v, i) => {
        const y = toY(v);
        return (
          <React.Fragment key={i}>
            <Line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke={colors.border} strokeWidth={1} strokeDasharray="4,4" />
            <SvgText x={pad.left - 6} y={y + 4} fontSize={10} fill={colors.mutedForeground} textAnchor="end" fontFamily="SpaceMono_400Regular">
              {v.toFixed(0)}
            </SvgText>
          </React.Fragment>
        );
      })}
      <Polyline points={pts} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <Circle key={i} cx={toX(i)} cy={toY(d.weight)} r={4} fill={colors.primary} stroke={colors.background} strokeWidth={2} />
      ))}
      {data.length <= 8 && data.map((d, i) => (
        <SvgText key={`lbl-${i}`} x={toX(i)} y={height - 6} fontSize={9} fill={colors.mutedForeground} textAnchor="middle" fontFamily="SpaceMono_400Regular">
          {d.label}
        </SvgText>
      ))}
    </Svg>
  );
}

// ─── Score History Chart ───────────────────────────────────────────────────────

function ScoreChart({ data, colors }: { data: ScorePoint[]; colors: any }) {
  if (data.length < 2) return null;
  const width = SCREEN_W - 40;
  const height = 120;
  const pad = { top: 12, right: 12, bottom: 24, left: 36 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const toX = (i: number) => pad.left + (i / (data.length - 1)) * chartW;
  const toY = (s: number) => pad.top + ((100 - s) / 100) * chartH;

  const pts = data.map((d, i) => `${toX(i)},${toY(d.score)}`).join(" ");

  return (
    <Svg width={width} height={height}>
      {[0, 50, 100].map((v, i) => {
        const y = toY(v);
        return (
          <React.Fragment key={i}>
            <Line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke={colors.border} strokeWidth={1} strokeDasharray="4,4" />
            <SvgText x={pad.left - 6} y={y + 4} fontSize={9} fill={colors.mutedForeground} textAnchor="end" fontFamily="SpaceMono_400Regular">
              {v}
            </SvgText>
          </React.Fragment>
        );
      })}
      <Polyline points={pts} fill="none" stroke={colors.green} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <Circle key={i} cx={toX(i)} cy={toY(d.score)} r={3} fill={colors.green} stroke={colors.background} strokeWidth={1.5} />
      ))}
    </Svg>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const queryClient = useQueryClient();
  const { data: weighInsData, isLoading, refetch } = useListWeighIns();
  const { data: progressData, refetch: refetchProgress } = useGetProgressSummary();
  const { data: weeklyRecapData, refetch: refetchRecap } = useGetWeeklyRecap();
  const { data: weeklyReviewData, refetch: refetchReview } = useGetWeeklyReview();
  const { data: scoreHistoryData, refetch: refetchScoreHistory } = useGetDailyScoreHistory();
  const { data: checkInsData, refetch: refetchCheckIns } = useListGoalCheckIns();
  const { data: milestonesData } = useGetMilestones();
  const addWeighIn = useCreateWeighIn();
  const addCheckIn = useCreateGoalCheckIn();
  const updateGoal = useUpdateGoal();

  const rawWeighIns: WeighIn[] = (weighInsData as any) ?? [];
  const progress = progressData as any;
  const recap = weeklyRecapData as any;
  const weeklyReview = weeklyReviewData as any;
  const scoreHistory: ScorePoint[] = (scoreHistoryData as any) ?? [];
  const checkIns: any[] = (checkInsData as any) ?? [];

  const [showWeighModal, setShowWeighModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [newGoalWeightLbs, setNewGoalWeightLbs] = useState("");
  const [newGoalType, setNewGoalType] = useState("lose weight");
  const [showGoalSet, setShowGoalSet] = useState(false);
  const [isSettingGoal, setIsSettingGoal] = useState(false);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkInMetric, setCheckInMetric] = useState("");
  const [checkInNotes, setCheckInNotes] = useState("");

  // Convert stored kg to lbs for display
  const weighInsLbs = rawWeighIns.map(w => ({
    ...w,
    weightLbs: kgToLbs(w.weightKg),
  }));

  const handleAddWeighIn = async () => {
    const val = parseFloat(weight);
    if (!weight || isNaN(val)) return;
    setIsSubmitting(true);
    try {
      // Convert lbs input to kg for storage
      await addWeighIn.mutateAsync({ data: { weightKg: lbsToKg(val), ...(notes.trim() ? { notes: notes.trim() } : {}) } });
      setShowWeighModal(false); setWeight(""); setNotes("");
      refetch(); refetchProgress();
    } catch {}
    finally { setIsSubmitting(false); }
  };

  const handleAddCheckIn = async () => {
    if (!checkInMetric.trim()) return;
    setIsSubmitting(true);
    try {
      await addCheckIn.mutateAsync({ data: { metric: parseFloat(checkInMetric) || 0, notes: checkInNotes.trim() } } as any);
      setShowCheckInModal(false); setCheckInMetric(""); setCheckInNotes("");
      refetchCheckIns();
    } catch {}
    finally { setIsSubmitting(false); }
  };

  const handleSetNewGoal = async () => {
    const val = parseFloat(newGoalWeightLbs);
    if (!newGoalWeightLbs || isNaN(val)) return;
    setIsSettingGoal(true);
    try {
      await updateGoal.mutateAsync({ data: { goalWeightKg: lbsToKg(val), goals: [newGoalType] as any } });
      queryClient.invalidateQueries({ queryKey: getGetProgressSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey() });
      setNewGoalWeightLbs("");
      setShowGoalSet(false);
    } catch {
      Alert.alert("Error", "Could not update goal. Please try again.");
    } finally {
      setIsSettingGoal(false);
    }
  };

  const refetchAll = () => { refetch(); refetchProgress(); refetchRecap(); refetchReview(); refetchCheckIns(); refetchScoreHistory(); };

  const latest = weighInsLbs[0];
  const previous = weighInsLbs[1];
  const diffLbs = latest && previous ? (latest.weightLbs - previous.weightLbs).toFixed(1) : null;
  const diffNum = diffLbs ? parseFloat(diffLbs) : null;

  // Chart data — last 12 weigh-ins, oldest first, in lbs
  const chartData = [...weighInsLbs].reverse().slice(-12).map(w => ({
    label: w.createdAt ? new Date(w.createdAt).toLocaleDateString("en-US", { month: "numeric", day: "numeric" }) : "",
    weight: w.weightLbs,
  }));

  // Score history — last 14 days
  const scoreChartData = scoreHistory.slice(-14);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetchAll} tintColor={colors.primary} />}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Progress</Text>
          <View style={styles.headerBtns}>
            <TouchableOpacity
              style={[styles.checkInBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}
              onPress={() => setShowCheckInModal(true)}
            >
              <Feather name="target" size={14} color={colors.primary} />
              <Text style={[styles.checkInBtnText, { color: colors.primary }]}>Check-In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowWeighModal(true)}>
              <Feather name="plus" size={18} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {latest && (
          <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>Current Weight</Text>
            <View style={styles.heroRow}>
              <Text style={[styles.heroWeight, { color: colors.foreground }]}>{latest.weightLbs}</Text>
              <Text style={[styles.heroUnit, { color: colors.mutedForeground }]}> lbs</Text>
              {diffNum !== null && (
                <View style={[styles.diffBadge, { backgroundColor: diffNum <= 0 ? colors.green + "22" : colors.destructive + "22" }]}>
                  <Feather name={diffNum <= 0 ? "trending-down" : "trending-up"} size={14} color={diffNum <= 0 ? colors.green : colors.destructive} />
                  <Text style={[styles.diffText, { color: diffNum <= 0 ? colors.green : colors.destructive }]}>
                    {diffNum > 0 ? "+" : ""}{diffLbs} lbs
                  </Text>
                </View>
              )}
            </View>
            {latest.createdAt && (
              <Text style={[styles.heroDate, { color: colors.mutedForeground }]}>
                {new Date(latest.createdAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}

        {progress && (
          <View style={styles.statsRow}>
            {progress.progressPercent !== undefined && (
              <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{Math.round(progress.progressPercent)}%</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>to goal</Text>
              </View>
            )}
            {progress.dayStreak !== undefined && (
              <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.amber }]}>{progress.dayStreak}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>day streak</Text>
              </View>
            )}
            {progress.totalWorkouts !== undefined && (
              <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.blue }]}>{progress.totalWorkouts}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>workouts</Text>
              </View>
            )}
            {progress.avgDailyScore !== undefined && (
              <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.green }]}>{Math.round(progress.avgDailyScore)}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>avg score</Text>
              </View>
            )}
          </View>
        )}

        {progress?.goalReached && progress?.goalWeightKg && (
          <View style={[styles.goalReachedCard, { backgroundColor: colors.amber + "18", borderColor: colors.amber + "55" }]}>
            <Text style={styles.goalReachedEmoji}>🏆</Text>
            <Text style={[styles.goalReachedTitle, { color: colors.amber }]}>Goal Reached!</Text>
            <Text style={[styles.goalReachedSub, { color: colors.mutedForeground }]}>
              You hit your goal weight of {kgToLbs(progress.goalWeightKg)} lbs. Time to set a new one!
            </Text>
            {!showGoalSet ? (
              <TouchableOpacity
                style={[styles.goalReachedBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowGoalSet(true)}
              >
                <Text style={[styles.goalReachedBtnText, { color: colors.primaryForeground }]}>Set New Goal</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.goalSetForm}>
                <Text style={[styles.goalSetFormLabel, { color: colors.mutedForeground }]}>What's your new goal?</Text>
                <View style={styles.goalTypeRow}>
                  {[
                    { value: "lose weight", label: "Lose Weight" },
                    { value: "maintain", label: "Maintain" },
                    { value: "gain weight and muscle", label: "Gain Muscle" },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.goalTypeChip, {
                        backgroundColor: newGoalType === opt.value ? colors.primary : colors.background,
                        borderColor: newGoalType === opt.value ? colors.primary : colors.border,
                      }]}
                      onPress={() => setNewGoalType(opt.value)}
                    >
                      <Text style={[styles.goalTypeChipText, {
                        color: newGoalType === opt.value ? colors.primaryForeground : colors.mutedForeground,
                      }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.goalSetFormLabel, { color: colors.mutedForeground }]}>Target weight (lbs)</Text>
                <View style={styles.goalSetRow}>
                  <TextInput
                    style={[styles.goalSetInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                    placeholder="e.g. 165"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    value={newGoalWeightLbs}
                    onChangeText={setNewGoalWeightLbs}
                  />
                  <TouchableOpacity
                    style={[styles.goalReachedBtn, { backgroundColor: colors.primary, opacity: isSettingGoal ? 0.6 : 1 }]}
                    onPress={handleSetNewGoal}
                    disabled={isSettingGoal}
                  >
                    <Text style={[styles.goalReachedBtnText, { color: colors.primaryForeground }]}>
                      {isSettingGoal ? "Saving…" : "Save"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {chartData.length >= 2 && (
          <>
            <SectionHeader title="Weight Trend (lbs)" />
            <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <WeightChart data={chartData} colors={colors} />
            </View>
          </>
        )}

        {scoreChartData.length >= 2 && (
          <>
            <SectionHeader title="Daily Score — Last 14 Days" />
            <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ScoreChart data={scoreChartData} colors={colors} />
            </View>
          </>
        )}

        {progress?.weeklyAdjustment && (
          <View style={[styles.aiCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "33" }]}>
            <Feather name="cpu" size={16} color={colors.primary} />
            <Text style={[styles.aiCardText, { color: colors.foreground }]} numberOfLines={6}>
              {progress.weeklyAdjustment}
            </Text>
          </View>
        )}

        {/* Weekly Review (detailed) */}
        {weeklyReview && (
          <>
            <SectionHeader title="Weekly Review" />
            <View style={[styles.recapCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {weeklyReview.status && (
                <View style={[
                  styles.reviewStatusBadge,
                  {
                    backgroundColor: weeklyReview.status === "ahead" ? colors.green + "15" : weeklyReview.status === "on_track" ? colors.primary + "15" : colors.amber + "15",
                    borderColor: weeklyReview.status === "ahead" ? colors.green + "33" : weeklyReview.status === "on_track" ? colors.primary + "33" : colors.amber + "33",
                  },
                ]}>
                  <Feather
                    name={weeklyReview.status === "ahead" ? "trending-up" : weeklyReview.status === "on_track" ? "check-circle" : "alert-circle"}
                    size={13}
                    color={weeklyReview.status === "ahead" ? colors.green : weeklyReview.status === "on_track" ? colors.primary : colors.amber}
                  />
                  <Text style={[styles.reviewStatusText, {
                    color: weeklyReview.status === "ahead" ? colors.green : weeklyReview.status === "on_track" ? colors.primary : colors.amber,
                  }]}>
                    {weeklyReview.status === "ahead" ? "Ahead of pace" : weeklyReview.status === "on_track" ? "On track" : "Behind pace"}
                  </Text>
                </View>
              )}

              {/* Consistency scores */}
              {[
                { key: "calorieConsistency", label: "Calorie days", icon: "zap", color: colors.amber },
                { key: "proteinConsistency", label: "Protein days", icon: "activity", color: colors.blue },
                { key: "waterConsistency", label: "Water days", icon: "droplet", color: "#06B6D4" },
                { key: "workoutConsistency", label: "Workout days", icon: "award", color: colors.primary },
              ].map(({ key, label, icon, color }) => weeklyReview[key] !== undefined && (
                <View key={key} style={styles.consistencyRow}>
                  <Feather name={icon as any} size={14} color={color} />
                  <Text style={[styles.consistencyLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <Text style={[styles.consistencyValue, { color: colors.foreground }]}>{weeklyReview[key]}/7</Text>
                </View>
              ))}

              {weeklyReview.currentPace && (
                <View style={styles.recapRow}>
                  <Feather name="trending-up" size={14} color={colors.green} />
                  <Text style={[styles.recapLabel, { color: colors.mutedForeground }]}>Current pace</Text>
                  <Text style={[styles.recapValue, { color: colors.foreground }]}>{weeklyReview.currentPace} lbs/wk</Text>
                </View>
              )}

              {weeklyReview.estimatedGoalDate && (
                <View style={styles.recapRow}>
                  <Feather name="calendar" size={14} color={colors.primary} />
                  <Text style={[styles.recapLabel, { color: colors.mutedForeground }]}>Est. goal date</Text>
                  <Text style={[styles.recapValue, { color: colors.foreground }]}>{weeklyReview.estimatedGoalDate}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Goal Pace Predictor */}
        {weeklyReview?.currentPace != null && (
          <>
            <SectionHeader title="Goal Pace Predictor" />
            <View style={[styles.predictorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.predictorRow}>
                <View style={styles.predictorCol}>
                  <Text style={[styles.predictorSub, { color: colors.mutedForeground }]}>Current pace</Text>
                  <Text style={[styles.predictorValue, { color: colors.foreground }]}>
                    {weeklyReview.currentPace > 0 ? "+" : ""}{weeklyReview.currentPace.toFixed(2)} lbs/wk
                  </Text>
                </View>
                <View style={styles.predictorCol}>
                  <Text style={[styles.predictorSub, { color: colors.mutedForeground }]}>Target pace</Text>
                  <Text style={[styles.predictorValue, { color: colors.foreground }]}>
                    {weeklyReview.goalPace?.includes("gain") ? "+0.4" : "-1.0"} lbs/wk
                  </Text>
                </View>
              </View>
              <View style={[styles.predictorBar, { backgroundColor: colors.muted }]}>
                <View style={[styles.predictorFill, {
                  backgroundColor: weeklyReview.status === "ahead" ? colors.green : weeklyReview.status === "on_track" ? colors.primary : colors.amber,
                  width: `${Math.min(Math.abs(weeklyReview.currentPace || 0) / (weeklyReview.goalPace?.includes("gain") ? 0.4 : 1.0) * 100, 100)}%` as any,
                }]} />
              </View>
              <Text style={[styles.predictorStatus, {
                color: weeklyReview.status === "ahead" || weeklyReview.status === "on_track" ? colors.green : colors.amber,
              }]}>
                {weeklyReview.status === "on_track" ? "Right on pace. Stay consistent." :
                 weeklyReview.status === "ahead" ? "Ahead of pace — great work!" :
                 "Behind pace — push harder this week."}
              </Text>
            </View>
          </>
        )}

        {/* Weekly Recap (summary stats) */}
        {recap && (
          <>
            <SectionHeader title="This Week" />
            <View style={[styles.recapCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {recap.weekScore !== undefined && (
                <View style={styles.recapRow}>
                  <Feather name="star" size={14} color={colors.primary} />
                  <Text style={[styles.recapLabel, { color: colors.mutedForeground }]}>Week Score</Text>
                  <Text style={[styles.recapValue, { color: colors.foreground }]}>{Math.round(recap.weekScore)}/100</Text>
                </View>
              )}
              {recap.totalMeals !== undefined && (
                <View style={styles.recapRow}>
                  <Feather name="coffee" size={14} color={colors.green} />
                  <Text style={[styles.recapLabel, { color: colors.mutedForeground }]}>Meals logged</Text>
                  <Text style={[styles.recapValue, { color: colors.foreground }]}>{recap.totalMeals}</Text>
                </View>
              )}
              {recap.totalWorkouts !== undefined && (
                <View style={styles.recapRow}>
                  <Feather name="activity" size={14} color={colors.blue} />
                  <Text style={[styles.recapLabel, { color: colors.mutedForeground }]}>Workouts</Text>
                  <Text style={[styles.recapValue, { color: colors.foreground }]}>{recap.totalWorkouts}</Text>
                </View>
              )}
              {recap.avgEnergy !== undefined && (
                <View style={styles.recapRow}>
                  <Feather name="zap" size={14} color={colors.amber} />
                  <Text style={[styles.recapLabel, { color: colors.mutedForeground }]}>Avg Energy</Text>
                  <Text style={[styles.recapValue, { color: colors.foreground }]}>{recap.avgEnergy}/10</Text>
                </View>
              )}
              {recap.topFix && (
                <View style={[styles.recapFix, { backgroundColor: colors.amber + "12", borderColor: colors.amber + "33" }]}>
                  <Feather name="alert-circle" size={13} color={colors.amber} />
                  <Text style={[styles.recapFixText, { color: colors.foreground }]}>{recap.topFix}</Text>
                </View>
              )}
              {recap.summary && (
                <Text style={[styles.recapSummary, { color: colors.mutedForeground }]}>{recap.summary}</Text>
              )}
            </View>
          </>
        )}

        {checkIns.length > 0 && (
          <>
            <SectionHeader title="Goal Check-Ins" />
            {checkIns.slice(0, 5).map((c, i) => (
              <View key={c.id ?? i} style={[styles.checkInRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.checkInDot, { backgroundColor: colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.checkInMetric, { color: colors.foreground }]}>{c.metric ?? c.value ?? "—"}</Text>
                  {c.notes && <Text style={[styles.checkInNote, { color: colors.mutedForeground }]} numberOfLines={1}>{c.notes}</Text>}
                </View>
                {c.createdAt && (
                  <Text style={[styles.checkInDate, { color: colors.mutedForeground }]}>
                    {new Date(c.createdAt).toLocaleDateString()}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}

        {milestonesData && (Array.isArray(milestonesData) ? milestonesData : (milestonesData as any)?.milestones ?? []).length > 0 && (() => {
          const milestones: any[] = Array.isArray(milestonesData) ? milestonesData : (milestonesData as any)?.milestones ?? [];
          const unlocked = milestones.filter((m: any) => m.unlockedAt);
          const locked = milestones.filter((m: any) => !m.unlockedAt);
          const MILESTONE_COLORS: Record<string, string> = {
            streak: colors.amber,
            weight: colors.green,
            meals: colors.blue,
            consistency: "#a855f7",
          };
          const MILESTONE_ICONS: Record<string, string> = {
            streak: "🔥",
            weight: "⚖️",
            meals: "🥗",
            consistency: "📓",
          };
          return (
            <>
              <SectionHeader title={`Milestones · ${unlocked.length} unlocked`} />
              <View style={styles.milestonesGrid}>
                {unlocked.map((m: any, i: number) => {
                  const cat = m.category ?? "streak";
                  return (
                    <View key={m.id ?? i} style={[styles.milestonePill, { backgroundColor: MILESTONE_COLORS[cat] + "22", borderColor: MILESTONE_COLORS[cat] + "55" }]}>
                      <Text style={styles.milestoneIcon}>{MILESTONE_ICONS[cat] ?? "🏅"}</Text>
                      <Text style={[styles.milestoneLabel, { color: MILESTONE_COLORS[cat] }]} numberOfLines={2}>{m.label ?? m.name ?? m.type}</Text>
                    </View>
                  );
                })}
                {locked.map((m: any, i: number) => (
                  <View key={`locked-${i}`} style={[styles.milestonePill, { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.45 }]}>
                    <Text style={styles.milestoneIcon}>🔒</Text>
                    <Text style={[styles.milestoneLabel, { color: colors.mutedForeground }]} numberOfLines={2}>{m.label ?? m.name ?? m.type}</Text>
                  </View>
                ))}
              </View>
            </>
          );
        })()}

        {rawWeighIns.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="activity" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No weigh-ins yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Log your weight to track progress and get AI-powered adjustments
            </Text>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => setShowWeighModal(true)}>
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Log weight</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <SectionHeader title="Weigh-In History" />
            {weighInsLbs.map((entry, i) => (
              <View key={entry.id ?? i} style={[styles.historyRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.historyDot, { backgroundColor: colors.primary }]} />
                <View style={styles.historyInfo}>
                  <Text style={[styles.historyWeight, { color: colors.foreground }]}>{entry.weightLbs} lbs</Text>
                  {entry.notes && <Text style={[styles.historyNotes, { color: colors.mutedForeground }]} numberOfLines={1}>{entry.notes}</Text>}
                </View>
                {entry.createdAt && (
                  <Text style={[styles.historyDate, { color: colors.mutedForeground }]}>
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </Text>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Weigh-in Modal */}
      <Modal visible={showWeighModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowWeighModal(false)}>
        <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowWeighModal(false)}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Log Weight</Text>
            <TouchableOpacity onPress={handleAddWeighIn} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Weight (lbs)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              placeholder="e.g. 175.5"
              placeholderTextColor={colors.mutedForeground}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              placeholder="How are you feeling?"
              placeholderTextColor={colors.mutedForeground}
              value={notes}
              onChangeText={setNotes}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Goal Check-In Modal */}
      <Modal visible={showCheckInModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowCheckInModal(false)}>
        <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowCheckInModal(false)}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Goal Check-In</Text>
            <TouchableOpacity onPress={handleAddCheckIn} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={[styles.checkInHero, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "33" }]}>
              <Feather name="target" size={18} color={colors.primary} />
              <Text style={[styles.checkInHeroText, { color: colors.foreground }]}>
                Log your current progress metric (weight, body fat %, energy level, etc.)
              </Text>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Metric Value</Text>
            <TextInput
              style={[styles.inputField, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              placeholder="e.g. 175.5 or 22.4"
              placeholderTextColor={colors.mutedForeground}
              value={checkInMetric}
              onChangeText={setCheckInMetric}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Notes (optional)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              placeholder="What are you tracking?"
              placeholderTextColor={colors.mutedForeground}
              value={checkInNotes}
              onChangeText={setCheckInNotes}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  pageTitle: { fontSize: 26, fontFamily: "SpaceMono_700Bold" },
  headerBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkInBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  checkInBtnText: { fontSize: 13, fontFamily: "SpaceMono_700Bold" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  heroCard: { borderRadius: 20, borderWidth: 1, padding: 24, marginBottom: 16 },
  heroLabel: { fontSize: 13, fontFamily: "SpaceMono_400Regular", marginBottom: 6 },
  heroRow: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  heroWeight: { fontSize: 52, fontFamily: "SpaceMono_700Bold" },
  heroUnit: { fontSize: 20, fontFamily: "SpaceMono_400Regular" },
  diffBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  diffText: { fontSize: 13, fontFamily: "SpaceMono_700Bold" },
  heroDate: { fontSize: 12, fontFamily: "SpaceMono_400Regular", marginTop: 6 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  statChip: { flex: 1, minWidth: "22%", borderRadius: 14, borderWidth: 1, padding: 12, alignItems: "center", gap: 2 },
  statValue: { fontSize: 20, fontFamily: "SpaceMono_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "SpaceMono_400Regular", textAlign: "center" },
  chartCard: { borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 20, overflow: "hidden" },
  aiCard: { flexDirection: "row", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 24, alignItems: "flex-start" },
  aiCardText: { flex: 1, fontSize: 14, fontFamily: "SpaceMono_400Regular", lineHeight: 20 },
  reviewStatusBadge: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 4 },
  reviewStatusText: { fontSize: 13, fontFamily: "SpaceMono_700Bold" },
  consistencyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  consistencyLabel: { flex: 1, fontSize: 14, fontFamily: "SpaceMono_400Regular" },
  consistencyValue: { fontSize: 14, fontFamily: "SpaceMono_700Bold" },
  recapCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20, gap: 10 },
  recapRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  recapLabel: { flex: 1, fontSize: 14, fontFamily: "SpaceMono_400Regular" },
  recapValue: { fontSize: 14, fontFamily: "SpaceMono_700Bold" },
  recapFix: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  recapFixText: { fontSize: 13, fontFamily: "SpaceMono_400Regular", flex: 1, lineHeight: 18 },
  recapSummary: { fontSize: 13, fontFamily: "SpaceMono_400Regular", lineHeight: 20, marginTop: 4 },
  goalReachedCard: { borderRadius: 20, borderWidth: 1, padding: 24, marginBottom: 16, alignItems: "center", gap: 8 },
  goalReachedEmoji: { fontSize: 40, marginBottom: 4 },
  goalReachedTitle: { fontSize: 22, fontFamily: "SpaceMono", fontWeight: "700" },
  goalReachedSub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  goalReachedBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
  goalReachedBtnText: { fontSize: 14, fontWeight: "600" },
  goalSetForm: { width: "100%", gap: 8, marginTop: 4 },
  goalSetFormLabel: { fontSize: 12, fontFamily: "SpaceMono_400Regular" },
  goalTypeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  goalTypeChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  goalTypeChipText: { fontSize: 12, fontFamily: "SpaceMono_700Bold" },
  goalSetRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  goalSetInput: { flex: 1, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  predictorCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16, gap: 10 },
  predictorRow: { flexDirection: "row", gap: 16 },
  predictorCol: { flex: 1, gap: 4 },
  predictorSub: { fontSize: 12, fontFamily: "SpaceMono_400Regular" },
  predictorValue: { fontSize: 18, fontFamily: "SpaceMono_700Bold" },
  predictorBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  predictorFill: { height: 6, borderRadius: 3 },
  predictorStatus: { fontSize: 13, fontFamily: "SpaceMono_400Regular" },
  milestonesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  milestonePill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, maxWidth: "47%" },
  milestoneIcon: { fontSize: 16 },
  milestoneLabel: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
  checkInRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14, gap: 12, marginBottom: 8 },
  checkInDot: { width: 8, height: 8, borderRadius: 4 },
  checkInMetric: { fontSize: 15, fontFamily: "SpaceMono_700Bold" },
  checkInNote: { fontSize: 12, fontFamily: "SpaceMono_400Regular", marginTop: 2 },
  checkInDate: { fontSize: 12, fontFamily: "SpaceMono_400Regular" },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "SpaceMono_700Bold" },
  emptyText: { fontSize: 14, fontFamily: "SpaceMono_400Regular", textAlign: "center", lineHeight: 20 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  emptyBtnText: { fontSize: 15, fontFamily: "SpaceMono_700Bold" },
  historyRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14, gap: 12, marginBottom: 8 },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyInfo: { flex: 1 },
  historyWeight: { fontSize: 16, fontFamily: "SpaceMono_700Bold" },
  historyNotes: { fontSize: 12, fontFamily: "SpaceMono_400Regular", marginTop: 2 },
  historyDate: { fontSize: 12, fontFamily: "SpaceMono_400Regular" },
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  modalCancel: { fontSize: 16, fontFamily: "SpaceMono_400Regular" },
  modalTitle: { fontSize: 17, fontFamily: "SpaceMono_700Bold" },
  modalSave: { fontSize: 16, fontFamily: "SpaceMono_700Bold" },
  modalContent: { padding: 20, gap: 8 },
  fieldLabel: { fontSize: 12, fontFamily: "SpaceMono_400Regular", marginBottom: 6, marginTop: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  inputField: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 15, fontFamily: "SpaceMono_400Regular" },
  checkInHero: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  checkInHeroText: { fontSize: 13, fontFamily: "SpaceMono_400Regular", flex: 1, lineHeight: 20 },
});

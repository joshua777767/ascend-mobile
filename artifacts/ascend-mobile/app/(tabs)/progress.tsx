import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import {
  useListWeighIns,
  useCreateWeighIn,
  useGetProgressSummary,
  useGetWeeklyRecap,
  useListGoalCheckIns,
  useCreateGoalCheckIn,
} from "@workspace/api-client-react";

type WeighIn = {
  id?: number;
  weight: number;
  unit?: string;
  notes?: string;
  createdAt?: string;
};

const SCREEN_W = Dimensions.get("window").width;

function WeightChart({ data, colors }: { data: WeighIn[]; colors: any }) {
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
            <SvgText x={pad.left - 6} y={y + 4} fontSize={10} fill={colors.mutedForeground} textAnchor="end" fontFamily="Inter_400Regular">
              {v.toFixed(0)}
            </SvgText>
          </React.Fragment>
        );
      })}
      <Polyline points={pts} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <Circle key={i} cx={toX(i)} cy={toY(d.weight)} r={4} fill={colors.primary} stroke={colors.background} strokeWidth={2} />
      ))}
      {data.length <= 6 && data.map((d, i) => (
        <SvgText key={`lbl-${i}`} x={toX(i)} y={height - 6} fontSize={9} fill={colors.mutedForeground} textAnchor="middle" fontFamily="Inter_400Regular">
          {d.createdAt ? new Date(d.createdAt).toLocaleDateString("en-US", { month: "numeric", day: "numeric" }) : `#${i + 1}`}
        </SvgText>
      ))}
    </Svg>
  );
}

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: weighInsData, isLoading, refetch } = useListWeighIns();
  const { data: progressData, refetch: refetchProgress } = useGetProgressSummary();
  const { data: weeklyRecapData, refetch: refetchRecap } = useGetWeeklyRecap();
  const { data: checkInsData, refetch: refetchCheckIns } = useListGoalCheckIns();
  const addWeighIn = useCreateWeighIn();
  const addCheckIn = useCreateGoalCheckIn();

  const weighIns: WeighIn[] = (weighInsData as any) ?? [];
  const progress = progressData as any;
  const recap = weeklyRecapData as any;
  const checkIns: any[] = (checkInsData as any) ?? [];

  const [showWeighModal, setShowWeighModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [checkInMetric, setCheckInMetric] = useState("");
  const [checkInNotes, setCheckInNotes] = useState("");

  const handleAddWeighIn = async () => {
    const val = parseFloat(weight);
    if (!weight || isNaN(val)) return;
    setIsSubmitting(true);
    try {
      await addWeighIn.mutateAsync({ data: { weightKg: val, ...(notes.trim() ? { notes: notes.trim() } : {}) } });
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

  const refetchAll = () => { refetch(); refetchProgress(); refetchRecap(); refetchCheckIns(); };

  const latest = weighIns[0];
  const previous = weighIns[1];
  const diff = latest && previous ? (latest.weight - previous.weight).toFixed(1) : null;
  const diffNum = diff ? parseFloat(diff) : null;

  const chartData = [...weighIns].reverse().slice(-12);

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
              <Text style={[styles.heroWeight, { color: colors.foreground }]}>{latest.weight}</Text>
              <Text style={[styles.heroUnit, { color: colors.mutedForeground }]}> lbs</Text>
              {diffNum !== null && (
                <View style={[styles.diffBadge, { backgroundColor: diffNum <= 0 ? colors.green + "22" : colors.destructive + "22" }]}>
                  <Feather name={diffNum <= 0 ? "trending-down" : "trending-up"} size={14} color={diffNum <= 0 ? colors.green : colors.destructive} />
                  <Text style={[styles.diffText, { color: diffNum <= 0 ? colors.green : colors.destructive }]}>
                    {diffNum > 0 ? "+" : ""}{diff} lbs
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

        {chartData.length >= 2 && (
          <>
            <SectionHeader title="Weight Trend" />
            <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <WeightChart data={chartData} colors={colors} />
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

        {weighIns.length === 0 ? (
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
            {weighIns.map((entry, i) => (
              <View key={entry.id ?? i} style={[styles.historyRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.historyDot, { backgroundColor: colors.primary }]} />
                <View style={styles.historyInfo}>
                  <Text style={[styles.historyWeight, { color: colors.foreground }]}>{entry.weight} lbs</Text>
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
  pageTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
  headerBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkInBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  checkInBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  heroCard: { borderRadius: 20, borderWidth: 1, padding: 24, marginBottom: 16 },
  heroLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 6 },
  heroRow: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  heroWeight: { fontSize: 52, fontFamily: "Inter_700Bold" },
  heroUnit: { fontSize: 20, fontFamily: "Inter_400Regular" },
  diffBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  diffText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  heroDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 6 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  statChip: { flex: 1, minWidth: "22%", borderRadius: 14, borderWidth: 1, padding: 12, alignItems: "center", gap: 2 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  chartCard: { borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 20, overflow: "hidden" },
  aiCard: { flexDirection: "row", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 24, alignItems: "flex-start" },
  aiCardText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  recapCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 20, gap: 10 },
  recapRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  recapLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  recapValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  recapFix: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  recapFixText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  recapSummary: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, marginTop: 4 },
  checkInRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14, gap: 12, marginBottom: 8 },
  checkInDot: { width: 8, height: 8, borderRadius: 4 },
  checkInMetric: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  checkInNote: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  checkInDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  emptyBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  historyRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14, gap: 12, marginBottom: 8 },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyInfo: { flex: 1 },
  historyWeight: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  historyNotes: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  historyDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  modalCancel: { fontSize: 16, fontFamily: "Inter_400Regular" },
  modalTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  modalSave: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  modalContent: { padding: 20, gap: 8 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, marginTop: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  inputField: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  checkInHero: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 4 },
  checkInHeroText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 20 },
});

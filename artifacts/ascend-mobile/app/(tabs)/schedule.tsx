import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
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
  useGetTodaySchedule,
  useUpdateScheduleItem,
  useCreateCustomTask,
  useDeleteCustomTask,
  useGetCurrentPlan,
} from "@workspace/api-client-react";

type ScheduleItem = {
  id?: number;
  time: string;
  activity: string;
  type: string;
  duration?: string;
  notes?: string | null;
  status?: string | null;
  isCustom?: boolean;
};

const BLOCK_COLORS: Record<string, string> = {
  workout: "#1E8BFF",
  meal: "#22C55E",
  sleep: "#A855F7",
  focus: "#F59E0B",
  rest: "#64748B",
  water: "#06B6D4",
  custom: "#F59E0B",
};

const TASK_TYPES = ["focus", "meal", "workout", "rest", "water", "custom"];

// ─── Time helpers ──────────────────────────────────────────────────────────────

function addMinsToTime(timeStr: string, delta: number): string {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return timeStr;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  const totalMins = hours * 60 + minutes;
  const newTotal = ((totalMins + delta) + 1440) % 1440;
  const h24 = Math.floor(newTotal / 60);
  const m = newTotal % 60;
  const newAmpm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${newAmpm}`;
}

function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return -1;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return -1;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hours !== 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export default function ScheduleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data, isLoading, refetch } = useGetTodaySchedule();
  const { data: planData } = useGetCurrentPlan();
  const updateItem = useUpdateScheduleItem();
  const createTask = useCreateCustomTask();
  const deleteTask = useDeleteCustomTask();

  const plan = planData as any;
  const rawBlocks: ScheduleItem[] = (data as any)?.blocks ?? (Array.isArray(data) ? data : []);
  const todaysMission: string | undefined = (data as any)?.todaysMission;
  const scheduleItems: ScheduleItem[] = (data as any)?.items ?? rawBlocks;

  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newActivity, setNewActivity] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newType, setNewType] = useState("focus");
  const [newNotes, setNewNotes] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const currentMinutes = nowMinutes();

  const getKey = (item: ScheduleItem) => `${item.time}-${item.activity}`;
  const getStatus = (item: ScheduleItem) => localStatuses[getKey(item)] ?? item.status ?? "active";

  // Find the next upcoming item index
  const nextUpIndex = scheduleItems.findIndex((item) => {
    const itemMinutes = parseTimeToMinutes(item.time);
    const status = getStatus(item);
    return itemMinutes >= currentMinutes && status === "active";
  });

  const isMissed = (item: ScheduleItem) => {
    const itemMinutes = parseTimeToMinutes(item.time);
    const status = getStatus(item);
    return itemMinutes >= 0 && itemMinutes < currentMinutes && status === "active";
  };

  const markItem = async (item: ScheduleItem, newStatus: "completed" | "skipped") => {
    const key = getKey(item);
    const currentStatus = getStatus(item);
    const resolvedStatus = currentStatus === newStatus ? "active" : newStatus;
    setLocalStatuses(prev => ({ ...prev, [key]: resolvedStatus }));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await updateItem.mutateAsync({
        data: { activity: item.activity, type: item.type, status: resolvedStatus as any },
      });
    } catch {
      refetch();
    }
  };

  const handleAddTask = async () => {
    if (!newActivity.trim() || !newTime.trim()) {
      Alert.alert("Required", "Task name and time are required.");
      return;
    }
    setIsAdding(true);
    try {
      await createTask.mutateAsync({
        data: { activity: newActivity.trim(), type: newType, time: newTime.trim(), ...(newNotes.trim() ? { notes: newNotes.trim() } : {}) },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAddModal(false);
      setNewActivity(""); setNewTime(""); setNewType("focus"); setNewNotes("");
      refetch();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Couldn't add task");
    } finally {
      setIsAdding(false);
    }
  };

  const handleTimeAdjust = async (item: ScheduleItem, delta: number) => {
    const newTime = addMinsToTime(item.time, delta);
    if (newTime === item.time) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await updateItem.mutateAsync({
        data: { activity: item.activity, type: item.type, time: newTime } as any,
      });
      refetch();
    } catch {
      Alert.alert("Error", "Couldn't update time");
    }
  };

  const handleDeleteTask = (item: ScheduleItem) => {
    if (!item.id) return;
    Alert.alert("Delete Task", `Remove "${item.activity}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTask.mutateAsync({ id: item.id! });
            refetch();
          } catch {}
        },
      },
    ]);
  };

  const doneCount = scheduleItems.filter(b => getStatus(b) === "completed").length;
  const totalCount = scheduleItems.length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>Today's Schedule</Text>
            <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.85}
          >
            <Feather name="plus" size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>

        {/* Today's Mission banner */}
        {todaysMission && (
          <View style={[styles.missionBanner, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "44" }]}>
            <Feather name="target" size={14} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.missionBannerLabel, { color: colors.primary }]}>TODAY'S MISSION</Text>
              <Text style={[styles.missionBannerText, { color: colors.foreground }]}>{todaysMission}</Text>
            </View>
          </View>
        )}

        {plan && (
          <View style={styles.dailyTargets}>
            <View style={styles.targetsGrid}>
              {(plan.calorieTarget ?? plan.dailyCalorieTarget) ? (
                <View style={[styles.targetChip, styles.targetChipThird, { backgroundColor: colors.amber + "18", borderColor: colors.amber + "44" }]}>
                  <Feather name="zap" size={12} color={colors.amber} />
                  <Text style={[styles.targetChipText, { color: colors.amber }]}>{plan.calorieTarget ?? plan.dailyCalorieTarget} cal</Text>
                </View>
              ) : null}
              {(plan.proteinTargetG ?? plan.dailyProteinTarget) ? (
                <View style={[styles.targetChip, styles.targetChipThird, { backgroundColor: colors.blue + "18", borderColor: colors.blue + "44" }]}>
                  <Feather name="activity" size={12} color={colors.blue} />
                  <Text style={[styles.targetChipText, { color: colors.blue }]}>{plan.proteinTargetG ?? plan.dailyProteinTarget}g protein</Text>
                </View>
              ) : null}
              {(plan.waterTargetL ?? plan.waterTargetOz) ? (
                <View style={[styles.targetChip, styles.targetChipThird, { backgroundColor: "#06B6D4" + "18", borderColor: "#06B6D4" + "44" }]}>
                  <Feather name="droplet" size={12} color="#06B6D4" />
                  <Text style={[styles.targetChipText, { color: "#06B6D4" }]}>
                    {plan.waterTargetL ? `${plan.waterTargetL}L water` : `${plan.waterTargetOz}oz water`}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.scheduleHint, { color: colors.mutedForeground }]}>Tap ±15m to adjust time</Text>
          </View>
        )}

        {totalCount > 0 && (
          <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.green, width: `${Math.round((doneCount / totalCount) * 100)}%` as any }]} />
          </View>
        )}
        {totalCount > 0 && (
          <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
            {doneCount}/{totalCount} completed
          </Text>
        )}

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : scheduleItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="calendar" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No schedule yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Complete your profile so we can build your personalized daily schedule.
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/onboarding")}
              activeOpacity={0.85}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Complete Profile</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.timeline}>
            {scheduleItems.map((block, i) => {
              const blockColor = BLOCK_COLORS[block.type?.toLowerCase()] ?? colors.primary;
              const status = getStatus(block);
              const isDone = status === "completed";
              const isSkipped = status === "skipped";
              const missed = isMissed(block);
              const isNextUp = i === nextUpIndex;

              return (
                <View key={i} style={styles.blockRow}>
                  <View style={styles.timeCol}>
                    <Text style={[styles.time, { color: missed ? colors.destructive : colors.mutedForeground }]}>{block.time}</Text>
                    {missed && !isDone && !isSkipped && (
                      <Text style={[styles.missedLabel, { color: colors.destructive }]}>Missed</Text>
                    )}
                  </View>
                  <View style={styles.connector}>
                    <View style={[styles.dot, {
                      backgroundColor: isDone ? colors.green : isSkipped ? colors.mutedForeground : missed ? colors.destructive : blockColor,
                    }]} />
                    {i < scheduleItems.length - 1 && <View style={[styles.line, { backgroundColor: colors.border }]} />}
                  </View>
                  <View style={[
                    styles.blockCard,
                    {
                      backgroundColor: isDone ? colors.green + "0A" : isSkipped ? colors.muted : missed ? colors.destructive + "07" : colors.card,
                      borderColor: isDone ? colors.green + "33" : isSkipped ? colors.border : missed ? colors.destructive + "33" : isNextUp ? colors.primary + "66" : colors.border,
                      borderWidth: isNextUp ? 1.5 : 1,
                      opacity: isSkipped ? 0.6 : 1,
                    },
                  ]}>
                    {isNextUp && (
                      <View style={[styles.nextUpTag, { backgroundColor: colors.primary + "22" }]}>
                        <Feather name="arrow-right" size={10} color={colors.primary} />
                        <Text style={[styles.nextUpText, { color: colors.primary }]}>Next up</Text>
                      </View>
                    )}
                    <View style={styles.blockHeader}>
                      <View style={[styles.typePill, { backgroundColor: blockColor + "22" }]}>
                        <Text style={[styles.typeText, { color: blockColor }]}>{block.type}</Text>
                      </View>
                      <View style={{ flex: 1 }} />
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: isDone ? colors.green + "22" : colors.card, borderColor: isDone ? colors.green + "55" : colors.border }]}
                        onPress={() => markItem(block, "completed")}
                      >
                        <Feather name="check" size={14} color={isDone ? colors.green : colors.mutedForeground} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: isSkipped ? colors.destructive + "22" : colors.card, borderColor: isSkipped ? colors.destructive + "55" : colors.border }]}
                        onPress={() => markItem(block, "skipped")}
                      >
                        <Feather name="x" size={14} color={isSkipped ? colors.destructive : colors.mutedForeground} />
                      </TouchableOpacity>
                      {block.isCustom && block.id && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                          onPress={() => handleDeleteTask(block)}
                        >
                          <Feather name="trash-2" size={12} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.timeAdjBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => handleTimeAdjust(block, -15)}
                      >
                        <Text style={[styles.timeAdjText, { color: colors.mutedForeground }]}>−15</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.timeAdjBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => handleTimeAdjust(block, 15)}
                      >
                        <Text style={[styles.timeAdjText, { color: colors.mutedForeground }]}>+15</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.blockTitle, { color: isDone ? colors.green : missed ? colors.destructive : colors.foreground, textDecorationLine: isSkipped ? "line-through" : "none" }]}>
                      {block.activity}
                    </Text>
                    {block.notes && (
                      <Text style={[styles.blockNotes, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {block.notes}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Task</Text>
            <TouchableOpacity onPress={handleAddTask} disabled={isAdding}>
              {isAdding
                ? <ActivityIndicator color={colors.primary} />
                : <Text style={[styles.modalSave, { color: colors.primary }]}>Add</Text>
              }
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Task Name *</Text>
            <TextInput
              style={[styles.inputField, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              placeholder="e.g. Meditate"
              placeholderTextColor={colors.mutedForeground}
              value={newActivity}
              onChangeText={setNewActivity}
              autoFocus
            />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Time *</Text>
            <TextInput
              style={[styles.inputField, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              placeholder="e.g. 8:00 AM"
              placeholderTextColor={colors.mutedForeground}
              value={newTime}
              onChangeText={setNewTime}
            />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, flexDirection: "row", paddingVertical: 4 }}>
              {TASK_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, { backgroundColor: newType === t ? colors.primary : colors.card, borderColor: newType === t ? colors.primary : colors.border }]}
                  onPress={() => setNewType(t)}
                >
                  <Text style={[styles.typeBtnText, { color: newType === t ? colors.primaryForeground : colors.mutedForeground }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Notes</Text>
            <TextInput
              style={[styles.inputField, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              placeholder="Optional notes"
              placeholderTextColor={colors.mutedForeground}
              value={newNotes}
              onChangeText={setNewNotes}
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
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  pageTitle: { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 2 },
  dateLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginTop: 4 },
  missionBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  missionBannerLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.7, marginBottom: 3 },
  missionBannerText: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20 },
  dailyTargets: { marginBottom: 16 },
  targetsGrid: { flexDirection: "row", gap: 8 },
  targetChipThird: { flex: 1 },
  targetChip: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  targetChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  scheduleHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 8, textAlign: "center" },
  progressBar: { height: 4, borderRadius: 2, overflow: "hidden", marginBottom: 6 },
  progressFill: { height: 4, borderRadius: 2 },
  progressLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 16 },
  centerState: { paddingTop: 80, alignItems: "center" },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  emptyBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  timeline: { gap: 0 },
  blockRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  timeCol: { width: 56, paddingTop: 14, alignItems: "flex-start" },
  time: { fontSize: 11, fontFamily: "Inter_500Medium" },
  missedLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  connector: { width: 24, alignItems: "center", paddingTop: 14 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { width: 2, flex: 1, marginTop: 4 },
  blockCard: { flex: 1, borderRadius: 14, padding: 12, marginLeft: 10, marginBottom: 8 },
  nextUpTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start", marginBottom: 8 },
  nextUpText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  blockHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  typePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  actionBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  blockTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  blockNotes: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  modalCancel: { fontSize: 16, fontFamily: "Inter_400Regular" },
  modalTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  modalSave: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  modalContent: { padding: 20, gap: 6 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, marginTop: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  inputField: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  typeBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  typeBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", textTransform: "capitalize" },
  timeAdjBtn: { paddingHorizontal: 7, height: 30, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  timeAdjText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});

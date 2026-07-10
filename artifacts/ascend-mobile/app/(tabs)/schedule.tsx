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

  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [newActivity, setNewActivity] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newType, setNewType] = useState("focus");
  const [newNotes, setNewNotes] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const getKey = (item: ScheduleItem) => `${item.time}-${item.activity}`;
  const getStatus = (item: ScheduleItem) => localStatuses[getKey(item)] ?? item.status ?? "active";

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
      // optimistic update stays; refetch to sync
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

  const doneCount = rawBlocks.filter(b => getStatus(b) === "completed").length;
  const totalCount = rawBlocks.length;

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

        {plan && (
          <View style={styles.dailyTargets}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targetsRow}>
              {plan.dailyCalorieTarget && (
                <View style={[styles.targetChip, { backgroundColor: colors.amber + "18", borderColor: colors.amber + "44" }]}>
                  <Feather name="zap" size={12} color={colors.amber} />
                  <Text style={[styles.targetChipText, { color: colors.amber }]}>{plan.dailyCalorieTarget} cal</Text>
                </View>
              )}
              {plan.dailyProteinTarget && (
                <View style={[styles.targetChip, { backgroundColor: colors.blue + "18", borderColor: colors.blue + "44" }]}>
                  <Feather name="activity" size={12} color={colors.blue} />
                  <Text style={[styles.targetChipText, { color: colors.blue }]}>{plan.dailyProteinTarget}g protein</Text>
                </View>
              )}
              {plan.weeklyWorkoutDays && (
                <View style={[styles.targetChip, { backgroundColor: "#1E8BFF" + "18", borderColor: "#1E8BFF" + "44" }]}>
                  <Feather name="award" size={12} color="#1E8BFF" />
                  <Text style={[styles.targetChipText, { color: "#1E8BFF" }]}>{plan.weeklyWorkoutDays}x/wk workouts</Text>
                </View>
              )}
            </ScrollView>
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
        ) : rawBlocks.length === 0 ? (
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
            {rawBlocks.map((block, i) => {
              const blockColor = BLOCK_COLORS[block.type?.toLowerCase()] ?? colors.primary;
              const status = getStatus(block);
              const isDone = status === "completed";
              const isSkipped = status === "skipped";
              return (
                <View key={i} style={styles.blockRow}>
                  <View style={styles.timeCol}>
                    <Text style={[styles.time, { color: colors.mutedForeground }]}>{block.time}</Text>
                  </View>
                  <View style={styles.connector}>
                    <View style={[styles.dot, { backgroundColor: isDone ? colors.green : isSkipped ? colors.mutedForeground : blockColor }]} />
                    {i < rawBlocks.length - 1 && <View style={[styles.line, { backgroundColor: colors.border }]} />}
                  </View>
                  <View style={[
                    styles.blockCard,
                    {
                      backgroundColor: isDone ? colors.green + "0A" : isSkipped ? colors.muted : colors.card,
                      borderColor: isDone ? colors.green + "33" : isSkipped ? colors.border : colors.border,
                      opacity: isSkipped ? 0.6 : 1,
                    },
                  ]}>
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
                    </View>
                    <Text style={[styles.blockTitle, { color: isDone ? colors.green : colors.foreground, textDecorationLine: isSkipped ? "line-through" : "none" }]}>
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
  dailyTargets: { marginBottom: 16 },
  targetsRow: { gap: 8, flexDirection: "row" },
  targetChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  targetChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
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
  timeCol: { width: 56, paddingTop: 14 },
  time: { fontSize: 11, fontFamily: "Inter_500Medium" },
  connector: { width: 24, alignItems: "center", paddingTop: 14 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { width: 2, flex: 1, marginTop: 4 },
  blockCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, marginLeft: 10, marginBottom: 8 },
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
});

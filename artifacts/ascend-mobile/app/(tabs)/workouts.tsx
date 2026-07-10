import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useState, useEffect, useCallback } from "react";
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
import { useColors } from "@/hooks/useColors";
import {
  useGetTodayWorkout,
  useListWorkouts,
  useCreateWorkout,
} from "@workspace/api-client-react";

// AsyncStorage key scoped to today's date — auto-resets next day
function getTodayProgressKey(): string {
  const d = new Date();
  return `workout-progress-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Exercise = {
  name: string;
  sets: number;
  reps: string;
  restSeconds?: number;
  coachTip?: string;
};

type TodayWorkout = {
  name: string;
  type: string;
  day?: string;
  exercises: Exercise[];
};

type WorkoutLog = {
  id?: number;
  name: string;
  type?: string;
  durationMinutes?: number;
  notes?: string;
  completedAt: string;
};

export default function WorkoutsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: todayData, isLoading: loadingToday, refetch: refetchToday } = useGetTodayWorkout();
  const { data: historyData, isLoading: loadingHistory, refetch: refetchHistory } = useListWorkouts();
  const createWorkout = useCreateWorkout();

  const todayWorkout = todayData as TodayWorkout | null | undefined;
  const history: WorkoutLog[] = ((historyData as any) ?? []).slice().reverse().slice(0, 10);

  const [completedExercises, setCompletedExercises] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [workoutLogged, setWorkoutLogged] = useState(false);
  const [isLogging, setIsLogging] = useState(false);

  const isLoading = loadingToday || loadingHistory;
  const refetch = () => { refetchToday(); refetchHistory(); };

  // Load persisted progress for today on mount
  useEffect(() => {
    AsyncStorage.getItem(getTodayProgressKey()).then(raw => {
      if (raw) {
        try {
          const indices: number[] = JSON.parse(raw);
          setCompletedExercises(new Set(indices));
        } catch {}
      }
    });
  }, []);

  // Persist progress whenever completedExercises changes
  const saveProgress = useCallback((next: Set<number>) => {
    AsyncStorage.setItem(getTodayProgressKey(), JSON.stringify([...next])).catch(() => {});
  }, []);

  const toggleExercise = async (idx: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCompletedExercises(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      saveProgress(next);
      return next;
    });
  };

  const toggleExpand = (idx: number) => {
    setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const logWorkout = async () => {
    if (!todayWorkout) return;
    setIsLogging(true);
    try {
      await createWorkout.mutateAsync({
        data: {
          name: todayWorkout.name,
          type: todayWorkout.type,
          durationMinutes: 45,
          notes: `Completed ${completedExercises.size}/${todayWorkout.exercises.length} exercises`,
        },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setWorkoutLogged(true);
      refetchHistory();
    } catch {
    } finally {
      setIsLogging(false);
    }
  };

  const allDone = todayWorkout && todayWorkout.exercises.length > 0 &&
    completedExercises.size === todayWorkout.exercises.length;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.dateSub, { color: colors.mutedForeground }]}>
            {new Date().toLocaleDateString("en-US", { weekday: "long" })}
          </Text>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Workout Planner</Text>
        </View>
      </View>

      {/* Today's Workout */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>TODAY'S WORKOUT</Text>

      {loadingToday ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : todayWorkout ? (
        <View style={styles.workoutSection}>
          {/* Workout header */}
          <View style={[styles.workoutHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.workoutHeaderLeft}>
              <Text style={[styles.workoutName, { color: colors.foreground }]}>{todayWorkout.name}</Text>
              {todayWorkout.day && (
                <Text style={[styles.workoutMeta, { color: colors.mutedForeground }]}>
                  {todayWorkout.day} — {todayWorkout.type}
                </Text>
              )}
            </View>
            <View style={[styles.progressBadge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}>
              <Text style={[styles.progressBadgeText, { color: colors.primary }]}>
                {completedExercises.size}/{todayWorkout.exercises.length}
              </Text>
            </View>
          </View>

          {/* Exercise list */}
          {todayWorkout.exercises.map((ex, idx) => {
            const done = completedExercises.has(idx);
            const isExpanded = expanded[idx];
            return (
              <View
                key={idx}
                style={[
                  styles.exerciseCard,
                  {
                    backgroundColor: done ? colors.primary + "0A" : colors.card,
                    borderColor: done ? colors.primary + "44" : colors.border,
                  },
                ]}
              >
                <View style={styles.exerciseTop}>
                  <View style={styles.exerciseInfo}>
                    <Text style={[
                      styles.exerciseName,
                      { color: done ? colors.mutedForeground : colors.foreground, textDecorationLine: done ? "line-through" : "none" },
                    ]}>
                      {ex.name}
                    </Text>
                    <View style={styles.exerciseMeta}>
                      <Text style={[styles.exerciseMetaText, { color: colors.mutedForeground }]}>
                        {ex.sets} sets × {ex.reps}
                      </Text>
                      {ex.restSeconds && (
                        <Text style={[styles.exerciseMetaText, { color: colors.mutedForeground }]}>
                          {ex.restSeconds}s rest
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.exerciseActions}>
                    {ex.coachTip && (
                      <TouchableOpacity
                        style={styles.expandBtn}
                        onPress={() => toggleExpand(idx)}
                        activeOpacity={0.7}
                      >
                        <Feather
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={colors.mutedForeground}
                        />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => toggleExercise(idx)} activeOpacity={0.7}>
                      <Feather
                        name="check-circle"
                        size={22}
                        color={done ? colors.primary : colors.mutedForeground}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                {isExpanded && ex.coachTip && (
                  <View style={[styles.coachTip, { borderTopColor: colors.border }]}>
                    <Text style={[styles.coachTipLabel, { color: colors.primary }]}>Coach Tip</Text>
                    <Text style={[styles.coachTipText, { color: colors.mutedForeground }]}>{ex.coachTip}</Text>
                  </View>
                )}
              </View>
            );
          })}

          {/* Log button */}
          {!workoutLogged ? (
            <TouchableOpacity
              style={[
                styles.logBtn,
                {
                  backgroundColor: completedExercises.size === 0 ? colors.muted : colors.primary,
                  opacity: completedExercises.size === 0 || isLogging ? 0.6 : 1,
                },
              ]}
              onPress={logWorkout}
              disabled={completedExercises.size === 0 || isLogging}
              activeOpacity={0.85}
            >
              {isLogging ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <Text style={[styles.logBtnText, { color: completedExercises.size === 0 ? colors.mutedForeground : colors.primaryForeground }]}>
                  {allDone ? "Log Completed Workout" : `Log Workout (${completedExercises.size} done)`}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={[styles.loggedCard, { backgroundColor: colors.green + "15", borderColor: colors.green + "33" }]}>
              <Feather name="check-circle" size={18} color={colors.green} />
              <View>
                <Text style={[styles.loggedTitle, { color: colors.green }]}>Workout Logged</Text>
                <Text style={[styles.loggedSub, { color: colors.mutedForeground }]}>Good work. Rest and recover.</Text>
              </View>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.restCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="moon" size={36} color={colors.mutedForeground} />
          <Text style={[styles.restTitle, { color: colors.foreground }]}>Rest day</Text>
          <Text style={[styles.restSub, { color: colors.mutedForeground }]}>
            No workout scheduled for today, or your plan hasn't been set up yet.
          </Text>
        </View>
      )}

      {/* Recent Workouts */}
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>RECENT WORKOUTS</Text>

      {loadingHistory ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
      ) : history.length > 0 ? (
        <View style={styles.historyList}>
          {history.map((w, i) => (
            <View key={w.id ?? i} style={[styles.historyRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.historyInfo}>
                <Text style={[styles.historyName, { color: colors.foreground }]}>{w.name}</Text>
                <Text style={[styles.historyMeta, { color: colors.mutedForeground }]}>
                  {new Date(w.completedAt).toLocaleDateString()}{w.durationMinutes ? ` — ${w.durationMinutes} min` : ""}
                </Text>
              </View>
              {w.type && (
                <View style={[styles.typeBadge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "33" }]}>
                  <Text style={[styles.typeBadgeText, { color: colors.primary }]}>{w.type}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyHistory, { borderColor: colors.border }]}>
          <Feather name="clock" size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyHistoryText, { color: colors.mutedForeground }]}>No workouts logged yet</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20 },
  headerRow: { marginBottom: 20 },
  dateSub: { fontSize: 13, fontFamily: "SpaceMono_400Regular", marginBottom: 2 },
  pageTitle: { fontSize: 26, fontFamily: "SpaceMono_700Bold" },
  sectionLabel: { fontSize: 11, fontFamily: "SpaceMono_700Bold", letterSpacing: 0.8, marginBottom: 12 },
  centerState: { paddingTop: 60, alignItems: "center" },
  workoutSection: { gap: 10, marginBottom: 8 },
  workoutHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, borderWidth: 1, padding: 16 },
  workoutHeaderLeft: { flex: 1 },
  workoutName: { fontSize: 16, fontFamily: "SpaceMono_700Bold" },
  workoutMeta: { fontSize: 12, fontFamily: "SpaceMono_400Regular", marginTop: 2 },
  progressBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  progressBadgeText: { fontSize: 13, fontFamily: "SpaceMono_700Bold" },
  exerciseCard: { borderRadius: 14, borderWidth: 1, padding: 14 },
  exerciseTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: 15, fontFamily: "SpaceMono_700Bold", marginBottom: 4 },
  exerciseMeta: { flexDirection: "row", gap: 14 },
  exerciseMetaText: { fontSize: 12, fontFamily: "SpaceMono_400Regular" },
  exerciseActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  expandBtn: { padding: 2 },
  coachTip: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  coachTipLabel: { fontSize: 11, fontFamily: "SpaceMono_700Bold", marginBottom: 4 },
  coachTipText: { fontSize: 13, fontFamily: "SpaceMono_400Regular", lineHeight: 18 },
  logBtn: { borderRadius: 14, padding: 16, alignItems: "center", justifyContent: "center", marginTop: 4 },
  logBtnText: { fontSize: 15, fontFamily: "SpaceMono_700Bold" },
  loggedCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, marginTop: 4 },
  loggedTitle: { fontSize: 15, fontFamily: "SpaceMono_700Bold" },
  loggedSub: { fontSize: 12, fontFamily: "SpaceMono_400Regular", marginTop: 2 },
  restCard: { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: "center", gap: 10, marginBottom: 8 },
  restTitle: { fontSize: 17, fontFamily: "SpaceMono_700Bold" },
  restSub: { fontSize: 14, fontFamily: "SpaceMono_400Regular", textAlign: "center", lineHeight: 20 },
  historyList: { gap: 8 },
  historyRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14, gap: 12 },
  historyInfo: { flex: 1 },
  historyName: { fontSize: 14, fontFamily: "SpaceMono_400Regular" },
  historyMeta: { fontSize: 12, fontFamily: "SpaceMono_400Regular", marginTop: 2 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  typeBadgeText: { fontSize: 12, fontFamily: "SpaceMono_400Regular", textTransform: "capitalize" },
  emptyHistory: { borderRadius: 12, borderWidth: 1, padding: 24, alignItems: "center", gap: 8 },
  emptyHistoryText: { fontSize: 13, fontFamily: "SpaceMono_400Regular" },
});

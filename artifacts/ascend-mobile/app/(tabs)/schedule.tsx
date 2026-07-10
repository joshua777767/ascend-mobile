import { Feather } from "@expo/vector-icons";
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
import { useColors } from "@/hooks/useColors";
import { useGetTodaySchedule } from "@workspace/api-client-react";

type ScheduleBlock = {
  time: string;
  title: string;
  type: string;
  duration?: string;
  notes?: string;
};

const BLOCK_COLORS: Record<string, string> = {
  workout: "#1E8BFF",
  meal: "#22C55E",
  sleep: "#A855F7",
  focus: "#F59E0B",
  rest: "#64748B",
  water: "#06B6D4",
};

export default function ScheduleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, isLoading, refetch } = useGetTodaySchedule();

  const blocks: ScheduleBlock[] = (data as any)?.blocks ?? (Array.isArray(data) ? data : []);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <Text style={[styles.pageTitle, { color: colors.foreground }]}>Today's Schedule</Text>
      <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </Text>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : blocks.length === 0 ? (
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
            <Text style={[styles.emptyBtnText, { color: "#080D12" }]}>Complete Profile</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.timeline}>
          {blocks.map((block, i) => {
            const blockColor = BLOCK_COLORS[block.type?.toLowerCase()] ?? colors.primary;
            return (
              <View key={i} style={styles.blockRow}>
                <View style={styles.timeCol}>
                  <Text style={[styles.time, { color: colors.mutedForeground }]}>{block.time}</Text>
                </View>
                <View style={styles.connector}>
                  <View style={[styles.dot, { backgroundColor: blockColor }]} />
                  {i < blocks.length - 1 && <View style={[styles.line, { backgroundColor: colors.border }]} />}
                </View>
                <View style={[styles.blockCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.blockHeader}>
                    <View style={[styles.typePill, { backgroundColor: blockColor + "22" }]}>
                      <Text style={[styles.typeText, { color: blockColor }]}>{block.type}</Text>
                    </View>
                    {block.duration && (
                      <Text style={[styles.duration, { color: colors.mutedForeground }]}>{block.duration}</Text>
                    )}
                  </View>
                  <Text style={[styles.blockTitle, { color: colors.foreground }]}>{block.title}</Text>
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20 },
  pageTitle: { fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 4 },
  dateLabel: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 24 },
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
  blockCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, marginLeft: 10, marginBottom: 8 },
  blockHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  typePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  duration: { fontSize: 12, fontFamily: "Inter_400Regular" },
  blockTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  blockNotes: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});

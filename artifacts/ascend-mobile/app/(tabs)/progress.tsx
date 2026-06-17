import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { SectionHeader } from "@/components/SectionHeader";
import {
  useListWeighIns,
  useCreateWeighIn,
  useGetProgressSummary,
} from "@workspace/api-client-react";

type WeighIn = {
  id?: number;
  weight: number;
  unit?: string;
  notes?: string;
  createdAt?: string;
};

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: weighInsData, isLoading, refetch } = useListWeighIns();
  const { data: progressData } = useGetProgressSummary();
  const addWeighIn = useCreateWeighIn();

  const weighIns: WeighIn[] = (weighInsData as any) ?? [];
  const progress = progressData as any;

  const [showModal, setShowModal] = useState(false);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async () => {
    const val = parseFloat(weight);
    if (!weight || isNaN(val)) return;
    setIsSubmitting(true);
    try {
      await addWeighIn.mutateAsync({
        data: { weightKg: val, ...(notes.trim() ? { notes: notes.trim() } : {}) },
      });
      setShowModal(false);
      setWeight("");
      setNotes("");
      refetch();
    } catch {}
    finally { setIsSubmitting(false); }
  };

  const latest = weighIns[0];
  const previous = weighIns[1];
  const diff = latest && previous ? (latest.weight - previous.weight).toFixed(1) : null;
  const diffNum = diff ? parseFloat(diff) : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Progress</Text>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowModal(true)}
          >
            <Feather name="plus" size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>

        {latest && (
          <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>Current Weight</Text>
            <View style={styles.heroRow}>
              <Text style={[styles.heroWeight, { color: colors.foreground }]}>{latest.weight}</Text>
              <Text style={[styles.heroUnit, { color: colors.mutedForeground }]}> lbs</Text>
              {diffNum !== null && (
                <View style={[
                  styles.diffBadge,
                  { backgroundColor: diffNum <= 0 ? colors.green + "22" : colors.destructive + "22" },
                ]}>
                  <Feather
                    name={diffNum <= 0 ? "trending-down" : "trending-up"}
                    size={14}
                    color={diffNum <= 0 ? colors.green : colors.destructive}
                  />
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

        {progress?.weeklyAdjustment && (
          <View style={[styles.aiCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "33" }]}>
            <Feather name="cpu" size={16} color={colors.primary} />
            <Text style={[styles.aiCardText, { color: colors.foreground }]} numberOfLines={5}>
              {progress.weeklyAdjustment}
            </Text>
          </View>
        )}

        {weighIns.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="activity" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No weigh-ins yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Log your weight to track progress and get AI-powered adjustments
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowModal(true)}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Log weight</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <SectionHeader title="History" />
            {weighIns.map((entry, i) => (
              <View key={entry.id ?? i} style={[styles.historyRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.historyDot, { backgroundColor: colors.primary }]} />
                <View style={styles.historyInfo}>
                  <Text style={[styles.historyWeight, { color: colors.foreground }]}>{entry.weight} lbs</Text>
                  {entry.notes && (
                    <Text style={[styles.historyNotes, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {entry.notes}
                    </Text>
                  )}
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

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Log Weight</Text>
            <TouchableOpacity onPress={handleAdd} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>
              )}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  pageTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  heroCard: { borderRadius: 20, borderWidth: 1, padding: 24, marginBottom: 20 },
  heroLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 6 },
  heroRow: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  heroWeight: { fontSize: 52, fontFamily: "Inter_700Bold" },
  heroUnit: { fontSize: 20, fontFamily: "Inter_400Regular" },
  diffBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  diffText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  heroDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 6 },
  aiCard: { flexDirection: "row", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 24, alignItems: "flex-start" },
  aiCardText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
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
});

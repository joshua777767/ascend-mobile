import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import {
  useListJournalEntries,
  useGetTodayJournalEntry,
  useCreateJournalEntry,
  useGenerateReview,
  useGetTodayReview,
} from "@workspace/api-client-react";

type JournalEntry = {
  id?: number;
  date?: string;
  followedSchedule?: boolean;
  hitProtein?: boolean;
  stayedNearCalories?: boolean;
  workedOut?: boolean;
  drankWater?: boolean;
  sleptOnTime?: boolean;
  energyRating?: number;
  skinBloatingRating?: number;
  biggestWin?: string;
  whatWentWrong?: string;
  needHelpWith?: string;
  createdAt?: string;
};

function Toggle({ label, value, onToggle, color }: { label: string; value: boolean; onToggle: () => void; color: string }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[
        styles.toggleRow,
        { backgroundColor: value ? color + "18" : colors.card, borderColor: value ? color + "55" : colors.border },
      ]}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      <Feather name={value ? "check-circle" : "circle"} size={18} color={value ? color : colors.mutedForeground} />
      <Text style={[styles.toggleLabel, { color: value ? color : colors.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function RatingRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const colors = useColors();
  return (
    <View style={styles.ratingSection}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.ratingPills}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
          <TouchableOpacity
            key={n}
            style={[
              styles.ratingPill,
              { backgroundColor: n <= value ? colors.primary : colors.muted, borderColor: n <= value ? colors.primary : colors.border },
            ]}
            onPress={() => onChange(n)}
          >
            <Text style={[styles.ratingNum, { color: n <= value ? colors.primaryForeground : colors.mutedForeground }]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function JournalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: entriesData, isLoading, refetch } = useListJournalEntries();
  const { data: todayEntry, refetch: refetchToday } = useGetTodayJournalEntry();
  const { data: todayReviewData, refetch: refetchReview } = useGetTodayReview();
  const createEntry = useCreateJournalEntry();
  const generateReview = useGenerateReview();

  const entries: JournalEntry[] = (entriesData as any) ?? [];
  const today = todayEntry as any;
  const todayReview = todayReviewData as any;
  const hasToday = !!today;

  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [followedSchedule, setFollowedSchedule] = useState(false);
  const [hitProtein, setHitProtein] = useState(false);
  const [stayedNearCalories, setStayedNearCalories] = useState(false);
  const [workedOut, setWorkedOut] = useState(false);
  const [drankWater, setDrankWater] = useState(false);
  const [sleptOnTime, setSleptOnTime] = useState(false);
  const [energyRating, setEnergyRating] = useState(5);
  const [skinBloatingRating, setSkinBloatingRating] = useState(5);
  const [biggestWin, setBiggestWin] = useState("");
  const [whatWentWrong, setWhatWentWrong] = useState("");
  const [needHelpWith, setNeedHelpWith] = useState("");

  const resetForm = () => {
    setFollowedSchedule(false); setHitProtein(false); setStayedNearCalories(false);
    setWorkedOut(false); setDrankWater(false); setSleptOnTime(false);
    setEnergyRating(5); setSkinBloatingRating(5);
    setBiggestWin(""); setWhatWentWrong(""); setNeedHelpWith("");
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await createEntry.mutateAsync({
        data: {
          followedSchedule, hitProtein, stayedNearCalories,
          workedOut, drankWater, sleptOnTime,
          energyRating, skinBloatingRating,
          biggestWin: biggestWin.trim() || "–",
          ...(whatWentWrong.trim() ? { whatWentWrong: whatWentWrong.trim() } : {}),
          ...(needHelpWith.trim() ? { needHelpWith: needHelpWith.trim() } : {}),
        },
      });
      generateReview.mutate({} as any);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowModal(false);
      resetForm();
      refetch();
      refetchToday();
      // Poll for review after a moment
      setTimeout(() => refetchReview(), 4000);
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  const boolScore = [followedSchedule, hitProtein, stayedNearCalories, workedOut, drankWater, sleptOnTime].filter(Boolean).length;

  const reviewScoreColor = todayReview?.dailyScore >= 75
    ? colors.green
    : todayReview?.dailyScore >= 50
    ? colors.primary
    : colors.destructive;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Journal</Text>
          {!hasToday && (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowModal(true)}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={18} color={colors.primaryForeground} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.dateSub, { color: colors.mutedForeground }]}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </Text>

        {hasToday ? (
          <>
            <View style={[styles.todayCard, { backgroundColor: colors.card, borderColor: colors.primary + "44" }]}>
              <View style={styles.todayTop}>
                <Feather name="check-circle" size={18} color={colors.green} />
                <Text style={[styles.todayTitle, { color: colors.foreground }]}>Today's entry logged</Text>
              </View>
              <View style={styles.boolGrid}>
                {[
                  { key: "followedSchedule", label: "Schedule" },
                  { key: "hitProtein", label: "Protein" },
                  { key: "stayedNearCalories", label: "Calories" },
                  { key: "workedOut", label: "Workout" },
                  { key: "drankWater", label: "Water" },
                  { key: "sleptOnTime", label: "Sleep" },
                ].map(({ key, label }) => {
                  const val = today[key] === true;
                  return (
                    <View
                      key={key}
                      style={[styles.boolChip, { backgroundColor: val ? colors.green + "20" : colors.muted, borderColor: val ? colors.green + "44" : colors.border }]}
                    >
                      <Feather name={val ? "check" : "x"} size={12} color={val ? colors.green : colors.mutedForeground} />
                      <Text style={[styles.boolChipText, { color: val ? colors.green : colors.mutedForeground }]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
              {today.biggestWin && today.biggestWin !== "–" && (
                <View style={[styles.winBox, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "33" }]}>
                  <Feather name="star" size={13} color={colors.primary} />
                  <Text style={[styles.winText, { color: colors.foreground }]}>{today.biggestWin}</Text>
                </View>
              )}
              <View style={styles.ratings}>
                <View style={styles.ratingChip}>
                  <Feather name="zap" size={13} color={colors.amber} />
                  <Text style={[styles.ratingChipText, { color: colors.mutedForeground }]}>Energy: <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>{today.energyRating}/10</Text></Text>
                </View>
              </View>
            </View>

            {/* AI Coach Review */}
            {todayReview ? (
              <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.primary + "33" }]}>
                <View style={styles.reviewHeader}>
                  <View style={[styles.reviewIconWrap, { backgroundColor: colors.primary + "18" }]}>
                    <Feather name="cpu" size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.reviewTitle, { color: colors.foreground }]}>AI Coach Review</Text>
                  <View style={[styles.reviewScoreBadge, { backgroundColor: reviewScoreColor + "22" }]}>
                    <Text style={[styles.reviewScoreText, { color: reviewScoreColor }]}>{todayReview.dailyScore}/100</Text>
                  </View>
                </View>

                {todayReview.onPace !== undefined && (
                  <View style={[styles.paceBadge, { backgroundColor: todayReview.onPace ? colors.green + "15" : colors.amber + "15", borderColor: todayReview.onPace ? colors.green + "33" : colors.amber + "33" }]}>
                    <Feather name={todayReview.onPace ? "trending-up" : "alert-circle"} size={13} color={todayReview.onPace ? colors.green : colors.amber} />
                    <Text style={[styles.paceText, { color: todayReview.onPace ? colors.green : colors.amber }]}>
                      {todayReview.onPace ? "On pace for your goal" : "Slightly off pace — adjustments below"}
                    </Text>
                  </View>
                )}

                {todayReview.biggestWin && (
                  <View style={styles.reviewRow}>
                    <Feather name="star" size={14} color={colors.green} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reviewRowLabel, { color: colors.mutedForeground }]}>Biggest Win</Text>
                      <Text style={[styles.reviewRowText, { color: colors.foreground }]}>{todayReview.biggestWin}</Text>
                    </View>
                  </View>
                )}

                {todayReview.biggestMistake && (
                  <View style={styles.reviewRow}>
                    <Feather name="alert-circle" size={14} color={colors.destructive} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reviewRowLabel, { color: colors.mutedForeground }]}>Biggest Mistake</Text>
                      <Text style={[styles.reviewRowText, { color: colors.foreground }]}>{todayReview.biggestMistake}</Text>
                    </View>
                  </View>
                )}

                {todayReview.exactFixForTomorrow && (
                  <View style={[styles.fixBox, { backgroundColor: colors.amber + "12", borderColor: colors.amber + "33" }]}>
                    <Feather name="arrow-right-circle" size={14} color={colors.amber} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reviewRowLabel, { color: colors.amber }]}>Fix for Tomorrow</Text>
                      <Text style={[styles.reviewRowText, { color: colors.foreground }]}>{todayReview.exactFixForTomorrow}</Text>
                    </View>
                  </View>
                )}

                {todayReview.strictCoachMessage && (
                  <Text style={[styles.coachMessage, { color: colors.mutedForeground }]}>{todayReview.strictCoachMessage}</Text>
                )}
              </View>
            ) : generateReview.isPending ? (
              <View style={[styles.reviewLoading, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={[styles.reviewLoadingText, { color: colors.mutedForeground }]}>Coach is reviewing your day…</Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={[styles.emptyToday, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="book-open" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTodayTitle, { color: colors.foreground }]}>Log today's habits</Text>
            <Text style={[styles.emptyTodayText, { color: colors.mutedForeground }]}>
              Takes 60 seconds. Your coach uses this to build tomorrow's plan.
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowModal(true)}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Log Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {entries.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PAST ENTRIES</Text>
            {entries.slice(0, 14).map((entry, i) => {
              const score = [entry.followedSchedule, entry.hitProtein, entry.stayedNearCalories, entry.workedOut, entry.drankWater, entry.sleptOnTime].filter(Boolean).length;
              const pct = Math.round((score / 6) * 100);
              const scoreColor = pct >= 75 ? colors.green : pct >= 50 ? colors.primary : colors.destructive;
              return (
                <View key={entry.id ?? i} style={[styles.entryRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.entryInfo}>
                    <Text style={[styles.entryDate, { color: colors.foreground }]}>
                      {entry.date ?? (entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : "—")}
                    </Text>
                    {entry.biggestWin && entry.biggestWin !== "–" && (
                      <Text style={[styles.entryWin, { color: colors.mutedForeground }]} numberOfLines={1}>{entry.biggestWin}</Text>
                    )}
                  </View>
                  <View style={[styles.scoreChip, { backgroundColor: scoreColor + "20" }]}>
                    <Text style={[styles.scoreChipText, { color: scoreColor }]}>{pct}%</Text>
                  </View>
                </View>
              );
            })}
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
            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Today's Check-In</Text>
            <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting
                ? <ActivityIndicator color={colors.primary} />
                : <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.formSection, { color: colors.mutedForeground }]}>WHAT DID YOU DO TODAY?</Text>
            <View style={styles.toggleGrid}>
              <Toggle label="Followed schedule" value={followedSchedule} onToggle={() => setFollowedSchedule(v => !v)} color={colors.primary} />
              <Toggle label="Hit protein goal" value={hitProtein} onToggle={() => setHitProtein(v => !v)} color={colors.blue} />
              <Toggle label="Stayed near calories" value={stayedNearCalories} onToggle={() => setStayedNearCalories(v => !v)} color={colors.green} />
              <Toggle label="Worked out" value={workedOut} onToggle={() => setWorkedOut(v => !v)} color={colors.purple} />
              <Toggle label="Drank water goal" value={drankWater} onToggle={() => setDrankWater(v => !v)} color={colors.blue} />
              <Toggle label="Slept on time" value={sleptOnTime} onToggle={() => setSleptOnTime(v => !v)} color={colors.amber} />
            </View>

            <View style={[styles.scorePreview, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "33" }]}>
              <Text style={[styles.scorePreviewText, { color: colors.primary }]}>
                Today's score preview: {boolScore}/6 habits · {Math.round((boolScore / 6) * 100)}%
              </Text>
            </View>

            <RatingRow label="Energy Level" value={energyRating} onChange={setEnergyRating} />
            <RatingRow label="Skin & Bloating" value={skinBloatingRating} onChange={setSkinBloatingRating} />

            <Text style={[styles.formSection, { color: colors.mutedForeground, marginTop: 8 }]}>REFLECT</Text>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Biggest Win Today *</Text>
            <TextInput
              style={[styles.textArea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              placeholder="What went well?"
              placeholderTextColor={colors.mutedForeground}
              value={biggestWin}
              onChangeText={setBiggestWin}
              multiline
              numberOfLines={2}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>What Went Wrong?</Text>
            <TextInput
              style={[styles.textArea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              placeholder="Any obstacles or misses?"
              placeholderTextColor={colors.mutedForeground}
              value={whatWentWrong}
              onChangeText={setWhatWentWrong}
              multiline
              numberOfLines={2}
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Need Help With?</Text>
            <TextInput
              style={[styles.textArea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              placeholder="What should your coach address tomorrow?"
              placeholderTextColor={colors.mutedForeground}
              value={needHelpWith}
              onChangeText={setNeedHelpWith}
              multiline
              numberOfLines={2}
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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  pageTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
  dateSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 20 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  todayCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16, gap: 12 },
  todayTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  todayTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  boolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  boolChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  boolChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  winBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  winText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  ratings: { flexDirection: "row", gap: 12 },
  ratingChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratingChipText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  reviewCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 24, gap: 12 },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewIconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  reviewTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  reviewScoreBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  reviewScoreText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  paceBadge: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  paceText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  reviewRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  reviewRowLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  reviewRowText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  fixBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  coachMessage: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, fontStyle: "italic" },
  reviewLoading: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 24 },
  reviewLoadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyToday: { borderRadius: 16, borderWidth: 1, padding: 24, marginBottom: 24, alignItems: "center", gap: 10 },
  emptyTodayTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyTodayText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  emptyBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14, marginTop: 4 },
  emptyBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },
  entryRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 14, gap: 12, marginBottom: 8 },
  entryInfo: { flex: 1 },
  entryDate: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  entryWin: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  scoreChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  scoreChipText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  modalCancel: { fontSize: 16, fontFamily: "Inter_400Regular" },
  modalTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  modalSave: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  modalContent: { padding: 20, gap: 6, paddingBottom: 60 },
  formSection: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginTop: 8, marginBottom: 8 },
  toggleGrid: { gap: 8 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  toggleLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  scorePreview: { padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "center" },
  scorePreviewText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  ratingSection: { marginTop: 8 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, marginTop: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  ratingPills: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  ratingPill: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  ratingNum: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  textArea: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", textAlignVertical: "top", minHeight: 72 },
});

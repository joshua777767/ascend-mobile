import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
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
import { useSubscription } from "@/contexts/SubscriptionContext";
import {
  useListMeals,
  useCreateMeal,
  useGenerateMeals,
} from "@workspace/api-client-react";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

const PREFERENCES = [
  { label: "High Protein", value: "high protein" },
  { label: "Cheap", value: "cheap" },
  { label: "Quick", value: "quick" },
  { label: "No Cooking", value: "no cooking" },
  { label: "School Friendly", value: "school friendly" },
  { label: "Athlete Friendly", value: "athlete friendly" },
];

type MealEntry = {
  id?: number;
  mealType: string;
  description: string;
  calories?: number;
  protein?: number;
  aiFeedback?: string;
  quality?: string;
  createdAt?: string;
};

const QUALITY_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  good: { color: "#22C55E", icon: "thumbs-up", label: "Good" },
  neutral: { color: "#F59E0B", icon: "minus", label: "OK" },
  bad: { color: "#EF4444", icon: "thumbs-down", label: "Improve" },
};

export default function MealsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isPro } = useSubscription();

  const { data: mealsData, isLoading, refetch } = useListMeals();
  const meals: MealEntry[] = (mealsData as any) ?? [];
  const logMeal = useCreateMeal();
  const generateMeals = useGenerateMeals();

  const [showLogModal, setShowLogModal] = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);

  // Log form — description + photo only (matches web)
  const [description, setDescription] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generator form
  const [genMealType, setGenMealType] = useState("breakfast");
  const [genPreference, setGenPreference] = useState("");
  const [genAvailableFoods, setGenAvailableFoods] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<string | null>(null);

  const MEAL_COLORS: Record<string, string> = {
    breakfast: colors.amber,
    lunch: colors.green,
    dinner: colors.blue,
    snack: colors.purple,
  };

  const openCamera = async () => {
    if (Platform.OS === "web") { Alert.alert("Camera not available on web"); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Camera permission required"); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Photo library permission required"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!description.trim()) { Alert.alert("Description required", "Please describe what you ate."); return; }
    setIsSubmitting(true);
    try {
      // Send description directly — same as web (no mealType prepend, no calories/protein)
      await logMeal.mutateAsync({
        data: {
          description: description.trim(),
          ...(imageUri ? { imageUrl: imageUri } : {}),
        },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowLogModal(false);
      setDescription(""); setImageUri(null);
      refetch();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to log meal");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedPlan(null);
    try {
      const result = await generateMeals.mutateAsync({
        data: {
          mealType: genMealType,
          ...(genPreference ? { preference: genPreference } : {}),
          ...(genAvailableFoods.trim() ? { availableFoods: genAvailableFoods.trim() } : {}),
        },
      } as any);
      const plan = (result as any)?.plan ?? (result as any)?.meals ?? JSON.stringify(result);
      setGeneratedPlan(typeof plan === "string" ? plan : JSON.stringify(plan, null, 2));
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not generate meal plan");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Meals</Text>
          <View style={styles.headerBtns}>
            {isPro && (
              <TouchableOpacity
                style={[styles.genBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "44" }]}
                onPress={() => setShowGenModal(true)}
                activeOpacity={0.85}
              >
                <Feather name="cpu" size={14} color={colors.primary} />
                <Text style={[styles.genBtnText, { color: colors.primary }]}>AI Plan</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowLogModal(true)}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={18} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.centerState}><ActivityIndicator color={colors.primary} size="large" /></View>
        ) : meals.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="coffee" size={44} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No meals logged</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Tap + to log your first meal and get AI feedback
            </Text>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={() => setShowLogModal(true)}>
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>Log a meal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.mealList}>
            {meals.map((meal, i) => {
              const dotColor = MEAL_COLORS[meal.mealType?.toLowerCase()] ?? colors.primary;
              const qualityCfg = meal.quality ? QUALITY_CONFIG[meal.quality] : null;
              const ageMs = meal.createdAt ? Date.now() - new Date(meal.createdAt).getTime() : Infinity;
              const timedOut = ageMs > 25_000;
              return (
                <View key={meal.id ?? i} style={[styles.mealCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.mealCardHeader}>
                    <View style={[styles.typeBadge, { backgroundColor: dotColor + "22" }]}>
                      <Text style={[styles.typeText, { color: dotColor }]}>{meal.mealType}</Text>
                    </View>
                    <View style={styles.mealCardMeta}>
                      {meal.calories && (
                        <Text style={[styles.calsText, { color: colors.mutedForeground }]}>{meal.calories} kcal</Text>
                      )}
                      {qualityCfg && (
                        <View style={[styles.qualityBadge, { backgroundColor: qualityCfg.color + "20" }]}>
                          <Feather name={qualityCfg.icon as any} size={11} color={qualityCfg.color} />
                          <Text style={[styles.qualityText, { color: qualityCfg.color }]}>{qualityCfg.label}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.mealDesc, { color: colors.foreground }]} numberOfLines={2}>
                    {meal.description}
                  </Text>
                  {meal.aiFeedback ? (
                    <View style={[styles.feedbackBox, { backgroundColor: colors.green + "15", borderColor: colors.green + "44" }]}>
                      <Feather name="cpu" size={12} color={colors.green} />
                      <Text style={[styles.feedbackText, { color: colors.green }]} numberOfLines={3}>
                        {meal.aiFeedback}
                      </Text>
                    </View>
                  ) : isPro ? (
                    timedOut ? (
                      <View style={[styles.feedbackBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                        <Feather name="alert-circle" size={12} color={colors.mutedForeground} />
                        <Text style={[styles.feedbackText, { color: colors.mutedForeground }]}>
                          AI feedback unavailable for this meal.
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.feedbackBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                        <ActivityIndicator size="small" color={colors.mutedForeground} />
                        <Text style={[styles.feedbackText, { color: colors.mutedForeground }]}>AI is analyzing…</Text>
                      </View>
                    )
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Log Meal Modal — description + photo only */}
      <Modal visible={showLogModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowLogModal(false)}>
        <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setShowLogModal(false); setDescription(""); setImageUri(null); }}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Log Meal</Text>
            <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.modalSave, { color: colors.primary }]}>Save</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>What did you eat?</Text>
            <TextInput
              style={[styles.textArea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              placeholder="Describe your meal — e.g. 2 eggs, toast with butter, black coffee"
              placeholderTextColor={colors.mutedForeground}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              autoFocus
            />
            <View style={[styles.aiDisclaimer, { backgroundColor: colors.amber + "10", borderColor: colors.amber + "33" }]}>
              <Feather name="info" size={12} color={colors.amber} />
              <Text style={[styles.aiDisclaimerText, { color: colors.mutedForeground }]}>
                AI food estimates may be inaccurate. Always verify nutrition information when accuracy matters.
              </Text>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Photo (optional)</Text>
            {imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <TouchableOpacity style={[styles.removeImageBtn, { backgroundColor: colors.card }]} onPress={() => setImageUri(null)}>
                  <Feather name="x" size={14} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoRow}>
                <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={openCamera}>
                  <Feather name="camera" size={20} color={colors.blue} />
                  <Text style={[styles.photoBtnText, { color: colors.foreground }]}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={openGallery}>
                  <Feather name="image" size={20} color={colors.purple} />
                  <Text style={[styles.photoBtnText, { color: colors.foreground }]}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* AI Meal Generator Modal */}
      <Modal visible={showGenModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowGenModal(false)}>
        <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setShowGenModal(false); setGeneratedPlan(null); }}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Close</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>AI Meal Generator</Text>
            <TouchableOpacity onPress={handleGenerate} disabled={isGenerating}>
              {isGenerating ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.modalSave, { color: colors.primary }]}>Generate</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={[styles.genHero, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "33" }]}>
              <Feather name="cpu" size={20} color={colors.primary} />
              <Text style={[styles.genHeroText, { color: colors.foreground }]}>
                Your AI coach will generate a meal plan tailored to your goals and macro targets.
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Meal Type</Text>
            <View style={styles.chipRow}>
              {MEAL_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chipBtn, { backgroundColor: genMealType === t ? colors.primary : colors.card, borderColor: genMealType === t ? colors.primary : colors.border }]}
                  onPress={() => setGenMealType(t)}
                >
                  <Text style={[styles.chipBtnText, { color: genMealType === t ? colors.primaryForeground : colors.mutedForeground }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Preference</Text>
            <View style={styles.chipRow}>
              {PREFERENCES.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.chipBtn, { backgroundColor: genPreference === p.value ? colors.primary : colors.card, borderColor: genPreference === p.value ? colors.primary : colors.border }]}
                  onPress={() => setGenPreference(prev => prev === p.value ? "" : p.value)}
                >
                  <Text style={[styles.chipBtnText, { color: genPreference === p.value ? colors.primaryForeground : colors.mutedForeground }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Foods you have (optional)</Text>
            <TextInput
              style={[styles.textArea, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
              placeholder="e.g. chicken breast, rice, broccoli, eggs"
              placeholderTextColor={colors.mutedForeground}
              value={genAvailableFoods}
              onChangeText={setGenAvailableFoods}
              multiline
              numberOfLines={3}
            />

            {generatedPlan && (
              <View style={[styles.genResult, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.genResultHeader}>
                  <Feather name="check-circle" size={16} color={colors.green} />
                  <Text style={[styles.genResultTitle, { color: colors.green }]}>Meal Plan Ready</Text>
                </View>
                <Text style={[styles.genResultText, { color: colors.foreground }]}>{generatedPlan}</Text>
              </View>
            )}
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
  genBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  genBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  centerState: { paddingTop: 80, alignItems: "center" },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  emptyBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  mealList: { gap: 12 },
  mealCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  mealCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mealCardMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  calsText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  qualityBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  qualityText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  mealDesc: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  feedbackBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  feedbackText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  modalRoot: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  modalCancel: { fontSize: 16, fontFamily: "Inter_400Regular" },
  modalTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  modalSave: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  modalContent: { padding: 20, gap: 8 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, marginTop: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  textArea: { borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", minHeight: 100, textAlignVertical: "top" },
  photoRow: { flexDirection: "row", gap: 12 },
  photoBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 12, borderWidth: 1 },
  photoBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  imagePreviewContainer: { position: "relative" },
  imagePreview: { width: "100%", height: 200, borderRadius: 12 },
  removeImageBtn: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  aiDisclaimer: { flexDirection: "row", alignItems: "flex-start", gap: 7, borderRadius: 10, borderWidth: 1, padding: 10 },
  aiDisclaimerText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 16 },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 4 },
  chipBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", textTransform: "capitalize" },
  genHero: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  genHeroText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 20 },
  genResult: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10, marginTop: 8 },
  genResultHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  genResultTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  genResultText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
});

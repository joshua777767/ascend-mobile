import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useResetUserProfile } from "@workspace/api-client-react";
import RevenueCatUI from "react-native-purchases-ui";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";

function openLink(path: string) {
  const url = `https://${DOMAIN}${path}`;
  WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title.toUpperCase()}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function Row({
  icon, label, sublabel, onPress, destructive, rightIcon = "chevron-right",
}: {
  icon: string; label: string; sublabel?: string; onPress: () => void; destructive?: boolean; rightIcon?: string;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowIcon, { backgroundColor: (destructive ? colors.destructive : colors.primary) + "20" }]}>
        <Feather name={icon as any} size={16} color={destructive ? colors.destructive : colors.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: destructive ? colors.destructive : colors.foreground }]}>{label}</Text>
        {sublabel && <Text style={[styles.rowSublabel, { color: colors.mutedForeground }]}>{sublabel}</Text>}
      </View>
      <Feather name={rightIcon as any} size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function Divider() {
  const colors = useColors();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { logout } = useAuth();
  const resetProfile = useResetUserProfile();
  const [isDeleting, setIsDeleting] = useState(false);

  const { isPro } = useSubscription();

  const handleLogout = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    logout();
  };

  const handleOpenCustomerCenter = async () => {
    try {
      await RevenueCatUI.presentCustomerCenter();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not open subscription management.");
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your profile, goals, meal logs, journal entries, weigh-ins, workout history, and coach chat history. This cannot be undone.\n\nAre you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              await resetProfile.mutateAsync();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              logout();
            } catch {
              Alert.alert("Error", "Could not delete account data. Please try again or contact support@ascend.app");
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Health Disclaimer */}
        <View style={[styles.disclaimerBox, { backgroundColor: colors.amber + "12", borderColor: colors.amber + "40" }]}>
          <View style={styles.disclaimerHeader}>
            <Feather name="alert-triangle" size={14} color={colors.amber} />
            <Text style={[styles.disclaimerTitle, { color: colors.amber }]}>Health Disclaimer</Text>
          </View>
          <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
            Ascend Fit provides general fitness, nutrition, and habit-tracking information only. It is not medical advice, diagnosis, or treatment. Always consult a qualified healthcare professional before starting a diet, exercise program, or weight-loss plan, especially if you have a medical condition, injury, eating disorder history, or are under medical care.
          </Text>
        </View>

        {/* Emergency Disclaimer */}
        <View style={[styles.emergencyBox, { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "40" }]}>
          <View style={styles.disclaimerHeader}>
            <Feather name="alert-octagon" size={14} color={colors.destructive} />
            <Text style={[styles.disclaimerTitle, { color: colors.destructive }]}>Emergency Notice</Text>
          </View>
          <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
            If you feel chest pain, severe dizziness, fainting, trouble breathing, or a medical emergency, stop exercising immediately and seek emergency medical help.
          </Text>
        </View>

        <Section title="Legal">
          <Row
            icon="file-text"
            label="Terms of Service"
            onPress={() => openLink("/terms")}
          />
          <Divider />
          <Row
            icon="shield"
            label="Privacy Policy"
            onPress={() => openLink("/privacy")}
          />
        </Section>

        <Section title="Your Data">
          <View style={styles.dataInfo}>
            <Text style={[styles.dataInfoTitle, { color: colors.foreground }]}>What Ascend Fit stores</Text>
            {[
              "Email address and account credentials",
              "Profile: age, height, weight, body type, fitness level",
              "Goals and key habits",
              "Daily meal logs and AI feedback",
              "Workout history and schedules",
              "Water and sleep tracking",
              "Journal entries and nightly reviews",
              "Weigh-in history",
              "Coach chat messages",
              "Subscription and payment status",
            ].map((item, i) => (
              <View key={i} style={styles.dataRow}>
                <View style={[styles.dataDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.dataItem, { color: colors.mutedForeground }]}>{item}</Text>
              </View>
            ))}
            <Text style={[styles.dataNote, { color: colors.mutedForeground }]}>
              Data is not sold to third parties. AI responses are generated by OpenAI. See our Privacy Policy for full details.
            </Text>
          </View>
        </Section>

        {isPro && (
          <Section title="Subscription">
            <Row
              icon="credit-card"
              label="Manage Subscription"
              sublabel="Cancel, change plan, or restore"
              onPress={handleOpenCustomerCenter}
            />
          </Section>
        )}

        <Section title="Account">
          <Row
            icon="log-out"
            label="Sign Out"
            onPress={handleLogout}
          />
          <Divider />
          <TouchableOpacity style={styles.row} onPress={handleDeleteAccount} disabled={isDeleting} activeOpacity={0.7}>
            <View style={[styles.rowIcon, { backgroundColor: colors.destructive + "20" }]}>
              {isDeleting
                ? <ActivityIndicator size="small" color={colors.destructive} />
                : <Feather name="trash-2" size={16} color={colors.destructive} />
              }
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, { color: colors.destructive }]}>Delete Account & Data</Text>
              <Text style={[styles.rowSublabel, { color: colors.mutedForeground }]}>Permanently removes all your data</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </Section>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          Ascend Fit · v1.0.0{"\n"}Results vary by individual. Not a substitute for medical advice.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 8 },
  disclaimerBox: {
    borderRadius: 14, borderWidth: 1, padding: 14, gap: 8, marginBottom: 4,
  },
  emergencyBox: {
    borderRadius: 14, borderWidth: 1, padding: 14, gap: 8, marginBottom: 16,
  },
  disclaimerHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  disclaimerTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  disclaimerText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginBottom: 6, marginLeft: 4 },
  sectionCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  rowSublabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  dataInfo: { padding: 16, gap: 8 },
  dataInfoTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  dataRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  dataDot: { width: 5, height: 5, borderRadius: 3, marginTop: 6 },
  dataItem: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 19 },
  dataNote: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16, marginTop: 8 },
  version: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18, marginTop: 8 },
});

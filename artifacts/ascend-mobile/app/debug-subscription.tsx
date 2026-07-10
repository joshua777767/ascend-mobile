import React, { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Purchases from "react-native-purchases";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function DebugSubscriptionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { customerInfo, isPro, refresh } = useSubscription();
  const [restoreResult, setRestoreResult] = useState<string>("Not run yet");
  const [isRestoring, setIsRestoring] = useState(false);
  const [rawCustomerInfo, setRawCustomerInfo] = useState<string>("Not fetched yet");

  const handleRestore = useCallback(async () => {
    setIsRestoring(true);
    setRestoreResult("Running restorePurchases()…");
    try {
      const info = await Purchases.restorePurchases();
      setRestoreResult(JSON.stringify(info, null, 2));
    } catch (e: any) {
      setRestoreResult(`ERROR: ${e?.message ?? String(e)}`);
    } finally {
      setIsRestoring(false);
    }
  }, []);

  const handleGetCustomerInfo = useCallback(async () => {
    setRawCustomerInfo("Fetching…");
    try {
      const info = await Purchases.getCustomerInfo();
      setRawCustomerInfo(JSON.stringify(info, null, 2));
    } catch (e: any) {
      setRawCustomerInfo(`ERROR: ${e?.message ?? String(e)}`);
    }
  }, []);

  // Build a detailed diagnostic report from the current context state.
  const diagnostic = {
    appUserId: (customerInfo as any)?.appUserId ?? null,
    originalAppUserId: (customerInfo as any)?.originalAppUserId ?? null,
    ascendUserId: user?.id ?? null,
    entitlementId: "entl67aca298cd",
    allActiveEntitlementKeys: customerInfo
      ? Object.keys((customerInfo as any).entitlements?.active ?? {})
      : null,
    targetEntitlementExists: customerInfo
      ? !!(customerInfo as any).entitlements?.active?.["entl67aca298cd"]
      : null,
    targetEntitlementIsActive: customerInfo
      ? (customerInfo as any).entitlements?.active?.["entl67aca298cd"]?.isActive ??
        null
      : null,
    isPro,
    paywallShouldShow: !isPro,
  };

  return (
    <View
      style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}
    >
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={[styles.backText, { color: colors.foreground }]}>
          &#8592; Back
        </Text>
      </TouchableOpacity>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Debug Subscription
        </Text>

        <View style={[styles.card, { backgroundColor: colors.card }]}
>          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Diagnostic Report
          </Text>
          <Text
            style={[styles.code, { color: colors.foreground }]}
            selectable
          >
            {JSON.stringify(diagnostic, null, 2)}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={handleGetCustomerInfo}
        >
          <Text style={styles.btnText}>Refresh CustomerInfo (raw)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={handleRestore}
          disabled={isRestoring}
        >
          <Text style={styles.btnText}>
            {isRestoring ? "Restoring…" : "Restore Purchases (raw result)"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.muted }]}
          onPress={() => refresh()}
        >
          <Text style={styles.btnText}>Refresh Subscription Context</Text>
        </TouchableOpacity>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Raw CustomerInfo (getCustomerInfo)
          </Text>
          <Text
            style={[styles.code, { color: colors.foreground }]}
            selectable
          >
            {rawCustomerInfo}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Restore Purchases Result
          </Text>
          <Text
            style={[styles.code, { color: colors.foreground }]}
            selectable
          >
            {restoreResult}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  backText: { fontSize: 16 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  card: { borderRadius: 12, padding: 12, gap: 8 },
  label: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  code: {
    fontSize: 12,
    fontFamily: "monospace",
    lineHeight: 18,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  btnText: { color: "#080D12", fontSize: 15, fontWeight: "600" },
});

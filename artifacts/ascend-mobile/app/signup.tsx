import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "";

function openLink(path: string) {
  const url = `https://${DOMAIN}${path}`;
  WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
  });
}

function Checkbox({ checked, onToggle, label, linkLabel, onLinkPress }: {
  checked: boolean; onToggle: () => void; label?: string; linkLabel?: string; onLinkPress?: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity style={styles.checkRow} onPress={onToggle} activeOpacity={0.75}>
      <View style={[
        styles.checkBox,
        { borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : "transparent" },
      ]}>
        {checked && <Feather name="check" size={11} color={colors.primaryForeground} />}
      </View>
      <Text style={[styles.checkLabel, { color: colors.mutedForeground }]}>
        {label}
        {linkLabel && (
          <Text onPress={onLinkPress} style={[styles.checkLink, { color: colors.primary }]}>
            {linkLabel}
          </Text>
        )}
      </Text>
    </TouchableOpacity>
  );
}

export default function SignupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signup } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [parentalConsent, setParentalConsent] = useState(false);
  const [tosAgreed, setTosAgreed] = useState(false);

  const handleSignup = async () => {
    if (!username.trim() || !email.trim() || !password) {
      setError("All fields are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!ageConfirmed) {
      setError("You must confirm you are 13 years of age or older.");
      return;
    }
    if (!parentalConsent) {
      setError("You must confirm parental/guardian consent if you are under 18.");
      return;
    }
    if (!tosAgreed) {
      setError("You must agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await signup(username.trim(), email.trim(), password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/onboarding");
    } catch (e: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(e?.message ?? "Signup failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#F59E0B22", "#080D12"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.45 }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoArea}>
            <View style={[styles.logoCircle, { borderColor: colors.primary + "44", backgroundColor: colors.card }]}>
              <Feather name="zap" size={36} color={colors.primary} />
            </View>
            <Text style={[styles.appName, { color: colors.foreground }]}>Ascend</Text>
            <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
              Your AI coach for body, energy & focus
            </Text>
          </View>

          {/* Health Disclaimer */}
          <View style={[styles.disclaimerBox, { backgroundColor: colors.amber + "10", borderColor: colors.amber + "44" }]}>
            <Feather name="alert-triangle" size={13} color={colors.amber} style={{ marginTop: 1 }} />
            <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
              <Text style={{ color: colors.amber, fontFamily: "Inter_600SemiBold" }}>Health Notice: </Text>
              Ascend Fit provides general fitness and nutrition guidance only. It is not medical advice. Consult a healthcare professional before starting any diet or exercise program, especially if you have a medical condition or history of eating disorders.
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>Create account</Text>

            {error && (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "22", borderColor: colors.destructive + "66" }]}>
                <Feather name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            )}

            <View style={styles.fields}>
              <View style={[styles.inputWrapper, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="user" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Username"
                  placeholderTextColor={colors.mutedForeground}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoComplete="username"
                  returnKeyType="next"
                />
              </View>
              <View style={[styles.inputWrapper, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="mail" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Email"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  returnKeyType="next"
                />
              </View>
              <View style={[styles.inputWrapper, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Feather name="lock" size={16} color={colors.mutedForeground} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Password (min 8 characters)"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  returnKeyType="done"
                  onSubmitEditing={handleSignup}
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Age gate */}
            <Checkbox
              checked={ageConfirmed}
              onToggle={() => setAgeConfirmed((v) => !v)}
              label="I confirm that I am 13 years of age or older. Ascend Fit is not available for users under 13."
            />

            {/* Parental consent */}
            <Checkbox
              checked={parentalConsent}
              onToggle={() => setParentalConsent((v) => !v)}
              label="If I am under 18, I have permission from my parent or legal guardian to use Ascend Fit."
            />

            {/* ToS + Privacy */}
            <Checkbox
              checked={tosAgreed}
              onToggle={() => setTosAgreed((v) => !v)}
              label="I agree to the "
              linkLabel="Terms of Service and Privacy Policy"
              onLinkPress={() => openLink("/terms")}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]}
              onPress={handleSignup}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              Already have an account?{" "}
            </Text>
            <Link href="/login" asChild>
              <Pressable>
                <Text style={[styles.footerLink, { color: colors.primary }]}>Sign In</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24 },
  logoArea: { alignItems: "center", marginBottom: 24 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 20, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  appName: { fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: -0.5, marginBottom: 6 },
  tagline: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  disclaimerBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16,
  },
  disclaimerText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  card: { borderRadius: 20, borderWidth: 1, padding: 24, gap: 16 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  fields: { gap: 12 },
  inputWrapper: {
    flexDirection: "row", alignItems: "center", borderRadius: 12,
    borderWidth: 1, paddingHorizontal: 14, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  eyeBtn: { padding: 4 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkBox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  checkLabel: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  checkLink: { fontFamily: "Inter_600SemiBold" },
  primaryBtn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  footerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});

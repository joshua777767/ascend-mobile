import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useGetUserProfile } from "@workspace/api-client-react";

const SLIDES = [
  {
    icon: "zap" as const,
    title: "Built Around Your Real Life",
    body: "No generic cookie-cutter plans. Ascend builds your schedule, meals, and workouts around your actual wake time, goals, and pace.",
    accent: "#F59E0B",
  },
  {
    icon: "cpu" as const,
    title: "An AI Coach That Learns",
    body: "Your coach tracks every meal, workout, and weigh-in — then adjusts your plan weekly so you keep making progress.",
    accent: "#1E8BFF",
  },
  {
    icon: "map" as const,
    title: "Your Plan Starts Now",
    body: "Five quick questions. Personalized calorie target, protein goal, daily schedule, and workout plan — generated instantly.",
    accent: "#22C55E",
  },
];

function IntroGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: profile } = useGetUserProfile();
  if (profile) {
    router.replace("/(tabs)");
    return null;
  }
  return <>{children}</>;
}

export default function IntroScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [current, setCurrent] = useState(0);

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  const goNext = () => {
    if (isLast) {
      router.replace("/onboarding");
    } else {
      setCurrent(c => c + 1);
    }
  };

  return (
    <IntroGuard>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.skip, { paddingTop: insets.top + 12 }]}
          onPress={() => router.replace("/onboarding")}
        >
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
        </TouchableOpacity>

        <View style={styles.body}>
          <View style={[styles.iconRing, { backgroundColor: slide.accent + "20", borderColor: slide.accent + "44" }]}>
            <Feather name={slide.icon} size={48} color={slide.accent} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>{slide.title}</Text>
          <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>{slide.body}</Text>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === current ? colors.primary : colors.muted,
                    width: i === current ? 20 : 8,
                  },
                ]}
              />
            ))}
          </View>
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: colors.primary }]}
            onPress={goNext}
            activeOpacity={0.85}
          >
            <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>
              {isLast ? "Start My Plan" : "Next"}
            </Text>
            <Feather name={isLast ? "arrow-right" : "chevron-right"} size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </View>
    </IntroGuard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  skip: { position: "absolute", top: 0, right: 20, zIndex: 10, paddingHorizontal: 4, paddingVertical: 8 },
  skipText: { fontSize: 14, fontFamily: "SpaceMono_400Regular" },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 24 },
  iconRing: { width: 120, height: 120, borderRadius: 32, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontFamily: "SpaceMono_700Bold", textAlign: "center", lineHeight: 34 },
  bodyText: { fontSize: 16, fontFamily: "SpaceMono_400Regular", textAlign: "center", lineHeight: 24 },
  footer: { paddingHorizontal: 24, gap: 24 },
  dots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  nextBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 56, borderRadius: 16 },
  nextBtnText: { fontSize: 17, fontFamily: "SpaceMono_700Bold" },
});

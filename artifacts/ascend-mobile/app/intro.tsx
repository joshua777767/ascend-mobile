import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export const INTRO_SEEN_KEY = "ascend_intro_seen";

const { width: SCREEN_W } = Dimensions.get("window");

const SLIDES = [
  {
    icon: "zap" as const,
    accent: "#F59E0B",
    title: "Your AI Coach for Body, Energy & Focus",
    body: "Ascend builds a fully personalized plan around your real life — meals, workouts, habits, and daily coaching — then adjusts it every week.",
    pills: ["AI-powered", "Fully personalized", "Updates weekly"],
  },
  {
    icon: "cpu" as const,
    accent: "#3B82F6",
    title: "An AI Coach That Learns",
    body: "Every meal you log, every weigh-in, every workout — your coach tracks it all and refines your plan automatically to keep you making progress.",
    pills: ["Weekly plan adjustments", "Context-aware coaching"],
  },
  {
    icon: "target" as const,
    accent: "#22C55E",
    title: "Precision Calories & Macros",
    body: "Calorie, protein, and water targets calculated from your body stats, activity, and pace. Athletes get separate Rest Day, Practice Day, and Game Day targets.",
    pills: ["Calorie & protein targets", "Sport day splits"],
  },
  {
    icon: "coffee" as const,
    accent: "#F97316",
    title: "Log Meals. Get Instant Feedback.",
    body: "Describe what you ate in plain English. Your AI coach responds instantly — what worked, what to fix, and what to eat for your next meal.",
    pills: ["Instant AI feedback", "Meal quality scoring"],
  },
  {
    icon: "activity" as const,
    accent: "#A855F7",
    title: "Workouts Built for Your Gear",
    body: "No gym? Bodyweight only. Home gym? Equipment-matched. Full gym? Everything unlocked. Workouts auto-generate around your schedule.",
    pills: ["Equipment-matched", "Auto-scheduled"],
  },
  {
    icon: "trending-up" as const,
    accent: "#06B6D4",
    title: "Track Your Transformation",
    body: "Log weekly weigh-ins and your AI coach automatically adjusts your calorie targets to keep your progress on track — no guessing.",
    pills: ["Progress charts", "Auto plan updates"],
  },
  {
    icon: "droplet" as const,
    accent: "#0EA5E9",
    title: "Stay Hydrated. Hit Your Missions.",
    body: "Hit your daily water target, check off your key habits, and earn your Ascend Score — a single 0–100 daily performance number.",
    pills: ["Daily score (0–100)", "Habit tracking & streaks"],
  },
  {
    icon: "book-open" as const,
    accent: "#F43F5E",
    title: "Nightly Review. Real Accountability.",
    body: "Write your evening journal and your AI coach scores your day, identifies exactly what held you back, and gives you precise fixes for tomorrow.",
    pills: ["AI-scored nightly review", "Exact tomorrow fixes"],
  },
];

export default function IntroScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AsyncStorage.getItem(INTRO_SEEN_KEY).then((val) => {
      if (val === "true") {
        router.replace("/onboarding");
      } else {
        setReady(true);
      }
    });
  }, []);

  const finishIntro = async () => {
    await AsyncStorage.setItem(INTRO_SEEN_KEY, "true");
    router.replace("/onboarding");
  };

  const goNext = async () => {
    await Haptics.selectionAsync();
    if (current === SLIDES.length - 1) {
      finishIntro();
      return;
    }
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setCurrent((c) => c + 1);
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  if (!ready) return null;

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={[styles.skip, { paddingTop: insets.top + 14 }]}
        onPress={finishIntro}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip</Text>
      </TouchableOpacity>

      <Animated.View style={[styles.body, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={[slide.accent + "18", slide.accent + "06", "transparent"]}
          style={styles.iconGradient}
        >
          <View style={[styles.iconRing, { backgroundColor: slide.accent + "1A", borderColor: slide.accent + "50" }]}>
            <Feather name={slide.icon} size={52} color={slide.accent} />
          </View>
        </LinearGradient>

        <Text style={[styles.title, { color: colors.foreground }]}>{slide.title}</Text>
        <Text style={[styles.bodyText, { color: colors.mutedForeground }]}>{slide.body}</Text>

        <View style={styles.pills}>
          {slide.pills.map((pill, i) => (
            <View key={i} style={[styles.pill, { backgroundColor: slide.accent + "18", borderColor: slide.accent + "44" }]}>
              <Text style={[styles.pillText, { color: slide.accent }]}>{pill}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === current ? colors.primary : colors.muted,
                  width: i === current ? 22 : 7,
                  opacity: i === current ? 1 : 0.4,
                },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: colors.primary }]}
          onPress={goNext}
          activeOpacity={0.82}
        >
          <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>
            {isLast ? "Build My Plan" : "Next"}
          </Text>
          <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>

        <Text style={[styles.counter, { color: colors.mutedForeground }]}>
          {current + 1} / {SLIDES.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  skip: {
    position: "absolute",
    top: 0,
    right: 20,
    zIndex: 10,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  skipText: { fontSize: 14, fontFamily: "SpaceMono_400Regular" },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 20,
    paddingTop: 24,
  },
  iconGradient: {
    width: 160,
    height: 160,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  iconRing: {
    width: 128,
    height: 128,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontFamily: "SpaceMono_700Bold",
    textAlign: "center",
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  bodyText: {
    fontSize: 15,
    fontFamily: "SpaceMono_400Regular",
    textAlign: "center",
    lineHeight: 23,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12,
    fontFamily: "SpaceMono_700Bold",
    letterSpacing: 0.2,
  },
  footer: {
    paddingHorizontal: 24,
    gap: 16,
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  dot: { height: 7, borderRadius: 4 },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 16,
    alignSelf: "stretch",
  },
  nextBtnText: { fontSize: 17, fontFamily: "SpaceMono_700Bold" },
  counter: { fontSize: 12, fontFamily: "SpaceMono_400Regular" },
});

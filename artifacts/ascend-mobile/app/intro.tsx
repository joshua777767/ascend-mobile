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

// Matches the web intro exactly — same 3 slides, same copy
const SLIDES = [
  {
    icon: "⚡",
    title: "Your Personal AI Fitness Coach",
    text: "Whether your goal is to lose weight, gain weight, build muscle, stay fit, or improve energy, Ascend builds a plan specifically for you.",
  },
  {
    icon: "🎯",
    title: "Everything You Need In One Place",
    text: "Get personalized nutrition, custom workouts, daily coaching, progress tracking, habit building, and streaks — without guessing what to do next.",
  },
  {
    icon: "🗺️",
    title: "Built Around Your Goal",
    text: "Tell Ascend about your body, lifestyle, goal, timeline, gym access, and activity level. Then get a personalized roadmap made for you.",
  },
];

const AMBER = "#F59E0B";
const AMBER_DARK = "hsl(38, 95%, 44%)";

export default function IntroScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);

  const slideX = useRef(new Animated.Value(0)).current;
  const slideOpacity = useRef(new Animated.Value(1)).current;

  // Check if intro has been seen; skip straight to onboarding if so
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

  function goTo(next: number, dir: "forward" | "back") {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    const outX = dir === "forward" ? -SCREEN_W * 0.3 : SCREEN_W * 0.3;
    const inX = dir === "forward" ? SCREEN_W * 0.3 : -SCREEN_W * 0.3;
    Animated.parallel([
      Animated.timing(slideOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(slideX, { toValue: outX, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setCurrent(next);
      slideX.setValue(inX);
      Animated.parallel([
        Animated.timing(slideOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(slideX, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => setAnimating(false));
    });
  }

  const handleNext = async () => {
    await Haptics.selectionAsync();
    if (current === SLIDES.length - 1) {
      finishIntro();
    } else {
      goTo(current + 1, "forward");
    }
  };

  if (!ready) return null;

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Ambient amber orbs — matches web radial-gradient blobs */}
      <View style={styles.orb1} pointerEvents="none" />
      <View style={styles.orb2} pointerEvents="none" />

      {/* AscendFit logo — matches web AuthHeader */}
      <View style={[styles.logoArea, { paddingTop: insets.top + 24 }]}>
        <Text style={[styles.logoText, { color: colors.foreground }]}>
          Ascend<Text style={styles.logoAccent}>Fit</Text>
        </Text>
        <Text style={[styles.logoSub, { color: colors.mutedForeground }]}>Your Daily Coach</Text>
      </View>

      {/* Slide content */}
      <View style={styles.slideArea}>
        <Animated.View
          style={[
            styles.slide,
            { opacity: slideOpacity, transform: [{ translateX: slideX }] },
          ]}
        >
          {/* Icon orb — matches web amber gradient box */}
          <LinearGradient
            colors={["hsl(38, 95%, 20%)", "hsl(38, 95%, 12%)"]}
            start={{ x: 0.15, y: 0.15 }}
            end={{ x: 0.85, y: 0.85 }}
            style={styles.iconOrb}
          >
            <Text style={styles.iconEmoji}>{slide.icon}</Text>
          </LinearGradient>

          <View style={styles.textBlock}>
            <Text style={[styles.slideTitle, { color: colors.foreground }]}>
              {slide.title}
            </Text>
            <Text style={[styles.slideBody, { color: colors.mutedForeground }]}>
              {slide.text}
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Bottom controls */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        {/* Progress dots — clickable, matches web */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => i !== current && goTo(i, i > current ? "forward" : "back")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View
                style={[
                  styles.dot,
                  {
                    width: i === current ? 24 : 8,
                    backgroundColor: i === current ? AMBER : "hsl(217, 32%, 20%)",
                  },
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Next / Start My Plan button — amber gradient, matches web */}
        <TouchableOpacity onPress={handleNext} activeOpacity={0.88} style={styles.nextWrap}>
          <LinearGradient
            colors={[AMBER, AMBER_DARK]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.nextBtn}
          >
            <Text style={styles.nextBtnText}>
              {isLast ? "Start My Plan" : "Next"}
            </Text>
            <Text style={styles.nextArrow}>→</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Skip — only on non-last screens, matches web */}
        {!isLast ? (
          <TouchableOpacity onPress={finishIntro} hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip intro</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.skipPlaceholder} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Ambient orbs
  orb1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    top: "-15%",
    right: "-20%",
    backgroundColor: "rgba(245,158,11,0.07)",
    transform: [{ scale: 1.5 }],
  },
  orb2: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    bottom: "5%",
    left: "-15%",
    backgroundColor: "rgba(245,158,11,0.04)",
    transform: [{ scale: 1.5 }],
  },

  // Logo
  logoArea: { paddingHorizontal: 24, paddingBottom: 8, zIndex: 1 },
  logoText: { fontSize: 26, fontFamily: "SpaceMono_700Bold", letterSpacing: -0.5 },
  logoAccent: { color: "#C89A3E" },
  logoSub: { fontSize: 10, fontFamily: "SpaceMono_400Regular", letterSpacing: 1.2, marginTop: 2 },

  // Slide area
  slideArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 1,
  },
  slide: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    gap: 28,
  },

  // Icon orb — matches web w-24 h-24 rounded-3xl amber gradient
  iconOrb: {
    width: 96,
    height: 96,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
  },
  iconEmoji: { fontSize: 46 },

  textBlock: { alignItems: "center", gap: 12 },
  slideTitle: {
    fontSize: 26,
    fontFamily: "SpaceMono_700Bold",
    textAlign: "center",
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  slideBody: {
    fontSize: 15,
    fontFamily: "SpaceMono_400Regular",
    textAlign: "center",
    lineHeight: 23,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 16,
    zIndex: 1,
  },
  dots: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { height: 8, borderRadius: 4 },

  nextWrap: { alignSelf: "stretch" },
  nextBtn: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  nextBtnText: {
    fontSize: 16,
    fontFamily: "SpaceMono_700Bold",
    color: "#0A0A0A",
  },
  nextArrow: {
    fontSize: 18,
    color: "#0A0A0A",
    fontFamily: "SpaceMono_700Bold",
  },
  skipText: { fontSize: 14, fontFamily: "SpaceMono_400Regular" },
  skipPlaceholder: { height: 20 },
});

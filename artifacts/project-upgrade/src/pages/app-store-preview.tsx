import { useRef, useCallback, useEffect, useState } from "react";
import { toPng } from "html-to-image";
import {
  Flame,
  Beef,
  Droplets,
  Target,
  Footprints,
  CheckCircle2,
  Circle,
  Utensils,
  Dumbbell,
  ChevronRight,
  Clock,
  Camera,
  Zap,
  MessageSquare,
  Send,
  TrendingDown,
  BarChart2,
  Star,
  Flame as FlameIcon,
  Sparkles,
  Activity,
  Apple,
  GlassWater,
  Weight,
  TrendingUp,
  Trophy,
  Heart,
  Eye,
  Salad,
  Timer,
  ListChecks,
  ArrowRight,
  Shield,
  User,
} from "lucide-react";

/* ────────────────────────────────────────────
   App Store Preview Generator
   6 vertical panels — 1290x2796 iPhone ratio
   Premium marketing asset design
   ──────────────────────────────────────────── */

const PANEL_ASPECT = 1290 / 2796;
const PANEL_WIDTH = 430;
const PANEL_HEIGHT = Math.round(PANEL_WIDTH / PANEL_ASPECT);

const PHONE_W = 375;
const PHONE_H = 810;
const PHONE_RADIUS = 44;
const PHONE_BEZEL = 8;
const SCREEN_W = PHONE_W - PHONE_BEZEL * 2;
const SCREEN_H = PHONE_H - PHONE_BEZEL * 2;

const SCREEN_RADIUS = 32;
const NOTCH_W = 140;
const NOTCH_H = 28;

const BG_DARK = "#0A0D14";
const BG_DEEP = "#070910";
const ACCENT_BLUE = "#6B8BAE";
const ACCENT_BLUE_BRIGHT = "#8FAFD2";
const ACCENT_BLUE_GLOW = "rgba(107,139,174,0.22)";
const ACCENT_BLUE_GLOW_STRONG = "rgba(107,139,174,0.35)";
const ACCENT_GOLD = "#C89A3E";
const ACCENT_GREEN = "#4A9B78";
const TEXT_WHITE = "#F8FAFC";
const TEXT_MUTED = "rgba(248,250,252,0.50)";
const TEXT_DIM = "rgba(248,250,252,0.30)";
const CARD_BG = "rgba(255,255,255,0.03)";
const CARD_BG_STRONG = "rgba(255,255,255,0.05)";
const CARD_BORDER = "rgba(255,255,255,0.06)";
const CARD_BORDER_BRIGHT = "rgba(255,255,255,0.10)";

/* ── Phone Shell ── */
function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: PHONE_W,
        height: PHONE_H,
        borderRadius: PHONE_RADIUS,
        background: "#1A1E2A",
        boxShadow: "0 40px 100px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,255,255,0.05) inset",
        padding: PHONE_BEZEL,
        position: "relative",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: NOTCH_W,
          height: NOTCH_H,
          background: "#1A1E2A",
          borderRadius: "0 0 18px 18px",
          zIndex: 10,
        }}
      />
      <div
        style={{
          width: SCREEN_W,
          height: SCREEN_H,
          borderRadius: SCREEN_RADIUS,
          background: "#0C0F1A",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Floating Badge (used around phones) ── */
function FloatBadge({
  icon,
  label,
  value,
  color,
  top,
  left,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  top?: string;
  left?: string;
  right?: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        right,
        zIndex: 2,
        background: "rgba(12,15,26,0.92)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        padding: "8px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.30)",
      }}
    >
      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 800, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif", lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 8, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif", lineHeight: 1.2 }}>{label}</div>
      </div>
    </div>
  );
}

/* ── Panel Wrapper (clean export node) ── */
function PreviewPanel({
  id,
  headline,
  subtext,
  phone,
  floatBadges,
  refProp,
}: {
  id: string;
  headline: string;
  subtext: string;
  phone: React.ReactNode;
  floatBadges?: React.ReactNode;
  refProp: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={refProp}
      data-panel-id={id}
      style={{
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        background: `radial-gradient(ellipse 140% 90% at 50% 15%, ${ACCENT_BLUE_GLOW_STRONG} 0%, transparent 65%), linear-gradient(180deg, ${BG_DEEP} 0%, ${BG_DARK} 40%, #0B0E18 100%)`,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 22px 28px",
        boxSizing: "border-box",
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "160%",
          height: "50%",
          background: `radial-gradient(ellipse at center, ${ACCENT_BLUE_GLOW} 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      {/* Bottom subtle glow */}
      <div
        style={{
          position: "absolute",
          bottom: "-5%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          height: "30%",
          background: `radial-gradient(ellipse at center, ${ACCENT_BLUE_GLOW} 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Text */}
      <div style={{ textAlign: "center", zIndex: 1, flexShrink: 0, marginBottom: 6 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            color: TEXT_WHITE,
            fontFamily: "'Inter', system-ui, sans-serif",
            margin: 0,
          }}
        >
          {headline}
        </h1>
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.5,
            color: TEXT_MUTED,
            fontFamily: "'Inter', system-ui, sans-serif",
            marginTop: 10,
            maxWidth: 340,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {subtext}
        </p>
      </div>

      {/* Phone with floating badges */}
      <div style={{ zIndex: 1, position: "relative", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {floatBadges}
        <PhoneShell>{phone}</PhoneShell>
      </div>
    </div>
  );
}

/* ── Screen 1: HERO Dashboard ── */
function DashboardScreen() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#0C0F1A", display: "flex", flexDirection: "column", padding: "14px 16px", gap: 8, boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 10, background: "linear-gradient(135deg, #6B8BAE, #4A6B8A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FlameIcon size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Ascend</div>
            <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>Good morning, Alex</div>
          </div>
        </div>
        <div style={{ width: 30, height: 30, borderRadius: 15, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Target size={14} color={TEXT_MUTED} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
        {[
          { icon: Flame, value: "2,340", label: "Cal", color: ACCENT_GOLD },
          { icon: Beef, value: "156g", label: "Protein", color: ACCENT_GREEN },
          { icon: Droplets, value: "1.2L", label: "Water", color: ACCENT_BLUE },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: "12px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <s.icon size={16} color={s.color} />
            <div style={{ fontSize: 16, fontWeight: 800, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>{s.value}</div>
            <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Next Task */}
      <div style={{ background: "rgba(107,139,174,0.08)", border: "1px solid rgba(107,139,174,0.15)", borderRadius: 16, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(74,155,120,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Footprints size={18} color={ACCENT_GREEN} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Evening Walk</div>
          <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>7:00 PM · 20 min · 120 cal</div>
        </div>
        <ChevronRight size={16} color={TEXT_MUTED} />
      </div>

      {/* Weight card */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(200,154,62,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TrendingDown size={18} color={ACCENT_GOLD} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>182.4 lbs</div>
          <div style={{ fontSize: 9, color: ACCENT_GREEN, fontFamily: "'Inter', sans-serif" }}>-2.1 lbs this week</div>
        </div>
        <div style={{ width: 70, height: 32, display: "flex", alignItems: "flex-end", gap: 3 }}>
          {[12, 18, 14, 24, 22, 16, 12].map((h, i) => (
            <div key={i} style={{ width: 8, height: h, borderRadius: 3, background: i === 4 ? ACCENT_GOLD : "rgba(255,255,255,0.08)", minHeight: 4 }} />
          ))}
        </div>
      </div>

      {/* Daily Score */}
      <div style={{ marginTop: "auto", background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 20, border: "2.5px solid #4A9B78", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT_GREEN, fontFamily: "'Inter', sans-serif" }}>84</div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Daily Score</div>
          <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>Great work today, Alex</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 10, color: ACCENT_GREEN, fontWeight: 700, background: "rgba(74,155,120,0.10)", padding: "5px 10px", borderRadius: 10, fontFamily: "'Inter', sans-serif" }}>
          +4 vs yesterday
        </div>
      </div>
    </div>
  );
}

/* ── Screen 2: Daily Plan ── */
function ScheduleScreen() {
  const items = [
    { time: "7:00 AM", label: "Weigh In", done: true, type: "scale" as const, icon: Weight },
    { time: "8:00 AM", label: "Drink Water", done: true, type: "water" as const, icon: GlassWater },
    { time: "9:00 AM", label: "Morning Walk", done: true, type: "walk" as const, icon: Footprints },
    { time: "12:30 PM", label: "Lunch — Grilled chicken, brown rice", done: false, type: "meal" as const, icon: Utensils },
    { time: "5:00 PM", label: "Upper Body Workout", done: false, type: "workout" as const, icon: Dumbbell },
    { time: "7:00 PM", label: "Evening Walk", done: false, type: "walk" as const, icon: Footprints },
    { time: "9:30 PM", label: "Journal & Review", done: false, type: "journal" as const, icon: Sparkles },
  ];

  return (
    <div style={{ width: "100%", height: "100%", background: "#0C0F1A", display: "flex", flexDirection: "column", padding: "14px 16px", gap: 6, boxSizing: "border-box" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif", marginTop: 6 }}>Today's Plan</div>
      <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>
        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
      </div>

      {/* Timeline */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 12, background: item.done ? "rgba(74,155,120,0.06)" : CARD_BG, border: item.done ? "1px solid rgba(74,155,120,0.12)" : `1px solid ${CARD_BORDER}` }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, background: item.done ? "rgba(74,155,120,0.15)" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {item.done ? <CheckCircle2 size={12} color={ACCENT_GREEN} /> : <item.icon size={12} color={TEXT_MUTED} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: item.done ? 600 : 700, color: item.done ? TEXT_MUTED : TEXT_WHITE, textDecoration: item.done ? "line-through" : "none", fontFamily: "'Inter', sans-serif" }}>
                {item.label}
              </div>
              <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>{item.time}</div>
            </div>
            <div style={{ width: 20, height: 20, borderRadius: 10, border: "1.5px solid", borderColor: item.done ? ACCENT_GREEN : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {item.done ? <CheckCircle2 size={10} color={ACCENT_GREEN} /> : <Circle size={10} color="rgba(255,255,255,0.15)" />}
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: "auto", background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>3 / 7</div>
        <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ width: "43%", height: "100%", borderRadius: 3, background: "linear-gradient(90deg, #4A9B78, #6B8BAE)" }} />
        </div>
        <div style={{ fontSize: 10, color: ACCENT_GREEN, fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>43% done</div>
      </div>
    </div>
  );
}

/* ── Screen 3: Meal AI ── */
function MealsScreen() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#0C0F1A", display: "flex", flexDirection: "column", padding: "14px 16px", gap: 8, boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Log Your Meals</div>
        <div style={{ fontSize: 10, color: ACCENT_GREEN, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>42g protein today</div>
      </div>

      {/* Food photo card */}
      <div style={{ width: "100%", height: 100, borderRadius: 16, background: "linear-gradient(135deg, #1A2A1A, #2A3A2A)", border: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", gap: 12, padding: "0 14px", overflow: "hidden" }}>
        <div style={{ width: 64, height: 64, borderRadius: 14, background: "linear-gradient(135deg, #4A9B78, #2A5A4A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Salad size={28} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Breakfast</div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif", marginTop: 2 }}>Oatmeal, blueberries, protein shake</div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 9, color: ACCENT_GREEN, background: "rgba(74,155,120,0.12)", padding: "3px 8px", borderRadius: 6, fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>
              Good
            </span>
            <span style={{ fontSize: 9, color: TEXT_MUTED, background: "rgba(255,255,255,0.04)", padding: "3px 8px", borderRadius: 6, fontFamily: "'Inter', sans-serif" }}>
              42g protein
            </span>
          </div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 10, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>8:30 AM</div>
      </div>

      {/* Camera area */}
      <div style={{ width: "100%", height: 60, borderRadius: 16, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 12, background: "rgba(107,139,174,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Camera size={16} color={ACCENT_BLUE} />
        </div>
        <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>Tap camera to snap your next meal</div>
      </div>

      {/* Macro breakdown */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Macro Breakdown</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { label: "Protein", value: "42g", pct: "28%", color: ACCENT_GREEN },
            { label: "Carbs", value: "64g", pct: "42%", color: ACCENT_BLUE },
            { label: "Fats", value: "18g", pct: "30%", color: ACCENT_GOLD },
          ].map((m, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>{m.label}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: m.color, fontFamily: "'Inter', sans-serif" }}>{m.value}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ width: m.pct, height: "100%", borderRadius: 2, background: m.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Coach Feedback */}
      <div style={{ background: "rgba(107,139,174,0.06)", border: "1px solid rgba(107,139,174,0.12)", borderRadius: 16, padding: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ width: 26, height: 26, borderRadius: 10, background: "rgba(107,139,174,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Sparkles size={14} color={ACCENT_BLUE} />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT_BLUE, fontFamily: "'Inter', sans-serif" }}>Coach Feedback</div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif", lineHeight: 1.5, marginTop: 2 }}>
            Great macro balance. Try adding a whole egg for extra fats to stay full longer.
          </div>
        </div>
      </div>

      {/* Water tracker */}
      <div style={{ marginTop: "auto", background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(107,139,174,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Droplets size={18} color={ACCENT_BLUE} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Water</div>
          <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>1.2L / 2.5L</div>
        </div>
        <div style={{ width: 70, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ width: "48%", height: "100%", borderRadius: 3, background: ACCENT_BLUE }} />
        </div>
      </div>
    </div>
  );
}

/* ── Screen 4: Goals ── */
function GoalsScreen() {
  const goals = [
    { label: "Lose Fat", sub: "Calorie deficit, cardio, clean eating", active: true, color: ACCENT_GREEN, icon: TrendingDown },
    { label: "Build Muscle", sub: "Progressive overload, high protein", active: false, color: ACCENT_BLUE, icon: Dumbbell },
    { label: "Stay Lean", sub: "Maintenance, balanced macros", active: false, color: ACCENT_GOLD, icon: Flame },
  ];

  return (
    <div style={{ width: "100%", height: "100%", background: "#0C0F1A", display: "flex", flexDirection: "column", padding: "14px 16px", gap: 10, boxSizing: "border-box" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif", marginTop: 6 }}>Your Goal</div>
      <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif", marginBottom: 2 }}>
        This shapes your plan, meals, and workouts
      </div>

      {/* Goal cards */}
      {goals.map((g, i) => (
        <div key={i} style={{ background: g.active ? "rgba(74,155,120,0.06)" : CARD_BG, border: g.active ? "1.5px solid rgba(74,155,120,0.25)" : `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: g.active ? "rgba(74,155,120,0.12)" : "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <g.icon size={22} color={g.color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>{g.label}</div>
            <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif", marginTop: 2 }}>{g.sub}</div>
          </div>
          {g.active && (
            <div style={{ width: 24, height: 24, borderRadius: 12, background: ACCENT_GREEN, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={14} color="#fff" />
            </div>
          )}
        </div>
      ))}

      {/* Plan summary */}
      <div style={{ marginTop: "auto", background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Your Personalized Plan</div>
        {[
          { label: "Calories", value: "2,340 / day", icon: Flame, color: ACCENT_GOLD },
          { label: "Protein", value: "156g / day", icon: Beef, color: ACCENT_GREEN },
          { label: "Workouts", value: "5x / week", icon: Dumbbell, color: ACCENT_BLUE },
        ].map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: 8, background: `${r.color}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <r.icon size={12} color={r.color} />
              </div>
              <span style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>{r.label}</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Screen 5: Coach Chat ── */
function CoachScreen() {
  const messages = [
    { from: "coach", text: "Morning Alex. Your protein was 42g short yesterday. That'll tank your recovery. Today we fix it." },
    { from: "user", text: "Is losing 3 lbs a week safe?" },
    { from: "coach", text: "That's too aggressive for most people. At 3 lbs/week, you lose muscle and rebound. Let's keep your plan realistic so you lose fat without burning out." },
  ];

  return (
    <div style={{ width: "100%", height: "100%", background: "#0C0F1A", display: "flex", flexDirection: "column", padding: "14px 16px", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: "linear-gradient(135deg, #6B8BAE, #4A6B8A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MessageSquare size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Coach</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: ACCENT_GREEN, fontFamily: "'Inter', sans-serif" }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: ACCENT_GREEN }} />
            Online
          </div>
        </div>
        <div style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: 14, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Shield size={14} color={TEXT_MUTED} />
        </div>
      </div>

      {/* Messages */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, overflow: "hidden" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "82%",
              background: m.from === "user" ? "rgba(107,139,174,0.15)" : "rgba(255,255,255,0.05)",
              border: m.from === "user" ? "1px solid rgba(107,139,174,0.20)" : `1px solid ${CARD_BORDER}`,
              borderRadius: m.from === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              padding: "10px 12px",
            }}>
              <div style={{ fontSize: 11, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif", lineHeight: 1.5 }}>
                {m.text}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: "10px 12px" }}>
        <div style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif", flex: 1 }}>
          Ask your coach...
        </div>
        <div style={{ width: 28, height: 28, borderRadius: 10, background: "rgba(107,139,174,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Send size={14} color={ACCENT_BLUE} />
        </div>
      </div>
    </div>
  );
}

/* ── Screen 6: Progress ── */
function ProgressScreen() {
  const chartData = [
    { day: "Mon", w: 12 }, { day: "Tue", w: 18 }, { day: "Wed", w: 14 }, { day: "Thu", w: 22 },
    { day: "Fri", w: 20 }, { day: "Sat", w: 16 }, { day: "Sun", w: 12 },
  ];

  const linePoints = chartData.map((d, i) => {
    const x = (i / (chartData.length - 1)) * 100;
    const y = 100 - (d.w / 24) * 80;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div style={{ width: "100%", height: "100%", background: "#0C0F1A", display: "flex", flexDirection: "column", padding: "14px 16px", gap: 8, boxSizing: "border-box" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif", marginTop: 6 }}>Your Progress</div>

      {/* Weight line chart */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Weight Trend</div>
          <div style={{ fontSize: 10, color: ACCENT_GREEN, fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>-2.1 lbs</div>
        </div>
        {/* Bar chart */}
        <div style={{ height: 40, display: "flex", alignItems: "flex-end", gap: 6, padding: "0 4px" }}>
          {chartData.map((d, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ width: "100%", height: d.w, borderRadius: 3, background: i === 4 ? ACCENT_GOLD : "rgba(255,255,255,0.08)", minHeight: 4 }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          {chartData.map((d, i) => (
            <div key={i} style={{ fontSize: 7, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>{d.day}</div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 8 }}>
        {[
          { label: "Streak", value: "7 days", color: ACCENT_GOLD, icon: Trophy },
          { label: "Habit Score", value: "84", color: ACCENT_GREEN, icon: Activity },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <s.icon size={12} color={s.color} />
              <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>{s.label}</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: "'Inter', sans-serif" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Milestones */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Milestones</div>
        {[
          { text: "7-day streak", done: true },
          { text: "First weigh-in", done: true },
          { text: "10 workouts logged", done: false },
        ].map((m, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: 7, background: m.done ? "rgba(74,155,120,0.12)" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {m.done ? <CheckCircle2 size={12} color={ACCENT_GREEN} /> : <Circle size={12} color="rgba(255,255,255,0.15)" />}
            </div>
            <div style={{ fontSize: 10, color: m.done ? TEXT_WHITE : TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>{m.text}</div>
          </div>
        ))}
      </div>

      {/* Consistency card */}
      <div style={{ marginTop: "auto", background: "rgba(74,155,120,0.04)", border: "1px solid rgba(74,155,120,0.10)", borderRadius: 16, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(74,155,120,0.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BarChart2 size={18} color={ACCENT_GREEN} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT_GREEN, fontFamily: "'Inter', sans-serif" }}>Consistency is everything</div>
          <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>Logged meals 6 of 7 days this week</div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function AppStorePreviewPage() {
  const panelRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];

  useEffect(() => {
    document.documentElement.classList.add("no-scroll-lock");
    return () => {
      document.documentElement.classList.remove("no-scroll-lock");
    };
  }, []);

  const panels = [
    {
      id: "dashboard",
      headline: "Make Your Goal\nFeel Possible",
      subtext: "AI plans your meals, workouts, and habits around you.",
      phone: <DashboardScreen />,
      floatBadges: (
        <>
          <FloatBadge icon={<Beef size={14} color={ACCENT_GREEN} />} label="Protein" value="156g" color={ACCENT_GREEN} top="15%" left="-6%" />
          <FloatBadge icon={<Activity size={14} color={ACCENT_GREEN} />} label="Daily Score" value="84" color={ACCENT_GREEN} top="42%" right="-6%" />
          <FloatBadge icon={<TrendingDown size={14} color={ACCENT_GOLD} />} label="This week" value="-2.1 lbs" color={ACCENT_GOLD} top="72%" left="-6%" />
        </>
      ),
    },
    {
      id: "schedule",
      headline: "Know Exactly\nWhat To Do Today",
      subtext: "Meals, workouts, water, and habits — planned for you.",
      phone: <ScheduleScreen />,
    },
    {
      id: "meals",
      headline: "Snap Meals.\nGet Honest Feedback",
      subtext: "Log food, water, and macros with AI.",
      phone: <MealsScreen />,
    },
    {
      id: "goals",
      headline: "Built For Your\nStarting Point",
      subtext: "Lose fat, build muscle, or stay lean.",
      phone: <GoalsScreen />,
    },
    {
      id: "coach",
      headline: "Ask Your Coach\nAnything",
      subtext: "Guidance when motivation drops.",
      phone: <CoachScreen />,
    },
    {
      id: "progress",
      headline: "Track Progress.\nStay Consistent",
      subtext: "See weight, habits, streaks, and real results.",
      phone: <ProgressScreen />,
    },
  ];

  const [exporting, setExporting] = useState<number | null>(null);

  const exportPanel = useCallback(async (index: number) => {
    const ref = panelRefs[index];
    if (!ref.current) return;
    const node = ref.current;
    setExporting(index);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    try {
      const dataUrl = await toPng(node, {
        pixelRatio: 1,
        backgroundColor: BG_DARK,
      });

      if (!dataUrl) {
        alert("Export failed: empty result.");
        return;
      }

      const filename = `ascend-fit-preview-${index + 1}.png`;

      // Convert dataUrl to Blob for sharing
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      if (typeof navigator.share === "function" && navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: "image/png" })] })) {
        const file = new File([blob], filename, { type: "image/png" });
        await navigator.share({ files: [file], title: filename });
        return;
      }

      // Desktop: trigger download
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed: " + (err instanceof Error ? err.message : "Unknown error") + ". Try desktop.");
    } finally {
      setExporting(null);
    }
  }, []);

  const exportAll = useCallback(async () => {
    for (let i = 0; i < panels.length; i++) {
      await exportPanel(i);
      await new Promise((r) => setTimeout(r, 200));
    }
  }, [exportPanel]);

  return (
    <div style={{ background: "#05070A", padding: "40px 24px", minHeight: "100dvh", fontFamily: "'Inter', system-ui, sans-serif", WebkitTapHighlightColor: "transparent" }}>
      {/* Header */}
      <div style={{ maxWidth: 1200, margin: "0 auto 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: TEXT_WHITE, letterSpacing: "-0.02em", margin: 0 }}>
            Ascend Fit — App Store Preview
          </h1>
          <p style={{ fontSize: 14, color: TEXT_MUTED, margin: "6px 0 0" }}>
            6 vertical panels at 1290×2796 ratio. Export as PNG for App Store submission.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={exportAll}
            style={{
              background: "rgba(107,139,174,0.12)",
              border: "1px solid rgba(107,139,174,0.25)",
              color: ACCENT_BLUE,
              padding: "14px 24px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              minHeight: 44,
              touchAction: "manipulation",
            }}
          >
            Export All
          </button>
        </div>
      </div>

      {/* Panels grid */}
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 24, justifyContent: "center" }}>
        {panels.map((p, i) => (
          <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <PreviewPanel
              id={p.id}
              headline={p.headline}
              subtext={p.subtext}
              phone={p.phone}
              floatBadges={p.floatBadges}
              refProp={panelRefs[i]}
            />
            <button
              onClick={() => exportPanel(i)}
              disabled={exporting === i}
              style={{
                background: exporting === i ? "rgba(107,139,174,0.20)" : "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: exporting === i ? ACCENT_BLUE : TEXT_WHITE,
                padding: "14px 24px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: exporting === i ? "wait" : "pointer",
                fontFamily: "inherit",
                minHeight: 44,
                touchAction: "manipulation",
                opacity: exporting === i ? 0.8 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {exporting === i ? "Exporting..." : "Export PNG"}
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ maxWidth: 1200, margin: "40px auto 0", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "rgba(248,250,252,0.25)", fontFamily: "'Inter', sans-serif" }}>
          Each panel exports at 1290×2796 pixels (App Store required size).
        </p>
      </div>
    </div>
  );
}

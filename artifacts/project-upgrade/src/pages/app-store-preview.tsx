import { useRef, useCallback, useEffect } from "react";
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
} from "lucide-react";

/* ────────────────────────────────────────────
   App Store Preview Generator
   6 vertical panels — 1290x2796 iPhone ratio
   ──────────────────────────────────────────── */

const PANEL_ASPECT = 1290 / 2796;
const PANEL_WIDTH = 430; // scaled for browser
const PANEL_HEIGHT = Math.round(PANEL_WIDTH / PANEL_ASPECT); // 932

const PHONE_W = 366;
const PHONE_H = 829;
const PHONE_RADIUS = 42;
const PHONE_BEZEL = 8;
const SCREEN_W = PHONE_W - PHONE_BEZEL * 2;
const SCREEN_H = PHONE_H - PHONE_BEZEL * 2;
const CONTENT_SCALE = 1.25;
const CONTENT_W = 280;
const CONTENT_H = 650;

const SCREEN_RADIUS = 30;
const NOTCH_W = 140;
const NOTCH_H = 28;

const BG_DARK = "#0C0F1A";
const BG_GRADIENT_START = "#0C0F1A";
const BG_GRADIENT_END = "#151C2C";
const ACCENT_BLUE = "#6B8BAE";
const ACCENT_BLUE_SOFT = "#3A5A7E";
const ACCENT_BLUE_GLOW = "rgba(107,139,174,0.15)";
const TEXT_WHITE = "#F8FAFC";
const TEXT_MUTED = "rgba(248,250,252,0.55)";
const CARD_BG = "rgba(255,255,255,0.03)";
const CARD_BORDER = "rgba(255,255,255,0.06)";

/* ── Phone Shell ── */
function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: PHONE_W,
        height: PHONE_H,
        borderRadius: PHONE_RADIUS,
        background: "#1A1E2A",
        boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset",
        padding: PHONE_BEZEL,
        position: "relative",
        flexShrink: 0,
      }}
    >
      {/* Notch */}
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
      {/* Screen */}
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

/* ── Panel Wrapper ── */
function PreviewPanel({
  id,
  headline,
  subtext,
  phone,
  index,
  refProp,
}: {
  id: string;
  headline: string;
  subtext: string;
  phone: React.ReactNode;
  index: number;
  refProp: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={refProp}
      data-panel-id={id}
      style={{
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        background: `radial-gradient(ellipse 120% 80% at 50% 20%, ${ACCENT_BLUE_GLOW} 0%, transparent 70%), linear-gradient(180deg, ${BG_GRADIENT_START} 0%, ${BG_GRADIENT_END} 50%, #0B0E16 100%)`,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 28px 32px",
        boxSizing: "border-box",
      }}
    >
      {/* Subtle glow blob */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "140%",
          height: "40%",
          background: `radial-gradient(ellipse at center, ${ACCENT_BLUE_GLOW} 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* Index badge */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          width: 28,
          height: 28,
          borderRadius: 14,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          color: TEXT_WHITE,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {index}
      </div>

      {/* Text */}
      <div style={{ textAlign: "center", marginBottom: 28, zIndex: 1 }}>
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
            maxWidth: 320,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          {subtext}
        </p>
      </div>

      {/* Phone */}
      <div style={{ zIndex: 1, marginTop: "auto" }}>
        <PhoneShell>{phone}</PhoneShell>
      </div>

      {/* Bottom soft bar */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: "50%",
          transform: "translateX(-50%)",
          width: 120,
          height: 5,
          borderRadius: 3,
          background: "rgba(255,255,255,0.15)",
        }}
      />
    </div>
  );
}

/* ── Screen 1: Dashboard ── */
function DashboardScreen() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#0C0F1A", display: "flex", flexDirection: "column", padding: "12px 14px", gap: 8, boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #6B8BAE, #4A6B8A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FlameIcon size={14} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Ascend</div>
            <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>Good morning, Alex</div>
          </div>
        </div>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Target size={14} color={TEXT_MUTED} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {[
          { icon: Flame, value: "2,340", label: "Cal", color: "#C89A3E" },
          { icon: Beef, value: "156g", label: "Protein", color: "#4A9B78" },
          { icon: Droplets, value: "1.2L", label: "Water", color: "#6B8BAE" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: "10px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <s.icon size={16} color={s.color} />
            <div style={{ fontSize: 15, fontWeight: 800, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>{s.value}</div>
            <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Next Task */}
      <div style={{ background: "rgba(107,139,174,0.08)", border: "1px solid rgba(107,139,174,0.15)", borderRadius: 14, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(74,155,120,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Footprints size={16} color="#4A9B78" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Evening Walk</div>
          <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>7:00 PM · 20 min</div>
        </div>
        <ChevronRight size={16} color={TEXT_MUTED} />
      </div>

      {/* Weight mini */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 12, display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(200,154,62,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TrendingDown size={16} color="#C89A3E" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>182.4 lbs</div>
          <div style={{ fontSize: 9, color: "#4A9B78", fontFamily: "'Inter', sans-serif" }}>-2.1 lbs this week</div>
        </div>
        <div style={{ width: 60, height: 28, display: "flex", alignItems: "flex-end", gap: 2 }}>
          {[12, 18, 14, 22, 20, 16, 12].map((h, i) => (
            <div key={i} style={{ width: 6, height: h, borderRadius: 3, background: i === 4 ? "#C89A3E" : "rgba(255,255,255,0.1)", minHeight: 4 }} />
          ))}
        </div>
      </div>

      {/* Daily Score */}
      <div style={{ marginTop: "auto", background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, border: "2px solid #4A9B78", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#4A9B78", fontFamily: "'Inter', sans-serif" }}>84</div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Daily Score</div>
          <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>Great work today, Alex</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 9, color: "#4A9B78", fontWeight: 600, background: "rgba(74,155,120,0.1)", padding: "4px 8px", borderRadius: 8, fontFamily: "'Inter', sans-serif" }}>
          +4 vs yesterday
        </div>
      </div>
    </div>
  );
}

/* ── Screen 2: Schedule ── */
function ScheduleScreen() {
  const items = [
    { time: "7:00 AM", label: "Weigh In", done: true, type: "scale" as const },
    { time: "8:00 AM", label: "Drink Water", done: true, type: "water" as const },
    { time: "9:00 AM", label: "Morning Walk", done: true, type: "walk" as const },
    { time: "12:30 PM", label: "Lunch — Grilled chicken, brown rice", done: false, type: "meal" as const },
    { time: "5:00 PM", label: "Upper Body Workout", done: false, type: "workout" as const },
    { time: "7:00 PM", label: "Evening Walk", done: false, type: "walk" as const },
    { time: "9:30 PM", label: "Journal & Review", done: false, type: "journal" as const },
  ];

  const iconMap = {
    scale: <Star size={12} color="#C89A3E" />,
    water: <Droplets size={12} color="#6B8BAE" />,
    walk: <Footprints size={12} color="#4A9B78" />,
    meal: <Utensils size={12} color="#4A9B78" />,
    workout: <Dumbbell size={12} color="#6B8BAE" />,
    journal: <Sparkles size={12} color="#C89A3E" />,
  };

  return (
    <div style={{ width: "100%", height: "100%", background: "#0C0F1A", display: "flex", flexDirection: "column", padding: "12px 14px", gap: 6, boxSizing: "border-box" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif", marginTop: 6 }}>Today's Plan</div>
      <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>
        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
      </div>

      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 12, background: item.done ? "rgba(74,155,120,0.06)" : CARD_BG, border: item.done ? "1px solid rgba(74,155,120,0.12)" : `1px solid ${CARD_BORDER}` }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: item.done ? "rgba(74,155,120,0.15)" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {item.done ? <CheckCircle2 size={12} color="#4A9B78" /> : iconMap[item.type]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: item.done ? 600 : 700, color: item.done ? TEXT_MUTED : TEXT_WHITE, textDecoration: item.done ? "line-through" : "none", fontFamily: "'Inter', sans-serif" }}>
              {item.label}
            </div>
            <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>{item.time}</div>
          </div>
          <div style={{ width: 20, height: 20, borderRadius: 10, border: "1.5px solid", borderColor: item.done ? "#4A9B78" : "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {item.done ? <CheckCircle2 size={10} color="#4A9B78" /> : <Circle size={10} color="rgba(255,255,255,0.15)" />}
          </div>
        </div>
      ))}

      {/* Progress bar */}
      <div style={{ marginTop: "auto", background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>3 / 7</div>
        <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ width: "43%", height: "100%", borderRadius: 2, background: "linear-gradient(90deg, #4A9B78, #6B8BAE)" }} />
        </div>
        <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>43% done</div>
      </div>
    </div>
  );
}

/* ── Screen 3: Meals ── */
function MealsScreen() {
  return (
    <div style={{ width: "100%", height: "100%", background: "#0C0F1A", display: "flex", flexDirection: "column", padding: "12px 14px", gap: 8, boxSizing: "border-box" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif", marginTop: 6 }}>Log Your Meals</div>

      {/* Photo placeholder */}
      <div style={{ width: "100%", height: 120, borderRadius: 14, background: "linear-gradient(135deg, #1A1E2A, #242B3A)", border: `1px solid ${CARD_BORDER}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(107,139,174,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Camera size={18} color="#6B8BAE" />
        </div>
        <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>Tap to snap or upload</div>
      </div>

      {/* Logged meal */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 10, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(74,155,120,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Utensils size={16} color="#4A9B78" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Breakfast</div>
          <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif", marginTop: 2 }}>
            Oatmeal, blueberries, protein shake
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 9, color: "#4A9B78", background: "rgba(74,155,120,0.1)", padding: "2px 6px", borderRadius: 4, fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
              Good
            </span>
            <span style={{ fontSize: 9, color: TEXT_MUTED, background: "rgba(255,255,255,0.03)", padding: "2px 6px", borderRadius: 4, fontFamily: "'Inter', sans-serif" }}>
              42g protein
            </span>
          </div>
        </div>
        <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>8:30 AM</div>
      </div>

      {/* AI Feedback */}
      <div style={{ background: "rgba(107,139,174,0.06)", border: "1px solid rgba(107,139,174,0.12)", borderRadius: 14, padding: 10, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ width: 24, height: 24, borderRadius: 8, background: "rgba(107,139,174,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Sparkles size={12} color="#6B8BAE" />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT_BLUE, fontFamily: "'Inter', sans-serif" }}>Coach Feedback</div>
          <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif", lineHeight: 1.4, marginTop: 2 }}>
            Great macro balance. Next time try adding a whole egg for extra fats to stay full longer.
          </div>
        </div>
      </div>

      {/* Water */}
      <div style={{ marginTop: "auto", background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(107,139,174,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Droplets size={16} color="#6B8BAE" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Water</div>
          <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>1.2L / 2.5L</div>
        </div>
        <div style={{ width: 60, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ width: "48%", height: "100%", borderRadius: 2, background: "#6B8BAE" }} />
        </div>
      </div>
    </div>
  );
}

/* ── Screen 4: Goals ── */
function GoalsScreen() {
  const goals = [
    { label: "Lose Fat", sub: "Calorie deficit, cardio, clean eating", active: true, color: "#4A9B78" },
    { label: "Build Muscle", sub: "Progressive overload, high protein", active: false, color: "#6B8BAE" },
    { label: "Stay Lean", sub: "Maintenance, balanced macros", active: false, color: "#C89A3E" },
  ];

  return (
    <div style={{ width: "100%", height: "100%", background: "#0C0F1A", display: "flex", flexDirection: "column", padding: "12px 14px", gap: 10, boxSizing: "border-box" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif", marginTop: 6 }}>Your Goal</div>
      <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>
        This shapes your plan, meals, and workouts
      </div>

      {goals.map((g, i) => (
        <div key={i} style={{ background: g.active ? "rgba(74,155,120,0.06)" : CARD_BG, border: g.active ? "1.5px solid rgba(74,155,120,0.25)" : `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: g.active ? "rgba(74,155,120,0.12)" : "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Flame size={16} color={g.color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>{g.label}</div>
            <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif", marginTop: 2 }}>{g.sub}</div>
          </div>
          {g.active && (
            <div style={{ width: 20, height: 20, borderRadius: 10, background: "#4A9B78", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={12} color="#fff" />
            </div>
          )}
        </div>
      ))}

      {/* Plan summary */}
      <div style={{ marginTop: "auto", background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Your Plan</div>
        {[
          { label: "Calories", value: "2,340 / day" },
          { label: "Protein", value: "156g / day" },
          { label: "Workouts", value: "5x / week" },
        ].map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>{r.label}</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Screen 5: Coach Chat ── */
function CoachScreen() {
  const messages = [
    { from: "coach", text: "Morning Alex. Your protein was 42g short yesterday. That'll tank your recovery and energy. Today we fix it." },
    { from: "user", text: "Is losing 3 lbs a week safe?" },
    { from: "coach", text: "No — that's medically unsafe. At 3 lbs/week you lose muscle and rebound. Your target is 2,340 cal. That's where fat loss happens safely." },
  ];

  return (
    <div style={{ width: "100%", height: "100%", background: "#0C0F1A", display: "flex", flexDirection: "column", padding: "12px 14px", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 10, background: "linear-gradient(135deg, #6B8BAE, #4A6B8A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MessageSquare size={14} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Coach</div>
          <div style={{ fontSize: 9, color: "#4A9B78", fontFamily: "'Inter', sans-serif" }}>Online</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, overflow: "hidden" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "80%",
              background: m.from === "user" ? "rgba(107,139,174,0.12)" : "rgba(255,255,255,0.04)",
              border: m.from === "user" ? "1px solid rgba(107,139,174,0.15)" : `1px solid ${CARD_BORDER}`,
              borderRadius: m.from === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              padding: "8px 10px",
            }}>
              <div style={{ fontSize: 10, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif", lineHeight: 1.4 }}>
                {m.text}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: "8px 10px" }}>
        <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif", flex: 1 }}>
          Ask your coach...
        </div>
        <div style={{ width: 24, height: 24, borderRadius: 8, background: "rgba(107,139,174,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Send size={12} color="#6B8BAE" />
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

  return (
    <div style={{ width: "100%", height: "100%", background: "#0C0F1A", display: "flex", flexDirection: "column", padding: "12px 14px", gap: 8, boxSizing: "border-box" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif", marginTop: 6 }}>Your Progress</div>

      {/* Weight card */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Weight Trend</div>
          <div style={{ fontSize: 9, color: "#4A9B78", fontFamily: "'Inter', sans-serif" }}>-2.1 lbs</div>
        </div>
        {/* Fake chart */}
        <div style={{ height: 40, display: "flex", alignItems: "flex-end", gap: 6, padding: "0 4px" }}>
          {chartData.map((d, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ width: "100%", height: d.w, borderRadius: 3, background: i === 4 ? "#C89A3E" : "rgba(255,255,255,0.08)", minHeight: 4 }} />
              <div style={{ fontSize: 7, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>{d.day}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 6 }}>
        {[
          { label: "Streak", value: "7 days", color: "#C89A3E" },
          { label: "Habit Score", value: "84", color: "#4A9B78" },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>{s.label}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: s.color, fontFamily: "'Inter', sans-serif" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Milestones */}
      <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: TEXT_WHITE, fontFamily: "'Inter', sans-serif" }}>Milestones</div>
        {[
          { text: "7-day streak", done: true },
          { text: "First weigh-in", done: true },
          { text: "10 workouts logged", done: false },
        ].map((m, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 18, height: 18, borderRadius: 6, background: m.done ? "rgba(74,155,120,0.12)" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {m.done ? <CheckCircle2 size={10} color="#4A9B78" /> : <Circle size={10} color="rgba(255,255,255,0.15)" />}
            </div>
            <div style={{ fontSize: 10, color: m.done ? TEXT_WHITE : TEXT_MUTED, textDecoration: m.done ? "none" : "none", fontFamily: "'Inter', sans-serif" }}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* Consistency */}
      <div style={{ marginTop: "auto", background: "rgba(74,155,120,0.04)", border: "1px solid rgba(74,155,120,0.1)", borderRadius: 14, padding: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(74,155,120,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BarChart2 size={16} color="#4A9B78" />
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#4A9B78", fontFamily: "'Inter', sans-serif" }}>Consistency is everything</div>
          <div style={{ fontSize: 9, color: TEXT_MUTED, fontFamily: "'Inter', sans-serif" }}>You have logged meals 6 of 7 days this week</div>
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
      headline: "Make Your Dream Body\nFeel Possible",
      subtext: "AI plans your meals, workouts, and habits around your goal.",
      phone: <DashboardScreen />,
    },
    {
      id: "schedule",
      headline: "Know Exactly\nWhat To Do Today",
      subtext: "Your daily plan keeps you on track.",
      phone: <ScheduleScreen />,
    },
    {
      id: "meals",
      headline: "Snap Meals.\nGet Honest Feedback.",
      subtext: "AI checks food, water, and progress.",
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
      headline: "Science-Backed Coach\nIn Your Pocket",
      subtext: "Evidence-based guidance, real safety boundaries, zero fluff.",
      phone: <CoachScreen />,
    },
    {
      id: "progress",
      headline: "Track Progress\nThat Matters",
      subtext: "Weight, habits, streaks, and consistency.",
      phone: <ProgressScreen />,
    },
  ];

  const exportPanel = useCallback(async (index: number) => {
    const ref = panelRefs[index];
    if (!ref.current) return;
    const node = ref.current;
    try {
      const dataUrl = await toPng(node, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: BG_DARK,
      });
      const link = document.createElement("a");
      link.download = `ascend-fit-preview-${index + 1}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, []);

  const exportAll = useCallback(async () => {
    for (let i = 0; i < panels.length; i++) {
      await exportPanel(i);
      await new Promise((r) => setTimeout(r, 200));
    }
  }, [exportPanel]);

  return (
    <div style={{ background: "#05070A", padding: "40px 24px", minHeight: "100dvh", fontFamily: "'Inter', system-ui, sans-serif" }}>
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
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Export All
          </button>
        </div>
      </div>

      {/* Panels grid */}
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(430px, 1fr))", gap: 24, justifyContent: "center" }}>
        {panels.map((p, i) => (
          <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <PreviewPanel
              id={p.id}
              headline={p.headline}
              subtext={p.subtext}
              phone={p.phone}
              index={i + 1}
              refProp={panelRefs[i]}
            />
            <button
              onClick={() => exportPanel(i)}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: TEXT_WHITE,
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Export PNG
            </button>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div style={{ maxWidth: 1200, margin: "40px auto 0", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "rgba(248,250,252,0.25)", fontFamily: "'Inter', sans-serif" }}>
          Each panel renders at 3× pixel ratio for crisp App Store assets.
        </p>
      </div>
    </div>
  );
}

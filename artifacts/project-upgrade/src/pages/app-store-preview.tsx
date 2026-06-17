import { useRef, useCallback, useState } from "react";
import { toPng } from "html-to-image";
import JSZip from "jszip";

/* ─────────────────────────────────────────────────────────
   App Store Preview Generator
   6 × 1290×2796 vertical panels — export-ready PNGs
   ───────────────────────────────────────────────────────── */

const PANEL_W = 430;
const PANEL_H = Math.round(PANEL_W / (1290 / 2796)); // ≈ 931

/* Colors matching reference */
const BG = "#080D12";
const SURFACE = "#0F1520";
const CARD = "#141B27";
const BLUE = "#1E8BFF";
const BLUE_DIM = "rgba(30,139,255,0.12)";
const BLUE_BORDER = "rgba(30,139,255,0.30)";
const GREEN = "#22C55E";
const WHITE = "#FFFFFF";
const GRAY = "#A1A1AA";
const GRAY_DIM = "rgba(161,161,170,0.50)";

/* ── Status bar inside phone ── */
function StatusBar() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 18px 6px", flexShrink: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: WHITE, fontFamily: "inherit" }}>9:41</span>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
          <rect x="0" y="4" width="3" height="7" rx="1" fill={WHITE} opacity="0.4"/>
          <rect x="4.5" y="2.5" width="3" height="8.5" rx="1" fill={WHITE} opacity="0.6"/>
          <rect x="9" y="0.5" width="3" height="10.5" rx="1" fill={WHITE}/>
          <rect x="13.5" y="2" width="2" height="7" rx="0.5" fill="none" stroke={WHITE} strokeWidth="1"/>
          <rect x="14" y="3.5" width="1" height="4" rx="0.3" fill={WHITE}/>
        </svg>
        <svg width="10" height="11" viewBox="0 0 10 11" fill="none">
          <path d="M5 1.5C5 1.5 8.5 3 8.5 6C8.5 7.93 6.93 9.5 5 9.5C3.07 9.5 1.5 7.93 1.5 6C1.5 3 5 1.5 5 1.5Z" fill={WHITE}/>
          <path d="M5 0.5V2" stroke={WHITE} strokeWidth="1"/>
        </svg>
        <svg width="26" height="13" viewBox="0 0 26 13" fill="none">
          <rect x="0.5" y="0.5" width="22" height="12" rx="3.5" stroke={WHITE} strokeOpacity="0.35"/>
          <rect x="2" y="2" width="18" height="9" rx="2" fill={WHITE}/>
          <path d="M24 4.5V8.5C24.83 8.16 25.5 7.16 25.5 6.5C25.5 5.84 24.83 4.84 24 4.5Z" fill={WHITE} opacity="0.4"/>
        </svg>
      </div>
    </div>
  );
}

/* ── Dynamic island notch ── */
function DynamicIsland() {
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, flexShrink: 0 }}>
      <div style={{ width: 120, height: 34, background: "#000", borderRadius: 20 }} />
    </div>
  );
}

/* ── Phone frame ── */
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 300,
      height: 600,
      background: "#0A0C12",
      borderRadius: 46,
      border: "1.5px solid rgba(255,255,255,0.10)",
      boxShadow: "0 30px 80px rgba(0,0,0,0.80), 0 0 0 0.5px rgba(255,255,255,0.06) inset",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      fontFamily: "inherit",
    }}>
      <DynamicIsland />
      <StatusBar />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}

/* ── Number badge ── */
function Badge({ n }: { n: number }) {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 40,
      height: 40,
      borderRadius: 12,
      background: BLUE,
      color: WHITE,
      fontSize: 18,
      fontWeight: 800,
      fontFamily: "inherit",
      flexShrink: 0,
    }}>
      {n}
    </div>
  );
}

/* ── Bottom caption box ── */
function Caption({ line1, line2 }: { line1: string; line2: string }) {
  return (
    <div style={{
      background: BLUE_DIM,
      border: `1px solid ${BLUE_BORDER}`,
      borderRadius: 16,
      padding: "18px 22px",
      textAlign: "center",
      flexShrink: 0,
    }}>
      <div style={{ fontSize: 21, fontWeight: 800, color: WHITE, lineHeight: 1.25, fontFamily: "inherit" }}>{line1}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: WHITE, lineHeight: 1.25, marginTop: 3, fontFamily: "inherit" }}>{line2}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   APP SCREENS
   ══════════════════════════════════════════════════════════ */

function DashboardScreen() {
  return (
    <div style={{ flex: 1, background: BG, overflowY: "hidden", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Top greeting */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 10, color: GRAY, fontWeight: 500, fontFamily: "inherit" }}>Today</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: WHITE, fontFamily: "inherit", marginTop: 1 }}>Your plan for today.</div>
        </div>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: BLUE, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill={WHITE}/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={WHITE} strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {[
          { label: "CALORIES", value: "2,198", sub: "of 2,198", color: BLUE },
          { label: "PROTEIN", value: "165g", sub: "of 165g", color: GREEN },
          { label: "WATER", value: "2.5L", sub: "of 2.5L", color: "#60A5FA" },
        ].map((s) => (
          <div key={s.label} style={{ background: CARD, borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 7, color: GRAY, fontWeight: 600, letterSpacing: "0.05em", fontFamily: "inherit" }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: "inherit", marginTop: 2 }}>{s.value}</div>
            <div style={{ fontSize: 7, color: GRAY_DIM, fontFamily: "inherit" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Next up */}
      <div style={{ fontSize: 10, fontWeight: 700, color: WHITE, fontFamily: "inherit" }}>Next up</div>
      {[
        { icon: "💧", text: "Drink 16 oz water", sub: "Before coffee or food", time: "09:35" },
        { icon: "⚖️", text: "Wake up + weigh in", sub: "Weigh yourself and log it", time: "09:30" },
      ].map((item) => (
        <div key={item.text} style={{ background: CARD, borderRadius: 10, padding: "8px 10px", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: WHITE, fontFamily: "inherit" }}>{item.text}</div>
            <div style={{ fontSize: 8, color: GRAY, fontFamily: "inherit" }}>{item.sub}</div>
          </div>
          <div style={{ fontSize: 8, color: GRAY, fontFamily: "inherit", flexShrink: 0 }}>{item.time}</div>
        </div>
      ))}

      {/* Progress */}
      <div style={{ background: CARD, borderRadius: 10, padding: "10px 12px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: WHITE, fontFamily: "inherit", marginBottom: 6 }}>Progress</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: GREEN, fontFamily: "inherit" }}>-1.9 lbs</div>
        <div style={{ fontSize: 8, color: GRAY, fontFamily: "inherit", marginBottom: 6 }}>since starting · 165 → 163 → 165 goal</div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: "20%", height: "100%", background: GREEN, borderRadius: 4 }} />
        </div>
        <div style={{ fontSize: 7, color: GRAY_DIM, fontFamily: "inherit", marginTop: 3 }}>20% to goal</div>
      </div>
    </div>
  );
}

function ScheduleScreen() {
  const items = [
    { time: "09:30", icon: "⚖️", title: "Wake up + weigh in", sub: "Weigh yourself before eating.", done: true },
    { time: "09:35", icon: "💧", title: "Drink 16 oz water", sub: "Before coffee or food.", done: true },
    { time: "12:00", icon: "🍽️", title: "Lunch", sub: "Log your meal", done: false },
    { time: "17:00", icon: "🏋️", title: "Upper Body Workout", sub: "Push · Pull · 45 min", done: false },
    { time: "19:00", icon: "🥗", title: "Dinner", sub: "Log your meal", done: false },
    { time: "21:30", icon: "📓", title: "Journal & Review", sub: "Rate your day", done: false },
  ];
  return (
    <div style={{ flex: 1, background: BG, overflowY: "hidden", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: WHITE, fontFamily: "inherit" }}>Schedule</div>
        <div style={{ fontSize: 9, color: GRAY, fontFamily: "inherit" }}>Tuesday, June 16</div>
      </div>

      {/* Daily mission */}
      <div style={{ background: BLUE_DIM, border: `1px solid ${BLUE_BORDER}`, borderRadius: 10, padding: "8px 10px" }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: BLUE, fontFamily: "inherit", marginBottom: 4 }}>Daily mission ⚡</div>
        <div style={{ fontSize: 8, color: GRAY, fontFamily: "inherit", marginBottom: 6 }}>Hit your 2198 calorie target</div>
        <div style={{ display: "flex", gap: 10 }}>
          {[{ v: "2,198", l: "calories" }, { v: "165g", l: "protein" }, { v: "2.5L", l: "water" }].map(s => (
            <div key={s.l}>
              <div style={{ fontSize: 13, fontWeight: 800, color: WHITE, fontFamily: "inherit" }}>{s.v}</div>
              <div style={{ fontSize: 7, color: GRAY, fontFamily: "inherit" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
        {items.map((item) => (
          <div key={item.time} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 34, fontSize: 8, color: GRAY_DIM, fontFamily: "inherit", flexShrink: 0, textAlign: "right" }}>{item.time}</div>
            <div style={{ flex: 1, background: CARD, borderRadius: 8, padding: "6px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: WHITE, fontFamily: "inherit" }}>{item.icon} {item.title}</div>
                <div style={{ fontSize: 7, color: GRAY, fontFamily: "inherit" }}>{item.sub}</div>
              </div>
              {item.done ? (
                <div style={{ fontSize: 8, color: GREEN, fontWeight: 700, fontFamily: "inherit" }}>Done</div>
              ) : (
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: `1.5px solid ${GRAY_DIM}` }} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MealsScreen() {
  return (
    <div style={{ flex: 1, background: BG, overflowY: "hidden", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: WHITE, fontFamily: "inherit" }}>Meals</div>
        <div style={{ background: BLUE, borderRadius: 8, padding: "4px 10px" }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: WHITE, fontFamily: "inherit" }}>Log Meal</span>
        </div>
      </div>

      {/* Meal photo card */}
      <div style={{ background: CARD, borderRadius: 12, overflow: "hidden" }}>
        {/* Food image placeholder */}
        <div style={{ height: 120, background: "linear-gradient(135deg, #1A2A1A 0%, #0F1F0F 50%, #1A2A1A 100%)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Food illustration */}
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(139,101,50,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>🥗</div>
          <div style={{ position: "absolute", bottom: 8, left: 10, right: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: WHITE, fontFamily: "inherit" }}>Chicken, Rice, Avocado, Vegetables</div>
            <div style={{ fontSize: 8, color: GRAY, fontFamily: "inherit" }}>560 cal · 48g protein · 46g carbs · 18g fat</div>
          </div>
        </div>
        <div style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: BLUE, fontFamily: "inherit", marginBottom: 4 }}>AI Coach Feedback</div>
          <div style={{ fontSize: 8, color: GRAY, fontFamily: "inherit", lineHeight: 1.4 }}>Great choice! High protein meal with balanced macros. Try adding more veggies.</div>
          <div style={{ marginTop: 8, background: BLUE, borderRadius: 8, padding: "6px 0", textAlign: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: WHITE, fontFamily: "inherit" }}>Log This Meal</span>
          </div>
        </div>
      </div>

      {/* Macro breakdown */}
      <div style={{ background: CARD, borderRadius: 10, padding: "10px 12px" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: WHITE, fontFamily: "inherit", marginBottom: 8 }}>Today's Macros</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Protein", val: "142g", pct: 86, color: GREEN },
            { label: "Carbs", val: "198g", pct: 72, color: BLUE },
            { label: "Fat", val: "58g", pct: 90, color: "#F59E0B" },
          ].map(m => (
            <div key={m.label} style={{ flex: 1 }}>
              <div style={{ fontSize: 7, color: GRAY, fontFamily: "inherit" }}>{m.label}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: m.color, fontFamily: "inherit" }}>{m.val}</div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 3, overflow: "hidden" }}>
                <div style={{ width: `${m.pct}%`, height: "100%", background: m.color, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Water */}
      <div style={{ background: CARD, borderRadius: 10, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: WHITE, fontFamily: "inherit" }}>💧 Water</div>
          <div style={{ fontSize: 7, color: GRAY, fontFamily: "inherit" }}>1.0L / 2.5L</div>
        </div>
        <div style={{ width: 70, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: "40%", height: "100%", background: "#60A5FA", borderRadius: 2 }} />
        </div>
      </div>
    </div>
  );
}

function CoachScreen() {
  const msgs = [
    { from: "user", text: "What should I eat before my workout?" },
    { from: "coach", text: "For best performance, eat a meal with carbs and protein 1-2 hours before. Try: chicken & rice, oatmeal with banana, or Greek yogurt & berries." },
    { from: "user", text: "How much water should I drink?" },
    { from: "coach", text: "Aim for 2.5–3L per day. More if you're sweating a lot. You're doing great staying consistent! 💪" },
  ];

  return (
    <div style={{ flex: 1, background: BG, overflowY: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: WHITE, fontFamily: "inherit" }}>Coach</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN }} />
            <div style={{ fontSize: 8, color: GREEN, fontFamily: "inherit" }}>Online</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8, overflowY: "hidden" }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start" }}>
            {m.from === "coach" && (
              <div style={{ width: 22, height: 22, borderRadius: 8, background: BLUE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 6, alignSelf: "flex-end" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill={WHITE}/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={WHITE} strokeWidth="2.5" strokeLinecap="round"/></svg>
              </div>
            )}
            <div style={{
              maxWidth: "75%",
              padding: "7px 10px",
              borderRadius: m.from === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
              background: m.from === "user" ? BLUE : CARD,
              fontSize: 9,
              color: WHITE,
              lineHeight: 1.4,
              fontFamily: "inherit",
            }}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: "8px 12px 12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ background: CARD, borderRadius: 20, padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 9, color: GRAY_DIM, fontFamily: "inherit" }}>Ask anything...</span>
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: BLUE, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke={WHITE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressScreen() {
  const bars = [
    { day: "Mon", h: 24 }, { day: "Tue", h: 30 }, { day: "Wed", h: 18 },
    { day: "Thu", h: 34 }, { day: "Fri", h: 28 }, { day: "Sat", h: 22 }, { day: "Sun", h: 36 },
  ];
  return (
    <div style={{ flex: 1, background: BG, overflowY: "hidden", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: WHITE, fontFamily: "inherit" }}>Progress</div>

      {/* Weight card */}
      <div style={{ background: CARD, borderRadius: 12, padding: "12px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, color: GRAY, fontFamily: "inherit" }}>Weight · since starting</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: GREEN, fontFamily: "inherit", lineHeight: 1 }}>-1.9 lbs</div>
            <div style={{ fontSize: 8, color: GRAY, fontFamily: "inherit", marginTop: 2 }}>165 → 163 → 165 goal</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 8, color: GRAY, fontFamily: "inherit" }}>This week</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: GREEN, fontFamily: "inherit" }}>↓ 0.4 lbs</div>
          </div>
        </div>
        {/* Bar chart */}
        <div style={{ height: 44, display: "flex", alignItems: "flex-end", gap: 4 }}>
          {bars.map((b, i) => (
            <div key={b.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{ width: "100%", height: b.h, borderRadius: 4, background: i === 6 ? GREEN : "rgba(255,255,255,0.08)" }} />
              <div style={{ fontSize: 6, color: GRAY_DIM, fontFamily: "inherit" }}>{b.day}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div style={{ background: CARD, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 8, color: GRAY, fontFamily: "inherit" }}>🔥 Streak</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#F59E0B", fontFamily: "inherit" }}>7 days</div>
          <div style={{ fontSize: 7, color: GRAY_DIM, fontFamily: "inherit" }}>Personal best!</div>
        </div>
        <div style={{ background: CARD, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 8, color: GRAY, fontFamily: "inherit" }}>Daily Score</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: BLUE, fontFamily: "inherit" }}>84</div>
          <div style={{ fontSize: 7, color: GRAY_DIM, fontFamily: "inherit" }}>Keep the streak alive!</div>
        </div>
      </div>

      {/* Milestones */}
      <div style={{ background: CARD, borderRadius: 10, padding: "10px 12px" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: WHITE, fontFamily: "inherit", marginBottom: 6 }}>Milestones</div>
        {["7-day streak 🔥", "First weigh-in ✅", "10 workouts logged 💪"].map((m, i) => (
          <div key={m} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: i < 2 ? GREEN : GRAY_DIM, flexShrink: 0 }} />
            <div style={{ fontSize: 8, color: i < 2 ? WHITE : GRAY, fontFamily: "inherit" }}>{m}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalsScreen() {
  return (
    <div style={{ flex: 1, background: BG, overflowY: "hidden", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: WHITE, fontFamily: "inherit" }}>Your Goals</div>

      {/* Goal cards */}
      {[
        { icon: "🔥", name: "Lose Fat", sub: "Calorie deficit · clean eating", active: true, progress: 62 },
        { icon: "💪", name: "Build Muscle", sub: "Progressive overload · high protein", active: false, progress: 45 },
        { icon: "⚡", name: "More Energy", sub: "Sleep · hydration · consistency", active: false, progress: 71 },
      ].map((g) => (
        <div key={g.name} style={{ background: g.active ? `${BLUE_DIM}` : CARD, border: `1px solid ${g.active ? BLUE_BORDER : "rgba(255,255,255,0.05)"}`, borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 18 }}>{g.icon}</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: WHITE, fontFamily: "inherit" }}>{g.name}</div>
                <div style={{ fontSize: 8, color: GRAY, fontFamily: "inherit" }}>{g.sub}</div>
              </div>
            </div>
            {g.active && <div style={{ width: 18, height: 18, borderRadius: "50%", background: BLUE, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke={WHITE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>}
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${g.progress}%`, height: "100%", background: g.active ? BLUE : GRAY_DIM, borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: 7, color: GRAY_DIM, fontFamily: "inherit", marginTop: 3 }}>{g.progress}% on track</div>
        </div>
      ))}

      {/* Plan summary */}
      <div style={{ background: CARD, borderRadius: 10, padding: "10px 12px" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: WHITE, fontFamily: "inherit", marginBottom: 6 }}>Your Personalized Plan</div>
        {[
          { icon: "🔥", label: "Calories", val: "2,340 / day" },
          { icon: "🥩", label: "Protein", val: "156g / day" },
          { icon: "🏋️", label: "Workouts", val: "5x / week" },
        ].map(r => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontSize: 8, color: GRAY, fontFamily: "inherit" }}>{r.icon} {r.label}</div>
            <div style={{ fontSize: 8, fontWeight: 700, color: WHITE, fontFamily: "inherit" }}>{r.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function JournalScreen() {
  return (
    <div style={{ flex: 1, background: BG, overflowY: "hidden", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: WHITE, fontFamily: "inherit" }}>Daily Review</div>
        <div style={{ background: BLUE, borderRadius: 8, padding: "4px 10px" }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: WHITE, fontFamily: "inherit" }}>Save</span>
        </div>
      </div>

      {/* Score card */}
      <div style={{ background: "linear-gradient(135deg, rgba(30,139,255,0.15) 0%, rgba(30,139,255,0.05) 100%)", border: `1px solid ${BLUE_BORDER}`, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 14, alignItems: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", border: `3px solid ${BLUE}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: WHITE, fontFamily: "inherit", lineHeight: 1, textAlign: "center" }}>84</div>
            <div style={{ fontSize: 6, color: GRAY, fontFamily: "inherit", textAlign: "center" }}>/100</div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: WHITE, fontFamily: "inherit" }}>Great day, Alex! 🎉</div>
          <div style={{ fontSize: 8, color: GRAY, fontFamily: "inherit", marginTop: 2, lineHeight: 1.4 }}>Nutrition 90% · Workout done · 7hrs sleep</div>
        </div>
      </div>

      {/* Questions */}
      <div style={{ fontSize: 9, fontWeight: 700, color: WHITE, fontFamily: "inherit" }}>How did today feel?</div>
      <div style={{ display: "flex", gap: 6 }}>
        {["😴 Tired", "😐 Okay", "😊 Good", "🔥 Great"].map((e, i) => (
          <div key={e} style={{ flex: 1, background: i === 3 ? BLUE : CARD, border: `1px solid ${i === 3 ? BLUE : "rgba(255,255,255,0.05)"}`, borderRadius: 8, padding: "6px 4px", textAlign: "center" }}>
            <div style={{ fontSize: 8, color: WHITE, fontFamily: "inherit" }}>{e}</div>
          </div>
        ))}
      </div>

      {/* AI insight */}
      <div style={{ background: CARD, borderRadius: 10, padding: "10px 12px", flex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: BLUE, fontFamily: "inherit", marginBottom: 6 }}>AI Coach Insight</div>
        <div style={{ fontSize: 8, color: GRAY, fontFamily: "inherit", lineHeight: 1.5 }}>
          You crushed it today! Protein was on point at 156g. Tomorrow, aim to get your morning water in before coffee — that one habit alone can boost your energy by 20%.
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 8, color: WHITE, fontWeight: 700, fontFamily: "inherit" }}>Tomorrow's focus:</div>
          <div style={{ fontSize: 8, color: GREEN, fontFamily: "inherit", marginTop: 2 }}>✓ Morning hydration  ✓ Pre-workout meal  ✓ 8hrs sleep</div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PANEL COMPONENT — matches reference exactly
   ══════════════════════════════════════════════════════════ */

interface PanelDef {
  id: string;
  num: number;
  headlineWhite: string;
  headlineBlue: string;
  subtitle: string;
  caption1: string;
  caption2: string;
  screen: React.ReactNode;
}

function PreviewPanel({ panel, panelRef, hideBadge }: { panel: PanelDef; panelRef: React.RefObject<HTMLDivElement | null>; hideBadge: boolean }) {
  return (
    <div
      ref={panelRef}
      style={{
        width: PANEL_W,
        height: PANEL_H,
        background: BG,
        display: "flex",
        flexDirection: "column",
        padding: "28px 24px 22px",
        gap: 0,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
      }}
    >
      {/* Subtle radial glow behind content */}
      <div style={{
        position: "absolute",
        top: -60,
        left: "50%",
        transform: "translateX(-50%)",
        width: 400,
        height: 400,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(30,139,255,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* ① Number badge — hidden during export */}
      <div style={{ visibility: hideBadge ? "hidden" : "visible" }}>
        <Badge n={panel.num} />
      </div>

      {/* ② Headline */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 34, fontWeight: 900, color: WHITE, lineHeight: 1.15, letterSpacing: "-0.02em", fontFamily: "inherit" }}>
          {panel.headlineWhite}
        </div>
        <div style={{ fontSize: 34, fontWeight: 900, color: BLUE, lineHeight: 1.15, letterSpacing: "-0.02em", fontFamily: "inherit" }}>
          {panel.headlineBlue}
        </div>
      </div>

      {/* ③ Subtitle */}
      <div style={{ fontSize: 13, color: GRAY, marginTop: 8, lineHeight: 1.4, fontFamily: "inherit" }}>
        {panel.subtitle}
      </div>

      {/* ④ Phone mockup — centered */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 16 }}>
        <Phone>
          {panel.screen}
        </Phone>
      </div>

      {/* ⑤ Caption box */}
      <div style={{ marginTop: 16 }}>
        <Caption line1={panel.caption1} line2={panel.caption2} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════ */

export default function AppStorePreview() {
  const refs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];

  const [exporting, setExporting] = useState<number | null>(null);
  const [hideBadges, setHideBadges] = useState(false);

  const panels: PanelDef[] = [
    {
      id: "dashboard",
      num: 1,
      headlineWhite: "Your AI Fitness Coach.",
      headlineBlue: "Built Daily.",
      subtitle: "Personalized plans. Real results.",
      caption1: "Your entire plan.",
      caption2: "In one place.",
      screen: <DashboardScreen />,
    },
    {
      id: "schedule",
      num: 2,
      headlineWhite: "Know Exactly What To Do",
      headlineBlue: "Today.",
      subtitle: "Step-by-step plan that keeps you on track.",
      caption1: "Clear plan.",
      caption2: "No guesswork.",
      screen: <ScheduleScreen />,
    },
    {
      id: "meals",
      num: 3,
      headlineWhite: "Snap Meals. Get Honest",
      headlineBlue: "Feedback.",
      subtitle: "AI analyzes your meal in seconds.",
      caption1: "Eat smarter.",
      caption2: "Hit your goals.",
      screen: <MealsScreen />,
    },
    {
      id: "coach",
      num: 4,
      headlineWhite: "Ask Your Coach",
      headlineBlue: "Anything. 24/7.",
      subtitle: "Get real answers. Anytime.",
      caption1: "Your coach.",
      caption2: "Always with you.",
      screen: <CoachScreen />,
    },
    {
      id: "progress",
      num: 5,
      headlineWhite: "Track Progress. Stay Consistent.",
      headlineBlue: "Transform.",
      subtitle: "See results. Stay motivated. Keep winning.",
      caption1: "Small steps.",
      caption2: "Big transformation.",
      screen: <ProgressScreen />,
    },
    {
      id: "goals",
      num: 6,
      headlineWhite: "Set Goals. Build Habits",
      headlineBlue: "That Stick.",
      subtitle: "Your plan adapts as you grow.",
      caption1: "Your goals.",
      caption2: "Your results.",
      screen: <GoalsScreen />,
    },
  ];

  const exportOne = useCallback(async (index: number) => {
    const ref = refs[index];
    if (!ref.current) return;
    setExporting(index);
    setHideBadges(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const dataUrl = await toPng(ref.current, { pixelRatio: 3, backgroundColor: BG });
      setHideBadges(false);
      const filename = `ascend-fit-preview-${index + 1}.png`;
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [new File([blob], filename, { type: "image/png" })] })) {
        await navigator.share({ files: [new File([blob], filename, { type: "image/png" })], title: filename });
      } else {
        const link = document.createElement("a");
        link.download = filename;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      setHideBadges(false);
      alert("Export failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setExporting(null);
    }
  }, []);

  const exportAll = useCallback(async () => {
    setExporting(-1);
    setHideBadges(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const zip = new JSZip();
      const folder = zip.folder("ascend-fit-previews")!;
      for (let i = 0; i < panels.length; i++) {
        const ref = refs[i];
        if (!ref.current) continue;
        const dataUrl = await toPng(ref.current, { pixelRatio: 3, backgroundColor: BG });
        folder.file(`preview-${i + 1}.png`, dataUrl.split(",")[1], { base64: true });
      }
      setHideBadges(false);
      const blob = await zip.generateAsync({ type: "blob" });
      const filename = "ascend-fit-previews.zip";
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [new File([blob], filename, { type: "application/zip" })] })) {
        await navigator.share({ files: [new File([blob], filename, { type: "application/zip" })], title: "Ascend Fit App Store Previews" });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = filename;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    } catch (err) {
      setHideBadges(false);
      alert("Export All failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setExporting(null);
    }
  }, []);

  const isExportingAll = exporting === -1;

  return (
    <div style={{ background: "#040709", minHeight: "100dvh", padding: "32px 20px 48px", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ maxWidth: 1320, margin: "0 auto 36px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: WHITE, margin: 0 }}>Ascend Fit — App Store Preview</h1>
          <p style={{ fontSize: 13, color: GRAY, margin: "6px 0 0" }}>6 × 1290×2796 px · Export as PNG or ZIP for App Store submission</p>
        </div>
        <button
          onClick={exportAll}
          disabled={isExportingAll}
          style={{
            background: BLUE,
            color: WHITE,
            border: "none",
            padding: "12px 24px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 700,
            cursor: isExportingAll ? "wait" : "pointer",
            opacity: isExportingAll ? 0.7 : 1,
            minHeight: 44,
            touchAction: "manipulation",
          }}
        >
          {isExportingAll ? "Exporting all 6..." : "Export All (ZIP)"}
        </button>
      </div>

      {/* Panels grid */}
      <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "center" }}>
        {panels.map((panel, i) => (
          <div key={panel.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <PreviewPanel panel={panel} panelRef={refs[i]} hideBadge={hideBadges} />
            <button
              onClick={() => exportOne(i)}
              disabled={exporting !== null}
              style={{
                background: exporting === i ? BLUE_DIM : "rgba(255,255,255,0.04)",
                border: `1px solid ${exporting === i ? BLUE_BORDER : "rgba(255,255,255,0.08)"}`,
                color: exporting === i ? BLUE : WHITE,
                padding: "12px 24px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: exporting !== null ? "wait" : "pointer",
                minHeight: 44,
                touchAction: "manipulation",
                opacity: exporting !== null && exporting !== i ? 0.5 : 1,
                transition: "opacity 0.2s",
                fontFamily: "inherit",
              }}
            >
              {exporting === i ? "Exporting..." : `Export PNG ${i + 1}`}
            </button>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: 40 }}>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Each panel renders at 1290×2796 pixels (App Store required size)</p>
      </div>
    </div>
  );
}

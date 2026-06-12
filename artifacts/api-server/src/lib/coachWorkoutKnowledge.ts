/**
 * Ascend Elite Workout Knowledge Module
 * Structured exercise database used by the AI coach and heuristic fallback.
 * Provides specific workouts with sets, reps, rest, form cues, substitutions,
 * and safety warnings for every major body part and training goal.
 */

export interface Exercise {
  name: string;
  sets: string;
  reps: string;
  rest: string;
  form: string;
  homeSwap: string;
  safety?: string;
  beginnerNote?: string;
  advancedNote?: string;
}

export interface WorkoutGroup {
  name: string;
  exercises: Exercise[];
  notes: string;
}

export const WORKOUT_KNOWLEDGE: Record<string, Exercise[]> = {
  arms: [
    {
      name: "Barbell Curls",
      sets: "3",
      reps: "8-10",
      rest: "60 sec",
      form: "Elbows stay at sides. Full range — stretch at bottom, squeeze at top. Don't swing.",
      homeSwap: "Band curls (feet on band, palms up) — 3 sets of 12-15",
      safety: "Don't lean back. If your back arches, the weight is too heavy.",
    },
    {
      name: "Hammer Curls",
      sets: "3",
      reps: "10-12",
      rest: "60 sec",
      form: "Neutral grip. Elbows at sides. Full range. Squeeze the brachialis at top.",
      homeSwap: "Band hammer curls (same grip, feet on band) — 3 sets of 12-15",
    },
    {
      name: "Rope Pushdowns",
      sets: "3",
      reps: "10-12",
      rest: "60 sec",
      form: "Elbows pinned at sides. Push down, spread the rope at bottom. Full range. Control the return.",
      homeSwap: "Band pushdowns (anchor high, elbows at sides) — 3 sets of 12-15",
      safety: "Don't let elbows flare. Keep them locked at your sides.",
    },
    {
      name: "Overhead Extensions",
      sets: "3",
      reps: "10-12",
      rest: "60 sec",
      form: "Arms overhead, elbows fixed. Lower behind head, extend fully. Don't let elbows flare.",
      homeSwap: "Band overhead extensions (anchor behind, arms overhead) — 3 sets of 12-15",
      safety: "Keep core tight. Don't arch your back to get the weight up.",
    },
    {
      name: "Close-Grip Bench Press",
      sets: "3",
      reps: "6-8",
      rest: "2 min",
      form: "Hands shoulder-width, not touching. Lower to chest, press up. Elbows stay at sides.",
      homeSwap: "Close-grip pushups (diamond or normal) — 3 sets to near failure",
      safety: "Don't grip too narrow — shoulder-width is fine. Too narrow hurts wrists.",
    },
  ],
  chest: [
    {
      name: "Barbell Bench Press",
      sets: "4",
      reps: "6-8",
      rest: "2 min",
      form: "Control the lowering, keep shoulder blades pinned back, feet flat, slight arch. Don't bounce the bar off your chest.",
      homeSwap: "Pushups (weighted backpack or decline feet on sofa) — 4 sets to near failure",
      safety: "Always use a spotter or safety pins. Never sacrifice form for weight.",
      beginnerNote: "Start with the empty bar (45 lbs). Master the set-up before adding weight.",
      advancedNote: "Add paused reps (1 sec hold at chest) or increase range of motion.",
    },
    {
      name: "Incline Dumbbell Press",
      sets: "3",
      reps: "8-10",
      rest: "90 sec",
      form: "30-45 degree incline. Lower until you feel a stretch in the upper chest. Keep elbows at 45-60 degrees — not flared to 90.",
      homeSwap: "Incline pushups (feet on chair/sofa) — 3 sets to near failure",
      safety: "Don't let elbows drift past parallel. If shoulder hurts, lower the angle or reduce weight.",
    },
    {
      name: "Dumbbell Bench Press",
      sets: "3",
      reps: "8-10",
      rest: "90 sec",
      form: "Full range of motion — stretch at bottom, squeeze at top. Neutral grip is fine. Slower eccentric = more chest.",
      homeSwap: "Close-grip pushups (elbows tucked) — 3 sets to near failure",
    },
    {
      name: "Chest Dips",
      sets: "3",
      reps: "8-12",
      rest: "90 sec",
      form: "Lean forward to hit chest, not upright for triceps. Lower until upper arms are parallel. Don't go too deep.",
      homeSwap: "Bench dips (feet on floor, hands on chair) — 3 sets to near failure",
      safety: "Shoulder injury risk if going too deep. Stop at parallel.",
    },
    {
      name: "Cable Flys",
      sets: "3",
      reps: "12-15",
      rest: "60 sec",
      form: "Slight bend in elbows, squeeze chest at center. Don't swing. Control the return. Arc the cables, don't pull them.",
      homeSwap: "Band crossovers (doorway anchor) — 3 sets of 15-20",
      safety: "Keep elbows slightly bent throughout — never fully straight.",
    },
    {
      name: "Pec Deck",
      sets: "3",
      reps: "12-15",
      rest: "60 sec",
      form: "Squeeze the chest at peak contraction. Don't use momentum. Slow eccentrics build the stretch.",
      homeSwap: "Band chest press (wrap band around back) — 3 sets of 15-20",
    },
    {
      name: "Pushups",
      sets: "2-3",
      reps: "Near failure",
      rest: "60 sec",
      form: "Body straight like a plank. Chest to floor. Elbows at 45 degrees. Don't sag hips.",
      homeSwap: "Same — pushups are the home move.",
      beginnerNote: "Start with knees-down or incline pushups. Build volume before adding weight.",
    },
  ],
  back: [
    {
      name: "Pull-ups (Overhand)",
      sets: "3-4",
      reps: "5-10",
      rest: "2 min",
      form: "Full dead hang at bottom. Drive elbows down to hips. Chin clears the bar. No half reps.",
      homeSwap: "Doorway pull-ups or inverted rows (under table) — 3 sets to near failure",
      safety: "Don't kip. If you can't do one, use assisted or negatives.",
      beginnerNote: "Use resistance band assist or lat pulldown machine to build strength first.",
    },
    {
      name: "Lat Pulldown",
      sets: "3",
      reps: "8-10",
      rest: "90 sec",
      form: "Chest up, slight lean back. Pull to upper chest. Drive elbows down and back. Don't lean back too far.",
      homeSwap: "Band pulldown (door anchor) — 3 sets of 12-15",
    },
    {
      name: "Barbell Rows",
      sets: "3-4",
      reps: "6-8",
      rest: "90 sec",
      form: "Torso at 45 degrees, flat back, pull to lower ribs. Keep elbows tight. Don't let lower back round.",
      homeSwap: "Dumbbell rows (single arm, bench supported) — 3 sets of 10-12 each side",
      safety: "Brace your core. Rounding the lower back under load is the #1 injury risk.",
    },
    {
      name: "Dumbbell Rows",
      sets: "3",
      reps: "8-10 each",
      rest: "60 sec",
      form: "One knee on bench, flat back. Pull elbow back, squeeze the lat. Full stretch at bottom. Don't twist.",
      homeSwap: "Backpack rows (weighted bag, hinge at hips) — 3 sets of 10-12 each",
    },
    {
      name: "Seated Cable Rows",
      sets: "3",
      reps: "10-12",
      rest: "60 sec",
      form: "Sit upright, chest out. Pull handles to abdomen. Squeeze shoulder blades together. Don't lean back.",
      homeSwap: "Seated band rows (feet anchored, pull to waist) — 3 sets of 12-15",
    },
    {
      name: "Deadlifts",
      sets: "3",
      reps: "5",
      rest: "3 min",
      form: "Feet hip-width, bar over mid-foot. Hinge at hips, not squat. Flat back, chest up. Push floor away. Lock out at top.",
      homeSwap: "Dumbbell Romanian deadlifts (single or double) — 3 sets of 8-10",
      safety: "Never round your back. If you can't keep it neutral, lower the weight. Warm up with lighter sets.",
      beginnerNote: "Start with dumbbell RDLs to learn the hinge pattern. Move to barbell once form is locked.",
    },
    {
      name: "Back Extensions",
      sets: "3",
      reps: "12-15",
      rest: "60 sec",
      form: "Hinge at hips, don't round back. Squeeze glutes and lower back at top. Control on the way down.",
      homeSwap: "Superman holds on floor — 3 sets of 30 sec, or glute bridges — 3 sets of 15",
      safety: "Stop if you feel lower back pain. Sharp pain = stop immediately.",
    },
  ],
  shoulders: [
    {
      name: "Overhead Press (Barbell)",
      sets: "3-4",
      reps: "6-8",
      rest: "2 min",
      form: "Bar starts at upper chest. Press straight up, head through at top. Core braced. Don't arch your back.",
      homeSwap: "Dumbbell overhead press (seated or standing) — same sets/reps",
      safety: "If you feel shoulder impingement, switch to neutral-grip dumbbell press.",
      beginnerNote: "Start with dumbbells. Learn the overhead path before barbell.",
    },
    {
      name: "Dumbbell Shoulder Press",
      sets: "3",
      reps: "8-10",
      rest: "90 sec",
      form: "Palms facing forward or neutral. Press overhead until arms lock. Control on the way down. Full range.",
      homeSwap: "Water jug press (seated, standing) — 3 sets of 10-12",
      safety: "Don't lower below ear level if shoulders feel pinchy.",
    },
    {
      name: "Lateral Raises",
      sets: "3-4",
      reps: "12-15",
      rest: "60 sec",
      form: "Slight bend in elbows. Lift to shoulder height. Pinky side slightly up. Don't swing. No traps.",
      homeSwap: "Band lateral raises (feet on band) — 3 sets of 15-20",
      safety: "Don't go above shoulder level. If you feel neck pain, lower the weight.",
    },
    {
      name: "Rear Delt Flys",
      sets: "3",
      reps: "12-15",
      rest: "60 sec",
      form: "Bent over, chest supported. Fly arms out to sides. Squeeze rear delts. Don't use lower back.",
      homeSwap: "Band reverse flys (bend over, pull band apart) — 3 sets of 15-20",
      safety: "Keep chest supported. Don't round the back.",
    },
    {
      name: "Face Pulls",
      sets: "3",
      reps: "15-20",
      rest: "60 sec",
      form: "Pull to face height, external rotation at end. Squeeze rear delts. Control the return. Light weight.",
      homeSwap: "Band face pulls (door anchor, pull to face) — 3 sets of 15-20",
      safety: "This is a prehab/rehab exercise. Use light weight, focus on control, not load.",
    },
    {
      name: "Front Raises",
      sets: "2-3",
      reps: "10-12",
      rest: "60 sec",
      form: "Straight arm or slight bend. Raise to shoulder height. Don't swing. Alternate or both arms.",
      homeSwap: "Band front raises (feet on band) — 3 sets of 12-15",
      safety: "Light weight only. This is an accessory, not a main lift.",
    },
  ],
  biceps: [
    {
      name: "Barbell Curls",
      sets: "3",
      reps: "8-10",
      rest: "60 sec",
      form: "Elbows stay at sides. Full range — stretch at bottom, squeeze at top. Don't swing.",
      homeSwap: "Band curls (feet on band, palms up) — 3 sets of 12-15",
      safety: "Don't lean back. If your back arches, the weight is too heavy.",
    },
    {
      name: "Dumbbell Curls",
      sets: "3",
      reps: "8-10",
      rest: "60 sec",
      form: "Supinated grip. Rotate wrists outward as you curl. Full stretch at bottom. Control the eccentric.",
      homeSwap: "Water jug curls (seated or standing) — 3 sets of 10-12",
    },
    {
      name: "Hammer Curls",
      sets: "3",
      reps: "10-12",
      rest: "60 sec",
      form: "Neutral grip. Elbows at sides. Full range. Squeeze the brachialis at top.",
      homeSwap: "Band hammer curls (same grip, feet on band) — 3 sets of 12-15",
    },
    {
      name: "Preacher Curls",
      sets: "3",
      reps: "10-12",
      rest: "60 sec",
      form: "Chest supported on pad. Full stretch at bottom. Curl to peak contraction. No swinging.",
      homeSwap: "Band preacher curls (anchor low, arms over knees) — 3 sets of 12-15",
      safety: "Don't hyperextend elbows at the bottom. Control the stretch.",
    },
    {
      name: "Incline Curls",
      sets: "3",
      reps: "10-12",
      rest: "60 sec",
      form: "45 degree incline. Arms hang straight down. Full stretch, curl to peak. No swinging.",
      homeSwap: "Seated band curls (back against wall, feet on band) — 3 sets of 12-15",
      safety: "Don't let shoulders roll forward. Keep shoulder blades back.",
    },
    {
      name: "Cable Curls",
      sets: "3",
      reps: "12-15",
      rest: "60 sec",
      form: "Constant tension. Full range. Squeeze at peak. Control the return.",
      homeSwap: "Band curls (same as above) — 3 sets of 15-20",
    },
  ],
  triceps: [
    {
      name: "Rope Pushdowns",
      sets: "3",
      reps: "10-12",
      rest: "60 sec",
      form: "Elbows pinned at sides. Push down, spread the rope at bottom. Full range. Control the return.",
      homeSwap: "Band pushdowns (anchor high, elbows at sides) — 3 sets of 12-15",
      safety: "Don't let elbows flare. Keep them locked at your sides.",
    },
    {
      name: "Skull Crushers",
      sets: "3",
      reps: "8-10",
      rest: "60 sec",
      form: "Lie on bench, arms straight. Lower bar to forehead, elbows fixed. Don't let elbows drift.",
      homeSwap: "Overhead dumbbell extensions (seated, both arms) — 3 sets of 10-12",
      safety: "Use a spotter or lighter weight. If you can't control the bar, it will hit your face.",
      beginnerNote: "Start with light dumbbells. Learn the elbow position before barbell.",
    },
    {
      name: "Overhead Extensions",
      sets: "3",
      reps: "10-12",
      rest: "60 sec",
      form: "Arms overhead, elbows fixed. Lower behind head, extend fully. Don't let elbows flare.",
      homeSwap: "Band overhead extensions (anchor behind, arms overhead) — 3 sets of 12-15",
      safety: "Keep core tight. Don't arch your back to get the weight up.",
    },
    {
      name: "Close-Grip Bench Press",
      sets: "3",
      reps: "6-8",
      rest: "2 min",
      form: "Hands shoulder-width, not touching. Lower to chest, press up. Elbows stay at sides.",
      homeSwap: "Close-grip pushups (diamond or normal) — 3 sets to near failure",
      safety: "Don't grip too narrow — shoulder-width is fine. Too narrow hurts wrists.",
    },
    {
      name: "Dips",
      sets: "3",
      reps: "8-12",
      rest: "90 sec",
      form: "Upright, not leaning forward. Lower until upper arms parallel. Elbows stay at sides.",
      homeSwap: "Bench dips (feet on floor, hands on chair) — 3 sets to near failure",
      safety: "If you have shoulder issues, skip dips and use pushdowns instead.",
    },
  ],
  legs: [
    {
      name: "Squats",
      sets: "3-4",
      reps: "5-8",
      rest: "2-3 min",
      form: "Feet shoulder-width, toes slightly out. Brace core, break at hips and knees. Depth below parallel. Drive through heels.",
      homeSwap: "Goblet squats (dumbbell or backpack) — 3 sets of 8-10",
      safety: "Never squat with a rounded back. If you can't hit depth, lower weight. Knees track over toes.",
      beginnerNote: "Start with bodyweight squats and goblet squats. Master the pattern before barbell.",
      advancedNote: "Try pause squats (2 sec at bottom) or front squats for quad focus.",
    },
    {
      name: "Leg Press",
      sets: "3",
      reps: "8-10",
      rest: "2 min",
      form: "Feet mid-platform, shoulder-width. Lower until thighs touch chest. Don't let knees cave. Control the return.",
      homeSwap: "Wall sits (hold 30-60 sec) — 3 sets, or goblet squats — 3 sets of 10",
      safety: "Don't go too deep if your lower back rounds off the seat. Reduce range if needed.",
    },
    {
      name: "Lunges",
      sets: "3",
      reps: "10 each",
      rest: "90 sec",
      form: "Step forward, back knee touches floor. Drive through front heel. Torso upright. Switch legs.",
      homeSwap: "Walking lunges (bodyweight or backpack) — 3 sets of 10 each",
      safety: "Don't let front knee cave inward. If you feel knee pain, shorten your stride.",
    },
    {
      name: "Bulgarian Split Squats",
      sets: "3",
      reps: "8-10 each",
      rest: "90 sec",
      form: "Rear foot elevated on bench. Lower until back knee is near floor. Drive through front heel. Torso slightly forward.",
      homeSwap: "Reverse lunges (bodyweight) — 3 sets of 10 each",
      safety: "If you feel hip pain, lower the bench height. Don't let front knee cave.",
    },
    {
      name: "Romanian Deadlifts (RDLs)",
      sets: "3",
      reps: "8-10",
      rest: "90 sec",
      form: "Slight knee bend, hinge at hips. Bar stays close to shins. Feel hamstring stretch. Squeeze glutes at top. Don't round back.",
      homeSwap: "Single-leg RDLs (dumbbell or backpack) — 3 sets of 8-10 each",
      safety: "If you feel lower back rounding, lower the weight. The hamstring stretch is the signal.",
    },
    {
      name: "Hamstring Curls",
      sets: "3",
      reps: "10-12",
      rest: "60 sec",
      form: "Full stretch at bottom. Curl to peak. Squeeze hamstring. Control the return. Don't swing.",
      homeSwap: "Nordic hamstring curls (partner holds feet, or hook under furniture) — 3 sets of 5-8",
      safety: "Nordics are intense. Start with assisted versions. Eccentric-only is fine.",
    },
    {
      name: "Leg Extensions",
      sets: "3",
      reps: "12-15",
      rest: "60 sec",
      form: "Full range — squeeze at top, control on way down. Don't lock knees violently.",
      homeSwap: "Wall sits (hold 45 sec) — 3 sets, or sissy squats (supported) — 3 sets of 8-10",
      safety: "Don't slam the weight down. If you have knee issues, skip this or use very light weight.",
    },
    {
      name: "Calf Raises",
      sets: "4",
      reps: "12-15",
      rest: "45 sec",
      form: "Full stretch at bottom, peak contraction at top. Don't bounce. Control the eccentric.",
      homeSwap: "Single-leg calf raises on stairs (bodyweight) — 4 sets of 15-20 each",
      safety: "Don't bounce. The stretch is the growth stimulus.",
    },
  ],
  core: [
    {
      name: "Planks",
      sets: "3",
      reps: "45-60 sec",
      rest: "60 sec",
      form: "Body straight like a plank. Squeeze glutes, brace abs. Don't sag hips or pike them. Breathe.",
      homeSwap: "Same — planks are a home move.",
      safety: "If lower back hurts, check your hip position. Sagging = lower back strain.",
      beginnerNote: "Start with 20-30 sec. Build up. Quality over duration.",
      advancedNote: "Add weight on back or try RKC planks (max tension, 10-20 sec).",
    },
    {
      name: "Hanging Knee Raises",
      sets: "3",
      reps: "10-12",
      rest: "60 sec",
      form: "Hang from bar. Raise knees to chest. Don't swing. Control the lowering. Squeeze abs.",
      homeSwap: "Lying leg raises (floor, hands under hips) — 3 sets of 12-15",
      safety: "Don't swing. If you can't control the movement, use lying leg raises instead.",
    },
    {
      name: "Cable Crunches",
      sets: "3",
      reps: "12-15",
      rest: "60 sec",
      form: "Kneel, cable at head height. Crunch down, rounding the spine. Squeeze abs at bottom. Full stretch at top.",
      homeSwap: "Band crunches (anchor high, kneel and crunch) — 3 sets of 15-20",
      safety: "This is a crunch, not a pull. Round your spine, don't pull with arms.",
    },
    {
      name: "Dead Bugs",
      sets: "3",
      reps: "10 each",
      rest: "60 sec",
      form: "Back flat on floor. Extend opposite arm and leg. Don't let lower back arch. Core braced.",
      homeSwap: "Same — dead bugs are a home move.",
      safety: "If your back arches, you're going too far. Reduce range of motion.",
    },
    {
      name: "Russian Twists",
      sets: "3",
      reps: "15 each",
      rest: "60 sec",
      form: "Sit, feet off ground. Rotate torso, touch floor each side. Don't just swing arms — rotate the core.",
      homeSwap: "Same — bodyweight or hold a water jug. — 3 sets of 15 each",
      safety: "If lower back hurts, keep feet on the ground. Don't lean back too far.",
    },
    {
      name: "Ab Wheel Rollouts",
      sets: "3",
      reps: "8-10",
      rest: "60 sec",
      form: "Kneel, roll forward. Keep core tight. Don't let lower back sag. Small range is fine.",
      homeSwap: "Sliding towel rollouts (on floor, towel under hands) — 3 sets of 8-10",
      safety: "Don't go further than you can control. Sagging back = injury risk.",
      beginnerNote: "Start with very short range. Only go as far as you can keep your back flat.",
    },
  ],
  glutes: [
    {
      name: "Hip Thrusts",
      sets: "3-4",
      reps: "8-12",
      rest: "90 sec",
      form: "Shoulders on bench, feet planted. Thrust hips up, squeeze glutes at top. Full extension. Don't hyperextend.",
      homeSwap: "Single-leg glute bridges (elevated foot on chair) — 3 sets of 12-15 each",
      safety: "If you feel lower back, you're overextending. Squeeze glutes, not lower back.",
      beginnerNote: "Start with bodyweight glute bridges. Add weight (barbell, dumbbell) once form is solid.",
    },
    {
      name: "Glute Bridges",
      sets: "3",
      reps: "12-15",
      rest: "60 sec",
      form: "Lie on back, feet planted. Drive hips up, squeeze glutes at top. Full range. Control on the way down.",
      homeSwap: "Same — glute bridges are a home move.",
      safety: "Don't arch the lower back. The squeeze should come from the glutes, not the spine.",
    },
    {
      name: "RDLs (for glutes)",
      sets: "3",
      reps: "10-12",
      rest: "90 sec",
      form: "Same as hamstring RDLs but focus on glute squeeze at top. Slight knee bend. Feel hamstring stretch.",
      homeSwap: "Single-leg RDLs (dumbbell or backpack) — 3 sets of 8-10 each",
    },
    {
      name: "Cable Kickbacks",
      sets: "3",
      reps: "12-15 each",
      rest: "60 sec",
      form: "Ankle strap, kick back and up. Squeeze glute at top. Control the return. No swinging.",
      homeSwap: "Band kickbacks (anchor low, kick back and up) — 3 sets of 15-20 each",
      safety: "Light weight. This is an accessory, not a main lift.",
    },
    {
      name: "Step-Ups",
      sets: "3",
      reps: "10 each",
      rest: "90 sec",
      form: "Drive through heel on the step. Full extension at top. Control the step down. Don't push off the back foot.",
      homeSwap: "Chair step-ups (weighted backpack) — 3 sets of 10 each",
      safety: "Don't let the knee cave inward. If it does, lower the step or the weight.",
    },
  ],
  forearms: [
    {
      name: "Wrist Curls",
      sets: "3",
      reps: "15-20",
      rest: "45 sec",
      form: "Forearms on bench, palms up. Full range — stretch at bottom, curl at top. Control the eccentric.",
      homeSwap: "Band wrist curls (band around foot, curl up) — 3 sets of 15-20",
      safety: "Light weight. Forearms recover fast but don't overdo it.",
    },
    {
      name: "Reverse Wrist Curls",
      sets: "3",
      reps: "12-15",
      rest: "45 sec",
      form: "Palms down. Same position. Extend wrists. Squeeze extensors at top. Control the return.",
      homeSwap: "Band reverse curls (band around foot, palms down) — 3 sets of 12-15",
      safety: "Even lighter than regular wrist curls. Extensors are weaker.",
    },
    {
      name: "Farmer Carries",
      sets: "3",
      reps: "30-40 sec",
      rest: "60 sec",
      form: "Heavy dumbbells, walk. Stand tall, shoulders back. Grip hard. Don't let shoulders shrug.",
      homeSwap: "Suitcase carries (single heavy dumbbell or backpack) — 3 sets of 30 sec each side",
      safety: "Start lighter than you think. Grip strength is the limiter.",
    },
    {
      name: "Dead Hangs",
      sets: "3",
      reps: "Max time",
      rest: "60 sec",
      form: "Hang from bar, full dead hang. Grip tight. Don't swing. Relax shoulders. Breathe.",
      homeSwap: "Towel hangs (drape towel over door, hang) — 3 sets of max time",
      safety: "Don't drop suddenly. If grip fails, let go safely. Use chalk if slippery.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Workout builders (full routines for specific body parts)
// ---------------------------------------------------------------------------

export function buildBodyPartWorkout(
  bodyPart: string,
  level: "beginner" | "intermediate" | "advanced" = "intermediate",
  location: "gym" | "home" = "gym",
  injury?: string
): string {
  const part = bodyPart.toLowerCase().trim();
  const exercises = WORKOUT_KNOWLEDGE[part];
  if (!exercises) {
    return "";
  }

  // Filter out exercises that conflict with the injury
  let safeExercises = exercises;
  if (injury) {
    const injuryLower = injury.toLowerCase();
    safeExercises = exercises.filter((ex) => {
      if (ex.safety && injuryLower.includes("shoulder") && ex.safety.toLowerCase().includes("shoulder")) {
        return false;
      }
      if (ex.safety && injuryLower.includes("back") && ex.safety.toLowerCase().includes("back")) {
        return false;
      }
      if (ex.safety && injuryLower.includes("knee") && (ex.safety.toLowerCase().includes("knee") || ex.name.toLowerCase().includes("squat") || ex.name.toLowerCase().includes("lunge"))) {
        return false;
      }
      if (ex.safety && injuryLower.includes("wrist") && (ex.safety.toLowerCase().includes("wrist") || ex.name.toLowerCase().includes("curl") || ex.name.toLowerCase().includes("bench"))) {
        return false;
      }
      return true;
    });
  }

  if (safeExercises.length === 0) {
    return `Given your ${injury} concern, focus on the exercises that don't aggravate it. Start with the lightest variation, focus on perfect form, and stop if anything hurts. Ask your coach for specific modifications.`;
  }

  // Pick 4-5 exercises based on level
  const count = level === "beginner" ? 4 : level === "advanced" ? 5 : 4;
  const selected = safeExercises.slice(0, count);

  const lines: string[] = [];
  lines.push(`${capitalize(part)} Workout — ${capitalize(location)} (${capitalize(level)})`);
  lines.push("");

  selected.forEach((ex, i) => {
    const use = location === "home" && ex.homeSwap ? ex.homeSwap : ex.name;
    const sets = level === "beginner" && ex.beginnerNote
      ? adjustSets(ex.sets, -1)
      : level === "advanced" && ex.advancedNote
        ? ex.sets
        : ex.sets;
    const reps = ex.reps;
    const rest = ex.rest;
    lines.push(`${i + 1}. ${use} — ${sets}x${reps}, rest ${rest}`);
  });

  lines.push("");
  lines.push("Form cues: " + selected.map((e) => e.form.split(".")[0]).join("; ") + ".");
  lines.push("Progression: when you hit the top reps on all sets, increase weight or add a set next session.");

  if (level === "beginner") {
    lines.push("Beginner tip: start light, master form, and add weight only when you can control every rep.");
  }
  if (level === "advanced") {
    lines.push("Advanced tip: add a dropset on the last exercise or include a rest-pause set for intensity.");
  }

  const anySafety = selected.find((e) => e.safety);
  if (anySafety) {
    lines.push("Safety: " + anySafety.safety);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Goal-specific workout templates
// ---------------------------------------------------------------------------

export function buildGoalWorkout(
  goal: "muscle_gain" | "fat_loss" | "strength" | "maintain",
  level: "beginner" | "intermediate" | "advanced" = "intermediate",
  location: "gym" | "home" = "gym",
  daysPerWeek: number = 3,
  injury?: string
): string {
  const splits: Record<string, Record<number, string[]>> = {
    muscle_gain: {
      3: ["chest+triceps", "back+biceps", "legs+shoulders"],
      4: ["chest+triceps", "back+biceps", "legs", "shoulders+arms"],
      5: ["chest", "back", "legs", "shoulders", "arms"],
      6: ["chest", "back", "legs", "shoulders", "arms", "legs"],
    },
    fat_loss: {
      3: ["full body", "full body", "full body"],
      4: ["upper", "lower", "upper", "lower"],
      5: ["upper", "lower", "upper", "lower", "core+cardio"],
    },
    strength: {
      3: ["squat+bench", "deadlift+press", "squat+rows"],
      4: ["squat", "bench", "deadlift", "press"],
      5: ["squat", "bench", "deadlift", "press", "rows"],
    },
    maintain: {
      3: ["full body", "full body", "full body"],
      4: ["upper", "lower", "upper", "lower"],
    },
  };

  const split = splits[goal]?.[daysPerWeek] || splits[goal]?.[3] || ["full body"];

  const lines: string[] = [];
  lines.push(`${capitalize(goal.replace("_", " "))} Program — ${daysPerWeek}x/week (${capitalize(location)})`);
  lines.push("");

  split.forEach((day, i) => {
    lines.push(`Day ${i + 1}: ${day}`);
    const parts = day.split("+");
    parts.forEach((part) => {
      const ex = WORKOUT_KNOWLEDGE[part];
      if (ex) {
        const count = level === "beginner" ? 2 : level === "advanced" ? 3 : 2;
        const selected = ex.slice(0, count);
        selected.forEach((e) => {
          const use = location === "home" && e.homeSwap ? e.homeSwap : e.name;
          lines.push(`  • ${use} — ${e.sets}x${e.reps}`);
        });
      }
    });
    lines.push("");
  });

  lines.push("Rules: progressive overload every session. Add weight or reps. Track everything.");
  lines.push("Rest: 48h between training the same muscle.");
  if (goal === "fat_loss") {
    lines.push("Finish every session with 10-15 min brisk walking or incline treadmill.");
  }
  if (goal === "muscle_gain") {
    lines.push("Eat within 2 hours after training. Protein + carbs.");
  }
  if (goal === "strength") {
    lines.push("Rest 3-5 min between heavy sets. Quality over volume.");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Heuristic workout reply detection
// ---------------------------------------------------------------------------

export function detectWorkoutRequest(message: string): {
  bodyPart: string | null;
  level: "beginner" | "intermediate" | "advanced";
  location: "gym" | "home";
  goal: "muscle_gain" | "fat_loss" | "strength" | "maintain" | null;
  injury: string | null;
} {
  const m = message.toLowerCase();

  const bodyPartMap: Record<string, string[]> = {
    chest: ["chest"],
    back: ["back"],
    shoulders: ["shoulders", "shoulder"],
    biceps: ["biceps"],
    triceps: ["triceps"],
    legs: ["legs", "leg"],
    core: ["core", "abs", "ab"],
    glutes: ["glutes", "glute"],
    forearms: ["forearms", "forearm"],
    arms: ["arms", "arm"],
  };
  let bodyPart: string | null = null;
  for (const [key, aliases] of Object.entries(bodyPartMap)) {
    if (aliases.some((a) => m.includes(a))) {
      bodyPart = key;
      break;
    }
  }

  const level = m.includes("beginner") || m.includes("new") || m.includes("start")
    ? "beginner"
    : m.includes("advanced") || m.includes("elite") || m.includes("experienced")
      ? "advanced"
      : "intermediate";

  const location = m.includes("home") || m.includes("no gym") || m.includes("bodyweight") || m.includes("band")
    ? "home"
    : "gym";

  const goal = m.includes("muscle") || m.includes("bulk") || m.includes("hypertrophy") || m.includes("grow")
    ? "muscle_gain"
    : m.includes("fat") || m.includes("lose") || m.includes("cut") || m.includes("lean")
      ? "fat_loss"
      : m.includes("strength") || m.includes("power")
        ? "strength"
        : m.includes("maintain")
          ? "maintain"
          : null;

  const injuries = ["shoulder", "back", "knee", "wrist", "hip", "elbow"];
  const injury = injuries.find((i) => m.includes(i) && (m.includes("injur") || m.includes("pain") || m.includes("hurt") || m.includes("sore") || m.includes("bad"))) || null;

  return { bodyPart, level, location, goal, injury };
}

// ---------------------------------------------------------------------------
// Helper: generate workout knowledge text for the system prompt
// ---------------------------------------------------------------------------

export function getWorkoutKnowledgeText(): string {
  const lines: string[] = [];
  lines.push("WORKOUT KNOWLEDGE (use this when the user asks about exercises, workouts, or training):");
  lines.push("");

  Object.entries(WORKOUT_KNOWLEDGE).forEach(([part, exercises]) => {
    lines.push(`${capitalize(part)} exercises:`);
    exercises.forEach((ex) => {
      lines.push(`  • ${ex.name} — ${ex.sets}x${ex.reps}, rest ${ex.rest}`);
      if (ex.safety) lines.push(`    Safety: ${ex.safety}`);
      if (ex.beginnerNote) lines.push(`    Beginner: ${ex.beginnerNote}`);
      if (ex.homeSwap) lines.push(`    Home: ${ex.homeSwap}`);
    });
    lines.push("");
  });

  lines.push("RULES FOR WORKOUT RESPONSES:");
  lines.push("- If user asks for a body part workout, give 4-5 exercises with sets, reps, rest, and form cues.");
  lines.push("- If beginner, reduce sets by 1 and start with bodyweight or light weight.");
  lines.push("- If home, swap every exercise for the home alternative.");
  lines.push("- If user mentions an injury, avoid exercises that aggravate it. Suggest safer alternatives.");
  lines.push("- Always include progression advice: when they hit top reps, add weight or a set.");
  lines.push("- Keep responses short but detailed. Lists are fine. No fluff.");

  return lines.join("\n");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function adjustSets(sets: string, delta: number): string {
  const num = parseInt(sets, 10);
  if (isNaN(num)) return sets;
  return String(Math.max(1, num + delta));
}

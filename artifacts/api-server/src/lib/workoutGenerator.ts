import type { UserProfile, Plan } from "@workspace/db";

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  coachTip: string;
}

export interface PlannedWorkout {
  day: string;
  name: string;
  type: string;
  exercises: Exercise[];
}

const fatLossWorkouts: PlannedWorkout[] = [
  {
    day: "Monday",
    name: "Full Body Strength A",
    type: "strength",
    exercises: [
      { name: "Goblet Squat", sets: 3, reps: "12", restSeconds: 60, coachTip: "Drive through your heels. Keep chest up. No rounding." },
      { name: "Push-Up", sets: 3, reps: "10-15", restSeconds: 60, coachTip: "Chest to floor. No half reps. Full range." },
      { name: "Dumbbell Row", sets: 3, reps: "12 each", restSeconds: 60, coachTip: "Pull to hip. Don't swing. Control the lowering." },
      { name: "Reverse Lunge", sets: 3, reps: "10 each leg", restSeconds: 60, coachTip: "Back knee hovers 1 inch off floor." },
      { name: "Plank", sets: 3, reps: "30-45 sec", restSeconds: 45, coachTip: "Squeeze everything. No hips up." },
    ],
  },
  {
    day: "Wednesday",
    name: "Cardio + Core",
    type: "cardio",
    exercises: [
      { name: "Jump Rope / Jogging", sets: 1, reps: "20 min", restSeconds: 0, coachTip: "Steady pace. Not a sprint. Keep heart rate elevated." },
      { name: "Mountain Climbers", sets: 3, reps: "20 each leg", restSeconds: 45, coachTip: "Hips down. Drive knees fast. Keep tight." },
      { name: "Bicycle Crunch", sets: 3, reps: "15 each side", restSeconds: 45, coachTip: "Slow and controlled. Feel the obliques." },
      { name: "Dead Bug", sets: 3, reps: "10 each side", restSeconds: 45, coachTip: "Lower back stays glued to floor the entire time." },
    ],
  },
  {
    day: "Friday",
    name: "Full Body Strength B",
    type: "strength",
    exercises: [
      { name: "Romanian Deadlift", sets: 3, reps: "10", restSeconds: 90, coachTip: "Hinge at hips. Slight knee bend. Feel the hamstrings load." },
      { name: "Dumbbell Press", sets: 3, reps: "10", restSeconds: 60, coachTip: "Full range. Don't bounce off chest." },
      { name: "Lat Pulldown / Pull-Up", sets: 3, reps: "8-12", restSeconds: 60, coachTip: "Elbows down and back. Chest up." },
      { name: "Step-Up", sets: 3, reps: "12 each leg", restSeconds: 60, coachTip: "Drive through the heel on top. Don't push off the floor." },
      { name: "Farmer Carry", sets: 3, reps: "40 steps", restSeconds: 60, coachTip: "Shoulders back. Walk tall. Grip hard." },
    ],
  },
];

const muscleGainWorkouts: PlannedWorkout[] = [
  {
    day: "Monday",
    name: "Push Day — Chest, Shoulders, Triceps",
    type: "strength",
    exercises: [
      { name: "Bench Press", sets: 4, reps: "6-8", restSeconds: 120, coachTip: "Control the eccentric. 2 seconds down. Drive hard up." },
      { name: "Overhead Press", sets: 3, reps: "8-10", restSeconds: 90, coachTip: "Brace your core. Don't arch your back." },
      { name: "Incline Dumbbell Press", sets: 3, reps: "10-12", restSeconds: 90, coachTip: "Full stretch at bottom. Squeeze at top." },
      { name: "Lateral Raise", sets: 3, reps: "12-15", restSeconds: 60, coachTip: "Lead with elbows. Slight forward lean." },
      { name: "Tricep Pushdown", sets: 3, reps: "12-15", restSeconds: 60, coachTip: "Lock upper arms to sides. Full extension." },
    ],
  },
  {
    day: "Tuesday",
    name: "Pull Day — Back, Biceps",
    type: "strength",
    exercises: [
      { name: "Barbell Row", sets: 4, reps: "6-8", restSeconds: 120, coachTip: "Chest up. Pull to lower chest. Squeeze the lats." },
      { name: "Pull-Up / Lat Pulldown", sets: 3, reps: "8-10", restSeconds: 90, coachTip: "Full hang. Pull until chin clears bar." },
      { name: "Cable Row", sets: 3, reps: "10-12", restSeconds: 90, coachTip: "Chest tall. Pull elbows past torso." },
      { name: "Face Pull", sets: 3, reps: "15", restSeconds: 60, coachTip: "External rotate at the top. Don't cheat weight." },
      { name: "Barbell Curl", sets: 3, reps: "10-12", restSeconds: 60, coachTip: "No swinging. Slow down on the way back." },
    ],
  },
  {
    day: "Thursday",
    name: "Leg Day — Quads, Hamstrings, Glutes",
    type: "strength",
    exercises: [
      { name: "Squat", sets: 4, reps: "5-8", restSeconds: 180, coachTip: "Break parallel. Knees track toes. Drive through floor." },
      { name: "Romanian Deadlift", sets: 3, reps: "8-10", restSeconds: 120, coachTip: "Hinge deep. Feel the hamstring load before pulling." },
      { name: "Leg Press", sets: 3, reps: "10-12", restSeconds: 90, coachTip: "Full range. Don't lock out. Constant tension." },
      { name: "Walking Lunge", sets: 3, reps: "12 each", restSeconds: 60, coachTip: "Long stride. Back knee touches floor lightly." },
      { name: "Calf Raise", sets: 4, reps: "15-20", restSeconds: 45, coachTip: "Full extension. Pause at top." },
    ],
  },
  {
    day: "Friday",
    name: "Upper Body — Strength Focus",
    type: "strength",
    exercises: [
      { name: "Deadlift", sets: 3, reps: "5", restSeconds: 180, coachTip: "Set your back before pulling. Don't jerk it." },
      { name: "Weighted Dip", sets: 3, reps: "8-10", restSeconds: 90, coachTip: "Lean slightly forward to hit chest." },
      { name: "Chest-Supported Row", sets: 3, reps: "10-12", restSeconds: 90, coachTip: "Chest stays on pad. Pull hard." },
      { name: "Hammer Curl", sets: 3, reps: "10-12", restSeconds: 60, coachTip: "Neutral grip. Control the negative." },
      { name: "Overhead Tricep Extension", sets: 3, reps: "12-15", restSeconds: 60, coachTip: "Keep elbows close. Full extension overhead." },
    ],
  },
];

const strengthWorkouts: PlannedWorkout[] = [
  {
    day: "Monday",
    name: "Heavy Lower — Squat Focus",
    type: "strength",
    exercises: [
      { name: "Back Squat", sets: 5, reps: "3-5", restSeconds: 240, coachTip: "Belt up. Brace hard. Break parallel every rep." },
      { name: "Romanian Deadlift", sets: 3, reps: "5", restSeconds: 180, coachTip: "Slow eccentric. Hamstrings loaded before pulling." },
      { name: "Leg Press", sets: 3, reps: "8", restSeconds: 120, coachTip: "Heavy. Full range. Don't half-rep this." },
      { name: "Glute Ham Raise / Nordic Curl", sets: 3, reps: "5-8", restSeconds: 120, coachTip: "Control the descent. Use your arms to assist if needed." },
    ],
  },
  {
    day: "Wednesday",
    name: "Heavy Upper — Press Focus",
    type: "strength",
    exercises: [
      { name: "Bench Press", sets: 5, reps: "3-5", restSeconds: 240, coachTip: "Arch set, feet planted. Explode up every rep." },
      { name: "Barbell Row", sets: 4, reps: "5", restSeconds: 180, coachTip: "Bar stays close. Pull hard. No bouncing." },
      { name: "Overhead Press", sets: 3, reps: "5", restSeconds: 180, coachTip: "Lock the legs. Full press overhead. Control down." },
      { name: "Weighted Pull-Up", sets: 3, reps: "5", restSeconds: 120, coachTip: "Dead hang start. Chin over bar. Controlled descent." },
    ],
  },
  {
    day: "Friday",
    name: "Heavy Pull — Deadlift Focus",
    type: "strength",
    exercises: [
      { name: "Deadlift", sets: 5, reps: "1-3", restSeconds: 300, coachTip: "Set the back, engage the lats, drive the floor away. No jerking." },
      { name: "Front Squat / Pause Squat", sets: 3, reps: "3-5", restSeconds: 180, coachTip: "Elbows up. Upright torso. Pause in the hole." },
      { name: "Hip Thrust", sets: 3, reps: "8", restSeconds: 120, coachTip: "Heavy weight. Drive the hips. Squeeze hard at top." },
      { name: "Face Pull", sets: 3, reps: "15", restSeconds: 60, coachTip: "Shoulder health work. Don't skip this." },
    ],
  },
];

const athleticWorkouts: PlannedWorkout[] = [
  {
    day: "Monday",
    name: "Power & Explosiveness",
    type: "strength",
    exercises: [
      { name: "Box Jump", sets: 4, reps: "5", restSeconds: 90, coachTip: "Maximum effort each rep. Land soft. Reset fully between reps." },
      { name: "Broad Jump", sets: 3, reps: "5", restSeconds: 90, coachTip: "Swing arms, explode forward. Stick the landing." },
      { name: "Power Clean / Hang Clean", sets: 4, reps: "3", restSeconds: 120, coachTip: "Triple extension — ankles, knees, hips. Fast elbows." },
      { name: "Squat", sets: 3, reps: "5", restSeconds: 180, coachTip: "Full depth. Drive through floor. Speed matters here." },
      { name: "Single-Leg RDL", sets: 3, reps: "8 each", restSeconds: 90, coachTip: "Hip hinge. Keep hips square. Control the balance." },
    ],
  },
  {
    day: "Tuesday",
    name: "Speed & Agility",
    type: "cardio",
    exercises: [
      { name: "Sprint Intervals (10 × 40m)", sets: 1, reps: "10 sprints", restSeconds: 90, coachTip: "Max speed every rep. Full rest. Not a conditioning run." },
      { name: "Lateral Shuffle (5-10-5 Drill)", sets: 5, reps: "5 reps", restSeconds: 60, coachTip: "Low hips. Explosive first step. Touch the line." },
      { name: "Cone Drills / Pro Agility", sets: 5, reps: "5 reps", restSeconds: 60, coachTip: "Plant hard on the cuts. Keep center of gravity low." },
      { name: "Ankle Hops", sets: 3, reps: "20", restSeconds: 45, coachTip: "Minimal ground contact. Stiff ankles. Fast." },
    ],
  },
  {
    day: "Thursday",
    name: "Athletic Strength",
    type: "strength",
    exercises: [
      { name: "Trap Bar Deadlift", sets: 4, reps: "5", restSeconds: 150, coachTip: "Explosive concentric. Control the eccentric." },
      { name: "Bulgarian Split Squat", sets: 3, reps: "8 each", restSeconds: 90, coachTip: "Front foot forward. Drive through heel. No forward lean." },
      { name: "Dumbbell Press", sets: 3, reps: "8-10", restSeconds: 90, coachTip: "Athletic pressing strength. Control every rep." },
      { name: "Pull-Up", sets: 3, reps: "8-10", restSeconds: 90, coachTip: "Strict form. Full hang. Chin over bar." },
      { name: "Pallof Press", sets: 3, reps: "10 each side", restSeconds: 60, coachTip: "Anti-rotation core. Stand tall. No twisting." },
    ],
  },
  {
    day: "Saturday",
    name: "Conditioning Circuit",
    type: "cardio",
    exercises: [
      { name: "Sled Push / Prowler", sets: 5, reps: "30m", restSeconds: 90, coachTip: "Low angle. Drive legs. Breathe on the walk back." },
      { name: "Battle Ropes", sets: 4, reps: "30 sec", restSeconds: 60, coachTip: "Consistent power. Don't let the waves die." },
      { name: "Burpee Broad Jump", sets: 3, reps: "8", restSeconds: 60, coachTip: "Explosive jump forward. Full push-up at the bottom." },
      { name: "Row Ergometer", sets: 3, reps: "500m", restSeconds: 120, coachTip: "Drive with legs first, then pull arms. Maintain pace." },
    ],
  },
];

const homeWorkouts: PlannedWorkout[] = [
  {
    day: "Monday",
    name: "Bodyweight Strength",
    type: "strength",
    exercises: [
      { name: "Push-Up", sets: 4, reps: "12-20", restSeconds: 60, coachTip: "Chest to floor. Elbows 45 degrees from torso." },
      { name: "Bodyweight Squat", sets: 4, reps: "20", restSeconds: 60, coachTip: "Sit back. Break parallel. Stay controlled." },
      { name: "Glute Bridge", sets: 3, reps: "15", restSeconds: 45, coachTip: "Squeeze glutes at top. Hold 1 second." },
      { name: "Pike Push-Up", sets: 3, reps: "10-12", restSeconds: 60, coachTip: "Hips high. Head between arms. Press through shoulders." },
      { name: "Hollow Hold", sets: 3, reps: "30 sec", restSeconds: 45, coachTip: "Lower back pressed to floor. Arms and legs low." },
    ],
  },
  {
    day: "Wednesday",
    name: "Conditioning Circuit",
    type: "cardio",
    exercises: [
      { name: "Burpee", sets: 4, reps: "10", restSeconds: 60, coachTip: "Full push-up at the bottom. Full jump at top." },
      { name: "Jump Squat", sets: 3, reps: "12", restSeconds: 60, coachTip: "Soft landing. Deep squat before jumping." },
      { name: "Mountain Climber", sets: 3, reps: "20 each", restSeconds: 45, coachTip: "Hips stay level. Brace hard." },
      { name: "High Knees", sets: 3, reps: "30 sec", restSeconds: 30, coachTip: "Drive arms. Knees up above hip level." },
    ],
  },
];

function getDayOfWeek(): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[new Date().getDay()];
}

export function getTodayWorkout(profile: UserProfile, plan: Plan): PlannedWorkout {
  const today = getDayOfWeek();
  const goalType = plan.goalType;
  const gymAccess = profile.gymAccess;
  const workoutFocus = profile.workoutFocus;
  const sport = profile.sport;

  let workoutList: PlannedWorkout[];

  if (gymAccess === "no gym") {
    workoutList = homeWorkouts;
  } else if (workoutFocus === "strength") {
    workoutList = strengthWorkouts;
  } else if (
    workoutFocus === "athletic_performance" ||
    workoutFocus === "conditioning" ||
    (sport && sport !== "no sport" && sport !== "none" && sport !== "general_fitness")
  ) {
    workoutList = athleticWorkouts;
  } else if (workoutFocus === "build_muscle" || goalType === "muscle_gain") {
    workoutList = muscleGainWorkouts;
  } else {
    workoutList = fatLossWorkouts;
  }

  const match = workoutList.find(w => w.day === today);
  if (match) return match;

  return {
    day: today,
    name: "Active Recovery / Walk",
    type: "cardio",
    exercises: [
      { name: "Brisk Walk", sets: 1, reps: "30-45 min", restSeconds: 0, coachTip: "This is not optional. Move every day." },
      { name: "Light Stretching", sets: 1, reps: "10-15 min", restSeconds: 0, coachTip: "Focus on hips and thoracic spine." },
    ],
  };
}

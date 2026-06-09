import type { UserProfile, Plan } from "@workspace/db";
import { parseCustomWorkoutSchedule, parseSportSchedule } from "./sportUtils";

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
      { name: "Dumbbell Press", sets: 3, reps: "10", restSeconds: 60, coachTip: "Full range. Don't bounce off chest." },
      { name: "Dumbbell Row", sets: 3, reps: "12 each", restSeconds: 60, coachTip: "Pull to hip. Don't swing. Control the lowering." },
      { name: "Reverse Lunge", sets: 3, reps: "10 each leg", restSeconds: 60, coachTip: "Back knee hovers 1 inch off floor." },
      { name: "Lat Pulldown / Pull-Up", sets: 3, reps: "8-12", restSeconds: 60, coachTip: "Elbows down and back. Chest up." },
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
      { name: "Burpee", sets: 3, reps: "8", restSeconds: 45, coachTip: "Full push-up at bottom. Full jump at top." },
    ],
  },
  {
    day: "Friday",
    name: "Full Body Strength B",
    type: "strength",
    exercises: [
      { name: "Romanian Deadlift", sets: 3, reps: "10", restSeconds: 90, coachTip: "Hinge at hips. Slight knee bend. Feel the hamstrings load." },
      { name: "Push-Up", sets: 3, reps: "10-15", restSeconds: 60, coachTip: "Chest to floor. No half reps. Full range." },
      { name: "Dumbbell Row", sets: 3, reps: "12 each", restSeconds: 60, coachTip: "Pull to hip. Don't swing. Control the lowering." },
      { name: "Step-Up", sets: 3, reps: "12 each leg", restSeconds: 60, coachTip: "Drive through the heel on top. Don't push off the floor." },
      { name: "Dumbbell Lateral Raise", sets: 3, reps: "12", restSeconds: 45, coachTip: "Lead with elbows. Light weight." },
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
      { name: "Dumbbell Fly", sets: 3, reps: "12-15", restSeconds: 60, coachTip: "Stretch at bottom. Squeeze at top." },
      { name: "Overhead Tricep Extension", sets: 3, reps: "12-15", restSeconds: 60, coachTip: "Keep elbows close. Full extension overhead." },
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
      { name: "Hammer Curl", sets: 3, reps: "12-15", restSeconds: 60, coachTip: "Neutral grip. Control the negative." },
      { name: "Rear Delt Fly", sets: 3, reps: "15", restSeconds: 60, coachTip: "Lead with elbows. Squeeze at back." },
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
      { name: "Hip Thrust", sets: 3, reps: "12-15", restSeconds: 60, coachTip: "Drive hips. Squeeze at top." },
      { name: "Leg Curl", sets: 3, reps: "12-15", restSeconds: 60, coachTip: "Control the eccentric. No swinging." },
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
      { name: "Lateral Raise", sets: 3, reps: "12-15", restSeconds: 60, coachTip: "Lead with elbows. Light weight." },
      { name: "Close-Grip Bench Press", sets: 3, reps: "8-10", restSeconds: 90, coachTip: "Elbows tucked. Lower to chest." },
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
      { name: "Romanian Deadlift", sets: 4, reps: "5", restSeconds: 180, coachTip: "Slow eccentric. Hamstrings loaded before pulling." },
      { name: "Leg Press", sets: 3, reps: "8", restSeconds: 120, coachTip: "Heavy. Full range. Don't half-rep this." },
      { name: "Glute Ham Raise / Nordic Curl", sets: 3, reps: "5-8", restSeconds: 120, coachTip: "Control the descent. Use your arms to assist if needed." },
      { name: "Walking Lunge", sets: 3, reps: "10 each", restSeconds: 90, coachTip: "Heavy DBs. Long stride. Back knee touches." },
      { name: "Standing Calf Raise", sets: 4, reps: "12-15", restSeconds: 60, coachTip: "Full stretch at bottom. Pause at top." },
      { name: "Plank", sets: 3, reps: "60 sec", restSeconds: 45, coachTip: "Brace hard. No hip sag." },
    ],
  },
  {
    day: "Wednesday",
    name: "Heavy Upper — Press Focus",
    type: "strength",
    exercises: [
      { name: "Bench Press", sets: 5, reps: "3-5", restSeconds: 240, coachTip: "Arch set, feet planted. Explode up every rep." },
      { name: "Barbell Row", sets: 4, reps: "5", restSeconds: 180, coachTip: "Bar stays close. Pull hard. No bouncing." },
      { name: "Overhead Press", sets: 4, reps: "5", restSeconds: 180, coachTip: "Lock the legs. Full press overhead. Control down." },
      { name: "Weighted Pull-Up", sets: 4, reps: "5", restSeconds: 120, coachTip: "Dead hang start. Chin over bar. Controlled descent." },
      { name: "Close-Grip Bench Press", sets: 3, reps: "6-8", restSeconds: 90, coachTip: "Elbows tucked. Chest focused." },
      { name: "Face Pull", sets: 3, reps: "15", restSeconds: 60, coachTip: "Shoulder health work. External rotate at top." },
      { name: "Hanging Leg Raise", sets: 3, reps: "10", restSeconds: 60, coachTip: "Strict. No swing. Control every rep." },
    ],
  },
  {
    day: "Friday",
    name: "Heavy Pull — Deadlift Focus",
    type: "strength",
    exercises: [
      { name: "Deadlift", sets: 5, reps: "1-3", restSeconds: 300, coachTip: "Set the back, engage the lats, drive the floor away. No jerking." },
      { name: "Front Squat / Pause Squat", sets: 4, reps: "3-5", restSeconds: 180, coachTip: "Elbows up. Upright torso. Pause in the hole." },
      { name: "Hip Thrust", sets: 4, reps: "8", restSeconds: 120, coachTip: "Heavy weight. Drive the hips. Squeeze hard at top." },
      { name: "Barbell Row", sets: 4, reps: "5", restSeconds: 180, coachTip: "Chest up. Pull to lower chest. Squeeze lats." },
      { name: "Lat Pulldown", sets: 3, reps: "8", restSeconds: 120, coachTip: "Pull to chest. Squeeze lats at bottom." },
      { name: "Barbell Shrug", sets: 3, reps: "8", restSeconds: 90, coachTip: "Heavy weight. Squeeze traps at top." },
      { name: "Ab Wheel Rollout", sets: 3, reps: "8-10", restSeconds: 60, coachTip: "Hollow body. Don't let back arch." },
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
      { name: "Squat", sets: 4, reps: "5", restSeconds: 180, coachTip: "Full depth. Drive through floor. Speed matters here." },
      { name: "Single-Leg RDL", sets: 3, reps: "8 each", restSeconds: 90, coachTip: "Hip hinge. Keep hips square. Control the balance." },
      { name: "Medicine Ball Throw", sets: 4, reps: "5", restSeconds: 90, coachTip: "Explosive release. Rotate from hips." },
      { name: "Pallof Press", sets: 3, reps: "10 each side", restSeconds: 60, coachTip: "Anti-rotation core. Stand tall. No twisting." },
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
      { name: "Bounds / Skips", sets: 3, reps: "30m", restSeconds: 60, coachTip: "Big, powerful strides. Drive off the ground." },
      { name: "Tuck Jump", sets: 3, reps: "8", restSeconds: 60, coachTip: "Explosive vertical. Land soft and reset." },
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
      { name: "Pull-Up", sets: 4, reps: "8-10", restSeconds: 90, coachTip: "Strict form. Full hang. Chin over bar." },
      { name: "Pallof Press", sets: 3, reps: "10 each side", restSeconds: 60, coachTip: "Anti-rotation core. Stand tall. No twisting." },
      { name: "Single-Arm Dumbbell Snatch", sets: 3, reps: "5 each", restSeconds: 90, coachTip: "Explosive hip drive. Lock out overhead." },
      { name: "Farmer Carry", sets: 3, reps: "40m", restSeconds: 60, coachTip: "Heavy DBs. Shoulders back. Walk tall." },
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
      { name: "Kettlebell Swing", sets: 4, reps: "15", restSeconds: 60, coachTip: "Hip hinge. Snap the hips. Let the weight float." },
      { name: "Sprint Push-Up", sets: 3, reps: "10", restSeconds: 45, coachTip: "Fast, explosive push-ups. No sloppy reps." },
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
      { name: "Reverse Lunge", sets: 3, reps: "10 each", restSeconds: 60, coachTip: "Back knee hovers 1 inch off floor." },
      { name: "Diamond Push-Up", sets: 3, reps: "8-12", restSeconds: 60, coachTip: "Hands close together. Triceps focused." },
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
      { name: "Plank", sets: 3, reps: "45 sec", restSeconds: 45, coachTip: "Squeeze everything. No hips up." },
      { name: "Bodyweight Squat", sets: 3, reps: "15", restSeconds: 45, coachTip: "Fast pace. Heart rate elevated." },
    ],
  },
  {
    day: "Friday",
    name: "Full Body HIIT",
    type: "cardio",
    exercises: [
      { name: "Burpee", sets: 3, reps: "10", restSeconds: 45, coachTip: "Full push-up at bottom. Full jump at top." },
      { name: "Jump Squat", sets: 3, reps: "12", restSeconds: 45, coachTip: "Soft landing. Deep squat before jumping." },
      { name: "Push-Up", sets: 3, reps: "15", restSeconds: 45, coachTip: "Chest to floor. No half reps." },
      { name: "Mountain Climber", sets: 3, reps: "20 each", restSeconds: 30, coachTip: "Hips stay level. Brace hard." },
      { name: "Glute Bridge", sets: 3, reps: "15", restSeconds: 30, coachTip: "Squeeze glutes at top." },
      { name: "High Knees", sets: 3, reps: "30 sec", restSeconds: 30, coachTip: "Drive arms. Knees up above hip level." },
    ],
  },
];

function getDayOfWeek(): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[new Date().getDay()];
}

const BODY_PART_EXERCISES: Record<string, Record<string, { name: string; sets: number; reps: string; restSeconds: number; coachTip: string }[]>> = {
  beginner: {
    chest: [
      { name: "Push-Up", sets: 3, reps: "10-15", restSeconds: 60, coachTip: "Chest to floor. No half reps." },
      { name: "Incline Push-Up", sets: 3, reps: "12", restSeconds: 60, coachTip: "Hands on a bench or table. Lower slow." },
      { name: "Dumbbell Floor Press", sets: 3, reps: "10-12", restSeconds: 60, coachTip: "Elbows 45 degrees. Press to lockout." },
    ],
    back: [
      { name: "Dumbbell Row", sets: 3, reps: "12 each", restSeconds: 60, coachTip: "Pull to hip. Don't swing." },
      { name: "Superman Holds", sets: 3, reps: "20 sec", restSeconds: 45, coachTip: "Squeeze lower back and glutes." },
      { name: "Band Pull-Apart", sets: 3, reps: "15", restSeconds: 45, coachTip: "Pull band apart. Squeeze shoulder blades." },
    ],
    biceps: [
      { name: "Dumbbell Curl", sets: 3, reps: "12", restSeconds: 60, coachTip: "No swinging. Control the negative." },
      { name: "Hammer Curl", sets: 3, reps: "12", restSeconds: 60, coachTip: "Neutral grip. Keep elbows still." },
    ],
    triceps: [
      { name: "Diamond Push-Up", sets: 3, reps: "8-12", restSeconds: 60, coachTip: "Hands close together. Elbows stay tucked." },
      { name: "Tricep Dip (Bench)", sets: 3, reps: "10-12", restSeconds: 60, coachTip: "Elbows back. Lower until upper arms are parallel." },
    ],
    shoulders: [
      { name: "Pike Push-Up", sets: 3, reps: "8-12", restSeconds: 60, coachTip: "Hips high. Head between arms. Press through shoulders." },
      { name: "Dumbbell Lateral Raise", sets: 3, reps: "12", restSeconds: 60, coachTip: "Lead with elbows. Light weight. No swing." },
      { name: "Front Raise", sets: 3, reps: "12", restSeconds: 60, coachTip: "Arms straight. Raise to eye level." },
    ],
    legs: [
      { name: "Bodyweight Squat", sets: 3, reps: "15", restSeconds: 60, coachTip: "Sit back. Break parallel. Stay controlled." },
      { name: "Reverse Lunge", sets: 3, reps: "10 each", restSeconds: 60, coachTip: "Back knee hovers 1 inch off floor." },
      { name: "Goblet Squat", sets: 3, reps: "10-12", restSeconds: 60, coachTip: "Hold a dumbbell at chest. Keep chest up." },
      { name: "Calf Raise", sets: 3, reps: "15", restSeconds: 45, coachTip: "Full range. Pause at top." },
    ],
    glutes: [
      { name: "Glute Bridge", sets: 3, reps: "15", restSeconds: 45, coachTip: "Squeeze glutes at top. Hold 1 second." },
      { name: "Fire Hydrant", sets: 3, reps: "12 each", restSeconds: 45, coachTip: "Lift knee to side. No arching back." },
      { name: "Step-Up", sets: 3, reps: "10 each", restSeconds: 60, coachTip: "Drive through heel on top. Tall posture." },
    ],
    core: [
      { name: "Plank", sets: 3, reps: "30-45 sec", restSeconds: 45, coachTip: "Squeeze everything. No hips up." },
      { name: "Dead Bug", sets: 3, reps: "10 each side", restSeconds: 45, coachTip: "Lower back stays glued to floor." },
      { name: "Bicycle Crunch", sets: 3, reps: "15 each", restSeconds: 45, coachTip: "Rotate the torso. Elbow to opposite knee." },
    ],
    conditioning: [
      { name: "Jumping Jacks", sets: 3, reps: "30 sec", restSeconds: 30, coachTip: "Keep arms and legs straight." },
      { name: "High Knees", sets: 3, reps: "30 sec", restSeconds: 30, coachTip: "Drive arms. Knees up above hip level." },
      { name: "Butt Kicks", sets: 3, reps: "30 sec", restSeconds: 30, coachTip: "Heels to glutes. Quick turnover." },
    ],
    rest: [
      { name: "Brisk Walk", sets: 1, reps: "20-30 min", restSeconds: 0, coachTip: "Keep moving. Light recovery." },
    ],
  },
  intermediate: {
    chest: [
      { name: "Dumbbell Bench Press", sets: 3, reps: "10-12", restSeconds: 90, coachTip: "Full range. Don't bounce off chest." },
      { name: "Push-Up", sets: 3, reps: "15-20", restSeconds: 60, coachTip: "Chest to floor. Explode up." },
      { name: "Cable Crossover", sets: 3, reps: "12-15", restSeconds: 60, coachTip: "Squeeze chest at center. Control the return." },
    ],
    back: [
      { name: "Lat Pulldown", sets: 3, reps: "10-12", restSeconds: 90, coachTip: "Pull to chest. Squeeze lats at bottom." },
      { name: "Dumbbell Row", sets: 3, reps: "10-12 each", restSeconds: 90, coachTip: "Pull to hip. No rotation." },
      { name: "Seated Cable Row", sets: 3, reps: "10-12", restSeconds: 90, coachTip: "Pull to navel. Squeeze shoulder blades." },
    ],
    biceps: [
      { name: "Barbell Curl", sets: 3, reps: "10-12", restSeconds: 60, coachTip: "No swinging. Full stretch at bottom." },
      { name: "Hammer Curl", sets: 3, reps: "12-15", restSeconds: 60, coachTip: "Neutral grip. Control the lowering." },
      { name: "Incline Dumbbell Curl", sets: 3, reps: "10-12", restSeconds: 60, coachTip: "Stretch at bottom. Curl with no swing." },
    ],
    triceps: [
      { name: "Tricep Pushdown", sets: 3, reps: "12-15", restSeconds: 60, coachTip: "Lock upper arms. Full extension." },
      { name: "Overhead Tricep Extension", sets: 3, reps: "12-15", restSeconds: 60, coachTip: "Keep elbows close. Full extension overhead." },
      { name: "Skullcrusher", sets: 3, reps: "10-12", restSeconds: 60, coachTip: "Elbows stay back. Lower to forehead." },
    ],
    shoulders: [
      { name: "Overhead Press", sets: 3, reps: "10-12", restSeconds: 90, coachTip: "Brace core. Press overhead. No arching." },
      { name: "Lateral Raise", sets: 3, reps: "12-15", restSeconds: 60, coachTip: "Lead with elbows. Slight forward lean." },
      { name: "Face Pull", sets: 3, reps: "15", restSeconds: 60, coachTip: "External rotate at the top. Don't cheat." },
    ],
    legs: [
      { name: "Goblet Squat", sets: 3, reps: "12", restSeconds: 90, coachTip: "Drive through heels. Keep chest up." },
      { name: "Romanian Deadlift", sets: 3, reps: "10", restSeconds: 90, coachTip: "Hinge at hips. Feel hamstrings load." },
      { name: "Leg Press", sets: 3, reps: "12-15", restSeconds: 90, coachTip: "Full range. Don't lock out." },
      { name: "Walking Lunge", sets: 3, reps: "10 each", restSeconds: 60, coachTip: "Long stride. Back knee touches floor." },
    ],
    glutes: [
      { name: "Hip Thrust", sets: 3, reps: "12", restSeconds: 60, coachTip: "Drive hips. Squeeze at top." },
      { name: "Bulgarian Split Squat", sets: 3, reps: "10 each", restSeconds: 90, coachTip: "Front foot forward. Back knee touches floor." },
      { name: "Cable Pull-Through", sets: 3, reps: "12-15", restSeconds: 60, coachTip: "Hip hinge. Squeeze glutes at the top." },
    ],
    core: [
      { name: "Hanging Knee Raise", sets: 3, reps: "12", restSeconds: 60, coachTip: "Control the swing. No momentum." },
      { name: "Ab Wheel Rollout", sets: 3, reps: "8-10", restSeconds: 60, coachTip: "Hollow body. Don't arch." },
      { name: "Russian Twist", sets: 3, reps: "15 each", restSeconds: 45, coachTip: "Rotate from the core. Keep feet elevated." },
    ],
    conditioning: [
      { name: "Burpee", sets: 4, reps: "10", restSeconds: 60, coachTip: "Full push-up at bottom. Full jump at top." },
      { name: "Mountain Climbers", sets: 3, reps: "20 each", restSeconds: 45, coachTip: "Hips stay level. Brace hard." },
      { name: "Jump Squat", sets: 3, reps: "12", restSeconds: 60, coachTip: "Soft landing. Deep squat before jumping." },
    ],
    rest: [
      { name: "Brisk Walk or Light Stretch", sets: 1, reps: "20-30 min", restSeconds: 0, coachTip: "Active recovery. Keep blood moving." },
    ],
  },
  advanced: {
    chest: [
      { name: "Bench Press", sets: 4, reps: "6-8", restSeconds: 120, coachTip: "Control the eccentric. 2 seconds down." },
      { name: "Incline Dumbbell Press", sets: 4, reps: "8-10", restSeconds: 90, coachTip: "Full stretch at bottom. Squeeze at top." },
      { name: "Weighted Dip", sets: 4, reps: "8-10", restSeconds: 90, coachTip: "Lean slightly forward. Full depth." },
      { name: "Cable Crossover", sets: 4, reps: "12-15", restSeconds: 60, coachTip: "Squeeze chest at center. Slow return." },
    ],
    back: [
      { name: "Barbell Row", sets: 4, reps: "6-8", restSeconds: 120, coachTip: "Chest up. Pull to lower chest." },
      { name: "Weighted Pull-Up", sets: 4, reps: "5-8", restSeconds: 120, coachTip: "Full hang. Chin over bar." },
      { name: "Chest-Supported Row", sets: 4, reps: "8-10", restSeconds: 90, coachTip: "Chest on pad. Pull hard. No momentum." },
      { name: "Deadlift", sets: 4, reps: "3-5", restSeconds: 180, coachTip: "Set the back. Pull the floor away." },
    ],
    biceps: [
      { name: "Barbell Curl", sets: 4, reps: "8-10", restSeconds: 90, coachTip: "No swinging. Slow negative." },
      { name: "Hammer Curl", sets: 4, reps: "10-12", restSeconds: 60, coachTip: "Neutral grip. Control the lowering." },
      { name: "Incline Dumbbell Curl", sets: 4, reps: "10-12", restSeconds: 60, coachTip: "Stretch at bottom. No swing." },
    ],
    triceps: [
      { name: "Close-Grip Bench Press", sets: 4, reps: "8-10", restSeconds: 90, coachTip: "Elbows tucked. Lower to chest." },
      { name: "Overhead Tricep Extension", sets: 4, reps: "12-15", restSeconds: 60, coachTip: "Keep elbows close. Full extension." },
      { name: "Dip", sets: 4, reps: "10-12", restSeconds: 90, coachTip: "Upright for triceps. Deep stretch." },
    ],
    shoulders: [
      { name: "Overhead Press", sets: 4, reps: "6-8", restSeconds: 120, coachTip: "Brace core. Full press overhead." },
      { name: "Lateral Raise", sets: 4, reps: "12-15", restSeconds: 60, coachTip: "Lead with elbows. Slow negative." },
      { name: "Face Pull", sets: 4, reps: "15", restSeconds: 60, coachTip: "External rotate at top. Don't cheat." },
      { name: "Rear Delt Fly", sets: 4, reps: "12-15", restSeconds: 60, coachTip: "Lead with elbows. Squeeze at back." },
    ],
    legs: [
      { name: "Squat", sets: 4, reps: "5-8", restSeconds: 180, coachTip: "Break parallel. Knees track toes." },
      { name: "Romanian Deadlift", sets: 4, reps: "8-10", restSeconds: 120, coachTip: "Hinge deep. Feel hamstrings load." },
      { name: "Leg Press", sets: 4, reps: "10-12", restSeconds: 120, coachTip: "Heavy. Full range. Don't lock out." },
      { name: "Front Squat", sets: 4, reps: "5-8", restSeconds: 180, coachTip: "Elbows up. Upright torso." },
    ],
    glutes: [
      { name: "Hip Thrust", sets: 4, reps: "8-10", restSeconds: 90, coachTip: "Heavy. Drive hips. Squeeze hard." },
      { name: "Bulgarian Split Squat", sets: 4, reps: "8 each", restSeconds: 90, coachTip: "Front foot forward. Back knee touches." },
      { name: "Glute Ham Raise", sets: 4, reps: "6-8", restSeconds: 90, coachTip: "Control the descent. No cheating." },
    ],
    core: [
      { name: "Hanging Leg Raise", sets: 4, reps: "10", restSeconds: 60, coachTip: "Strict. No swinging." },
      { name: "Weighted Plank", sets: 4, reps: "45-60 sec", restSeconds: 60, coachTip: "Add weight on back. Squeeze glutes." },
      { name: "Ab Wheel Rollout", sets: 4, reps: "8-12", restSeconds: 60, coachTip: "Hollow body. No arch." },
    ],
    conditioning: [
      { name: "Sprint Intervals", sets: 8, reps: "30 sec sprint / 90 sec rest", restSeconds: 90, coachTip: "Max effort. Full recovery." },
      { name: "Box Jump", sets: 5, reps: "5", restSeconds: 90, coachTip: "Maximum effort. Land soft." },
      { name: "Prowler Push", sets: 5, reps: "30m", restSeconds: 90, coachTip: "Low angle. Drive legs." },
    ],
    rest: [
      { name: "Brisk Walk, Foam Roll, Stretch", sets: 1, reps: "20-30 min", restSeconds: 0, coachTip: "Recovery work. Keep moving." },
    ],
  },
};

function buildCustomWorkout(
  focus: string,
  level: string,
  gymAccess: string
): PlannedWorkout {
  const parts = focus.toLowerCase().split(/[,\/&]|\band\b/).map(p => p.trim().replace(/s$/, "")).filter(Boolean);
  const levelKey = level === "advanced" ? "advanced" : level === "intermediate" ? "intermediate" : "beginner";
  const exercises: Exercise[] = [];
  const seen = new Set<string>();

  // Target exercise count based on level and number of body parts
  const targetMin = levelKey === "advanced" ? 6 : levelKey === "intermediate" ? 5 : 4;
  const targetMax = levelKey === "advanced" ? 8 : levelKey === "intermediate" ? 7 : 5;
  const targetCount = Math.max(targetMin, Math.min(targetMax, parts.length * 2 + 2));

  // Determine which body parts to use for filling
  const primaryParts = parts.filter(p => p !== "rest");
  const fillParts = ["core", "conditioning"].filter(p => !primaryParts.includes(p));

  // Collect exercises from each part
  const collected: Exercise[] = [];
  for (const part of parts) {
    const partKey = Object.keys(BODY_PART_EXERCISES[levelKey]).find(k =>
      k.includes(part) || part.includes(k)
    ) || (part === "rest" ? "rest" : undefined);

    if (!partKey) continue;
    const partExercises = BODY_PART_EXERCISES[levelKey][partKey];
    if (!partExercises) continue;

    for (const ex of partExercises) {
      const key = ex.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        // Adjust for gym access
        if (gymAccess === "no gym" && (ex.name.includes("Dumbbell") || ex.name.includes("Barbell"))) {
          collected.push({ ...ex, name: ex.name.replace("Dumbbell ", "").replace("Barbell ", "Bodyweight "), coachTip: "Use bodyweight or bands. " + ex.coachTip });
        } else {
          collected.push(ex);
        }
      }
    }
  }

  // If not enough exercises, add from core and conditioning
  for (const fillPart of fillParts) {
    if (collected.length >= targetCount) break;
    const partExercises = BODY_PART_EXERCISES[levelKey][fillPart];
    if (!partExercises) continue;
    for (const ex of partExercises) {
      const key = ex.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        if (gymAccess === "no gym" && (ex.name.includes("Dumbbell") || ex.name.includes("Barbell"))) {
          collected.push({ ...ex, name: ex.name.replace("Dumbbell ", "").replace("Barbell ", "Bodyweight "), coachTip: "Use bodyweight or bands. " + ex.coachTip });
        } else {
          collected.push(ex);
        }
      }
    }
  }

  // Sort: compound movements first (squats, presses, deadlifts, rows, pull-ups)
  const compound = ["squat", "deadlift", "press", "bench", "row", "pull-up", "pulldown", "clean", "snatch", "hip thrust", "lunge"];
  const isCompound = (name: string) => compound.some(c => name.toLowerCase().includes(c));
  collected.sort((a, b) => {
    const aC = isCompound(a.name) ? -1 : 0;
    const bC = isCompound(b.name) ? -1 : 0;
    return aC - bC;
  });

  // Trim to target count
  exercises.push(...collected.slice(0, targetCount));

  const name = parts.length > 1 ? `${parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" / ")}` : focus;
  return {
    day: "",
    name: name || "Custom Workout",
    type: parts.includes("rest") ? "rest" : "strength",
    exercises: exercises.length > 0 ? exercises : [
      { name: "Brisk Walk", sets: 1, reps: "30-45 min", restSeconds: 0, coachTip: "Keep moving every day." },
    ],
  };
}

export function getTodayWorkout(profile: UserProfile, plan: Plan): PlannedWorkout {
  const today = getDayOfWeek();
  const goalType = plan.goalType;
  const gymAccess = profile.gymAccess;
  const workoutFocus = profile.workoutFocus;
  const sport = profile.sport;

  // Check custom workout schedule first
  const customSchedule = parseCustomWorkoutSchedule(profile);
  if (customSchedule) {
    const customDay = customSchedule.days.find(d => d.day.toLowerCase() === today.toLowerCase());
    if (customDay) {
      if (customDay.focus.toLowerCase().includes("rest")) {
        return {
          day: today,
          name: "Rest Day",
          type: "rest",
          exercises: [
            { name: "Brisk Walk", sets: 1, reps: "20-30 min", restSeconds: 0, coachTip: "Active recovery. Keep blood moving." },
            { name: "Light Stretching", sets: 1, reps: "10-15 min", restSeconds: 0, coachTip: "Focus on hips and shoulders." },
          ],
        };
      }
      const result = buildCustomWorkout(customDay.focus, profile.fitnessLevel, gymAccess);
      result.day = today;
      return result;
    }
  }

  // Check if today is a sport practice day
  const sportSchedule = parseSportSchedule(profile);
  if (sportSchedule) {
    const practiceDay = sportSchedule.days.find(d => d.toLowerCase() === today.toLowerCase());
    if (practiceDay) {
      return {
        day: today,
        name: `${sportSchedule.sport} Practice`,
        type: "sport",
        exercises: [
          { name: "Sport-Specific Warm-Up", sets: 1, reps: "10-15 min", restSeconds: 0, coachTip: "Dynamic stretches. Sport-specific movement prep." },
          { name: `${sportSchedule.sport} Practice`, sets: 1, reps: `${sportSchedule.durationMinutes} min`, restSeconds: 0, coachTip: `${sportSchedule.intensity} intensity. Stay hydrated. Focus on technique.` },
          { name: "Cool Down + Stretch", sets: 1, reps: "10 min", restSeconds: 0, coachTip: "Static stretches. Foam roll if available." },
        ],
      };
    }
  }

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

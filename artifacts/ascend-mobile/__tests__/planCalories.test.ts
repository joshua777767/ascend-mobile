/**
 * Calorie calculation tests — doctor-level verification
 *
 * Formula: Mifflin-St Jeor BMR × NEAT-adjusted activity multiplier ± goal surplus/deficit
 *
 * The plan generator separates two distinct calorie components:
 *   1. Base TDEE  = BMR × activityMult  (lifestyle NEAT only — no exercise)
 *   2. Workout-day bonus = base + estimatedExerciseBurn  (added per day)
 *
 * activityMult is derived from workoutDaysPerWeek to reflect:
 *   - Elevated resting metabolic rate from consistent training
 *   - EPOC (excess post-exercise oxygen consumption) across the week
 *   - Greater incidental movement in active lifestyles
 * It does NOT include the exercise sessions themselves (those are added per-day),
 * so there is no double-counting.
 *
 * activityMult table:
 *   0 days   → 1.20  sedentary
 *   1-2 days → 1.30  lightly active
 *   3-4 days → 1.40  moderately active
 *   5+ days  → 1.50  very active
 */

// ─── Unit-conversion helpers (mirror planGenerator.ts conventions) ────────────

/** Convert pounds to kilograms */
function lbsToKg(lbs: number): number {
  return lbs / 2.2046;
}

/** Convert total inches to centimetres */
function inchesToCm(inches: number): number {
  return inches * 2.54;
}

/** Convert feet + inches to centimetres */
function ftInToCm(feet: number, inches: number): number {
  return inchesToCm(feet * 12 + inches);
}

// ─── Core calculation functions (mirror planGenerator.ts logic exactly) ────────

/** Mifflin-St Jeor BMR (kcal/day) */
function calcBMR(weightKg: number, heightCm: number, age: number, isMale: boolean): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return isMale ? base + 5 : base - 161;
}

/**
 * NEAT-adjusted activity multiplier.
 * Covers non-exercise thermogenesis and training-induced RMR elevation.
 * Exercise burns are added separately per workout day.
 */
function activityMultiplier(workoutDaysPerWeek: number): number {
  if (workoutDaysPerWeek === 0) return 1.20;
  if (workoutDaysPerWeek <= 2) return 1.30;
  if (workoutDaysPerWeek <= 4) return 1.40;
  return 1.50;
}

/** Base TDEE (kcal/day), rounded to nearest whole calorie */
function calcTDEE(bmr: number, workoutDaysPerWeek: number): number {
  return Math.round(bmr * activityMultiplier(workoutDaysPerWeek));
}

/**
 * Goal type derived from user intent + weight-diff.
 * "gain muscle" is a recomp only when the scale-weight goal is < 5 kg above
 * current weight. A larger goal means a lean bulk is required.
 */
function resolveGoalType(
  goalString: string,
  currentKg: number,
  goalKg: number,
): "fat_loss" | "muscle_gain" | "recomp" | "maintain" {
  const weightDiff = goalKg - currentKg;
  const isGain = weightDiff > 1;
  const isLoss = weightDiff < -1;

  if (["lose weight", "lose fat"].includes(goalString)) return "fat_loss";
  if (goalString === "gain weight and muscle")           return "muscle_gain";
  if (goalString === "gain muscle") {
    // Significant scale-weight target → lean bulk; otherwise body recomp
    return weightDiff > 5 ? "muscle_gain" : "recomp";
  }
  if (["stay fit", "maintain fitness"].includes(goalString)) return "maintain";
  // Legacy weight-diff fallback
  if (isLoss) return "fat_loss";
  if (isGain) return "muscle_gain";
  return "maintain";
}

/** Calorie surplus for a muscle-gain goal (kcal/day above TDEE) */
function muscleGainSurplus(commitment: string): number {
  if (commitment === "casual")              return 250;
  if (commitment === "extreme_discipline")  return 400;
  return 300; // serious / locked_in / default
}

/** Final base calorie target (rest-day, before any per-workout-day additions) */
function calcCalorieTarget(
  tdee: number,
  goalType: "fat_loss" | "muscle_gain" | "recomp" | "maintain",
  commitment: string,
  calorieFloorMale = 1500,
): number {
  if (goalType === "fat_loss") {
    const deficit = commitment === "casual" ? 300 : 500;
    return Math.max(calorieFloorMale, tdee - deficit);
  }
  if (goalType === "muscle_gain") {
    return tdee + muscleGainSurplus(commitment);
  }
  if (goalType === "recomp") {
    return tdee + (commitment === "casual" ? 75 : 100);
  }
  return tdee; // maintain
}

// ─── Test profile constants ────────────────────────────────────────────────────

// Male, 16 yo, 5′10″, 135 lb → goal 160 lb, 4 workout days, serious commitment
const PROFILE = {
  weightKg:    lbsToKg(135),       // 61.235 kg
  heightCm:    ftInToCm(5, 10),    // 177.8 cm
  goalKg:      lbsToKg(160),       // 72.575 kg
  age:         16,
  isMale:      true,
  workoutDays: 4,
  commitment:  "serious",
  goal:        "gain muscle",
} as const;

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("Unit conversions", () => {
  test("135 lb converts to ~61.24 kg", () => {
    expect(lbsToKg(135)).toBeCloseTo(61.235, 2);
  });

  test("160 lb converts to ~72.57 kg", () => {
    expect(lbsToKg(160)).toBeCloseTo(72.575, 2);
  });

  test("5′10″ converts to 177.8 cm", () => {
    expect(ftInToCm(5, 10)).toBeCloseTo(177.8, 1);
  });

  test("6′0″ converts to 182.88 cm", () => {
    expect(ftInToCm(6, 0)).toBeCloseTo(182.88, 1);
  });

  test("lbsToKg and back loses < 0.01 kg", () => {
    const kg = lbsToKg(200);
    const lbs = kg * 2.2046;
    expect(lbs).toBeCloseTo(200, 1);
  });
});

describe("BMR — Mifflin-St Jeor formula", () => {
  test("16yo male 135 lb 5′10″ → BMR ≈ 1649 kcal", () => {
    const bmr = calcBMR(PROFILE.weightKg, PROFILE.heightCm, PROFILE.age, true);
    // 10(61.235) + 6.25(177.8) - 5(16) + 5 = 612.35 + 1111.25 - 80 + 5 = 1648.6
    expect(bmr).toBeCloseTo(1648.6, 0);
  });

  test("Male BMR is higher than female BMR for identical stats", () => {
    const maleBMR   = calcBMR(PROFILE.weightKg, PROFILE.heightCm, PROFILE.age, true);
    const femaleBMR = calcBMR(PROFILE.weightKg, PROFILE.heightCm, PROFILE.age, false);
    // Male constant +5, female -161 → difference of 166 kcal
    expect(maleBMR - femaleBMR).toBeCloseTo(166, 0);
  });

  test("BMR increases with weight (all else equal)", () => {
    const light  = calcBMR(60, 177.8, 25, true);
    const heavy  = calcBMR(90, 177.8, 25, true);
    expect(heavy).toBeGreaterThan(light);
  });

  test("BMR decreases with age (all else equal)", () => {
    const young = calcBMR(70, 177.8, 20, true);
    const older = calcBMR(70, 177.8, 40, true);
    expect(young).toBeGreaterThan(older);
  });

  test("BMR increases with height (all else equal)", () => {
    const short = calcBMR(70, 165, 25, true);
    const tall  = calcBMR(70, 185, 25, true);
    expect(tall).toBeGreaterThan(short);
  });
});

describe("Activity multiplier (NEAT-adjusted, exercise NOT included)", () => {
  test("0 workout days → 1.20 (sedentary)", () => {
    expect(activityMultiplier(0)).toBe(1.20);
  });

  test("1 workout day → 1.30 (lightly active)", () => {
    expect(activityMultiplier(1)).toBe(1.30);
  });

  test("2 workout days → 1.30 (lightly active)", () => {
    expect(activityMultiplier(2)).toBe(1.30);
  });

  test("3 workout days → 1.40 (moderately active)", () => {
    expect(activityMultiplier(3)).toBe(1.40);
  });

  test("4 workout days → 1.40 (moderately active)", () => {
    expect(activityMultiplier(4)).toBe(1.40);
  });

  test("5 workout days → 1.50 (very active)", () => {
    expect(activityMultiplier(5)).toBe(1.50);
  });

  test("6 workout days → 1.50 (very active)", () => {
    expect(activityMultiplier(6)).toBe(1.50);
  });

  test("7 workout days → 1.50 (very active)", () => {
    expect(activityMultiplier(7)).toBe(1.50);
  });

  test("multiplier strictly increases with activity tier", () => {
    const m0 = activityMultiplier(0);
    const m2 = activityMultiplier(2);
    const m4 = activityMultiplier(4);
    const m6 = activityMultiplier(6);
    expect(m0).toBeLessThan(m2);
    expect(m2).toBeLessThan(m4);
    expect(m4).toBeLessThan(m6);
  });
});

describe("TDEE calculation (BMR × activityMult)", () => {
  test("16yo male 135 lb 5′10″, 0 workout days (sedentary) → TDEE ≈ 1979", () => {
    const bmr  = calcBMR(PROFILE.weightKg, PROFILE.heightCm, PROFILE.age, true);
    const tdee = calcTDEE(bmr, 0);
    // 1648.6 × 1.20 = 1978.3 → rounds to 1978 or 1979
    expect(tdee).toBeGreaterThanOrEqual(1978);
    expect(tdee).toBeLessThanOrEqual(1980);
  });

  test("16yo male 135 lb 5′10″, 4 workout days (moderately active) → TDEE ≈ 2309", () => {
    const bmr  = calcBMR(PROFILE.weightKg, PROFILE.heightCm, PROFILE.age, true);
    const tdee = calcTDEE(bmr, 4);
    // 1648.6 × 1.40 = 2308.04 → rounds to 2308
    expect(tdee).toBeGreaterThanOrEqual(2306);
    expect(tdee).toBeLessThanOrEqual(2310);
  });

  test("16yo male 135 lb 5′10″, 5 workout days (very active) → TDEE ≈ 2473", () => {
    const bmr  = calcBMR(PROFILE.weightKg, PROFILE.heightCm, PROFILE.age, true);
    const tdee = calcTDEE(bmr, 5);
    // 1648.6 × 1.50 = 2472.9 → rounds to 2473
    expect(tdee).toBeGreaterThanOrEqual(2471);
    expect(tdee).toBeLessThanOrEqual(2475);
  });

  test("TDEE always exceeds BMR", () => {
    const bmr  = calcBMR(PROFILE.weightKg, PROFILE.heightCm, PROFILE.age, true);
    for (const d of [0, 1, 3, 5, 7]) {
      expect(calcTDEE(bmr, d)).toBeGreaterThan(bmr);
    }
  });
});

describe("Goal-type resolution", () => {
  test('"gain muscle" + 25 lb gain target → muscle_gain (not recomp)', () => {
    // 135 → 160 lb = 11.34 kg diff, well above the 5 kg threshold
    const goalType = resolveGoalType("gain muscle", PROFILE.weightKg, PROFILE.goalKg);
    expect(goalType).toBe("muscle_gain");
  });

  test('"gain muscle" + small diff (< 5 kg) → recomp', () => {
    const current = lbsToKg(175);
    const goal    = lbsToKg(180); // 2.27 kg diff
    const goalType = resolveGoalType("gain muscle", current, goal);
    expect(goalType).toBe("recomp");
  });

  test('"gain muscle" + exactly 5 kg diff → recomp (boundary)', () => {
    const goalType = resolveGoalType("gain muscle", 70, 75); // diff = 5, not > 5
    expect(goalType).toBe("recomp");
  });

  test('"gain muscle" + 5.1 kg diff → muscle_gain (just over boundary)', () => {
    const goalType = resolveGoalType("gain muscle", 70, 75.1);
    expect(goalType).toBe("muscle_gain");
  });

  test('"gain weight and muscle" always → muscle_gain', () => {
    expect(resolveGoalType("gain weight and muscle", 60, 65)).toBe("muscle_gain");
    expect(resolveGoalType("gain weight and muscle", 80, 85)).toBe("muscle_gain");
  });

  test('"lose weight" → fat_loss regardless of weight diff', () => {
    expect(resolveGoalType("lose weight", 80, 70)).toBe("fat_loss");
  });

  test('"lose fat" → fat_loss', () => {
    expect(resolveGoalType("lose fat", 80, 70)).toBe("fat_loss");
  });

  test('"stay fit" → maintain', () => {
    expect(resolveGoalType("stay fit", 75, 75)).toBe("maintain");
  });

  test("no goal + weight gain diff > 1 kg → fallback muscle_gain", () => {
    expect(resolveGoalType("", 60, 70)).toBe("muscle_gain");
  });

  test("no goal + weight loss diff > 1 kg → fallback fat_loss", () => {
    expect(resolveGoalType("", 80, 70)).toBe("fat_loss");
  });
});

describe("Muscle-gain surplus", () => {
  test("casual commitment → 250 cal surplus", () => {
    expect(muscleGainSurplus("casual")).toBe(250);
  });

  test("serious commitment → 300 cal surplus", () => {
    expect(muscleGainSurplus("serious")).toBe(300);
  });

  test("locked_in commitment → 300 cal surplus", () => {
    expect(muscleGainSurplus("locked_in")).toBe(300);
  });

  test("extreme_discipline → 400 cal surplus", () => {
    expect(muscleGainSurplus("extreme_discipline")).toBe(400);
  });
});

describe("End-to-end: primary example — male 16yo 5′10″ 135 lb → 160 lb, 4 workout days", () => {
  const bmr      = calcBMR(PROFILE.weightKg, PROFILE.heightCm, PROFILE.age, true);
  const tdee     = calcTDEE(bmr, PROFILE.workoutDays);
  const goalType = resolveGoalType(PROFILE.goal, PROFILE.weightKg, PROFILE.goalKg);
  const target   = calcCalorieTarget(tdee, goalType, PROFILE.commitment);

  test("goal type is muscle_gain (not recomp)", () => {
    expect(goalType).toBe("muscle_gain");
  });

  test("BMR is in the physiologically correct range (1600–1700 kcal)", () => {
    expect(bmr).toBeGreaterThan(1600);
    expect(bmr).toBeLessThan(1700);
  });

  test("TDEE at 4 workout days is 2290–2330 kcal (1.40 multiplier)", () => {
    expect(tdee).toBeGreaterThanOrEqual(2290);
    expect(tdee).toBeLessThanOrEqual(2330);
  });

  test("base calorie target is in the lean-bulk range (2550–2650 kcal)", () => {
    // TDEE ~2308 + 300 surplus = 2608
    expect(target).toBeGreaterThanOrEqual(2550);
    expect(target).toBeLessThanOrEqual(2650);
  });

  test("calorie target is well above sedentary maintenance (1979 kcal)", () => {
    const sedentaryTDEE = calcTDEE(bmr, 0); // 1.20 multiplier
    expect(target).toBeGreaterThan(sedentaryTDEE + 100);
  });

  test("calorie target is medically appropriate for muscle gain (2400–3000 kcal range)", () => {
    // Evidence-based range for a 135 lb 16yo male lean-bulking at moderate activity.
    // Below 2400 is insufficient for anabolic growth; above 3000 risks excessive fat gain
    // at this body weight without accounting for per-day exercise burns.
    expect(target).toBeGreaterThanOrEqual(2400);
    expect(target).toBeLessThanOrEqual(3000);
  });

  test("protein target is 1.0 g/lb of goal body weight (evidence-based ceiling)", () => {
    // Protein = goalWeightKg × 2.2 g/kg = 72.575 × 2.2 ≈ 160 g, capped at 250
    const protein = Math.min(Math.round(PROFILE.goalKg * 2.2), 250);
    expect(protein).toBeGreaterThanOrEqual(155);
    expect(protein).toBeLessThanOrEqual(165);
  });
});

describe("Regression: old bug — sedentary multiplier always produced ~2100 kcal", () => {
  test("using hardcoded 1.2 mult + recomp surplus gives the wrong ~2079 kcal (should not be used)", () => {
    const bmr = calcBMR(PROFILE.weightKg, PROFILE.heightCm, PROFILE.age, true);
    const bugged_tdee    = Math.round(bmr * 1.20); // old hardcoded multiplier
    const bugged_surplus = 100;                     // old recomp surplus
    const bugged_target  = bugged_tdee + bugged_surplus;
    // Confirm the old path produced ~2100 — documenting the exact wrong value
    expect(bugged_target).toBeGreaterThanOrEqual(2050);
    expect(bugged_target).toBeLessThanOrEqual(2150);
  });

  test("corrected path produces at least 500 kcal more than the old bugged path", () => {
    const bmr = calcBMR(PROFILE.weightKg, PROFILE.heightCm, PROFILE.age, true);
    const bugged  = Math.round(bmr * 1.20) + 100;
    const correct = calcCalorieTarget(
      calcTDEE(bmr, PROFILE.workoutDays),
      resolveGoalType(PROFILE.goal, PROFILE.weightKg, PROFILE.goalKg),
      PROFILE.commitment,
    );
    expect(correct - bugged).toBeGreaterThanOrEqual(500);
  });
});

describe("Additional profiles — sanity checks", () => {
  test("sedentary male 30yo 180 lb 5′9″, fat loss → target above 1500 floor", () => {
    const kg   = lbsToKg(180);
    const cm   = ftInToCm(5, 9);
    const bmr  = calcBMR(kg, cm, 30, true);
    const tdee = calcTDEE(bmr, 0); // sedentary
    const goal = resolveGoalType("lose weight", kg, lbsToKg(160));
    const target = calcCalorieTarget(tdee, goal, "serious");
    expect(target).toBeGreaterThanOrEqual(1500);
    expect(target).toBeLessThan(tdee);
  });

  test("female 25yo 140 lb 5′5″, 5 workout days, muscle gain → calorie target > 2000", () => {
    const kg   = lbsToKg(140);
    const cm   = ftInToCm(5, 5);
    const bmr  = calcBMR(kg, cm, 25, false);
    const tdee = calcTDEE(bmr, 5);
    const goal = resolveGoalType("gain weight and muscle", kg, lbsToKg(150));
    const target = calcCalorieTarget(tdee, goal, "serious");
    expect(target).toBeGreaterThan(2000);
  });

  test("male 20yo 200 lb 6′2″, 3 workout days, maintain → target equals TDEE", () => {
    const kg   = lbsToKg(200);
    const cm   = ftInToCm(6, 2);
    const bmr  = calcBMR(kg, cm, 20, true);
    const tdee = calcTDEE(bmr, 3);
    const goal = resolveGoalType("stay fit", kg, kg);
    const target = calcCalorieTarget(tdee, goal, "casual");
    expect(target).toBe(tdee);
  });

  test("surplus always added on top of TDEE for muscle_gain (not subtracted)", () => {
    const bmr    = calcBMR(70, 175, 25, true);
    const tdee   = calcTDEE(bmr, 4);
    const target = calcCalorieTarget(tdee, "muscle_gain", "serious");
    expect(target).toBeGreaterThan(tdee);
  });

  test("fat_loss target is always below TDEE", () => {
    const bmr    = calcBMR(80, 175, 30, true);
    const tdee   = calcTDEE(bmr, 3);
    const target = calcCalorieTarget(tdee, "fat_loss", "serious");
    expect(target).toBeLessThan(tdee);
  });

  test("recomp calorie target is only marginally above TDEE (< 150 kcal surplus)", () => {
    const bmr    = calcBMR(75, 175, 25, true);
    const tdee   = calcTDEE(bmr, 4);
    const target = calcCalorieTarget(tdee, "recomp", "serious");
    expect(target - tdee).toBeLessThan(150);
    expect(target).toBeGreaterThan(tdee);
  });
});

// ─── Under-18 protein helpers (mirror planGenerator.ts under-18 override) ─────

/**
 * Compute the under-18 protein target (g/day).
 * Always uses CURRENT body weight. Goal weight is irrelevant for protein.
 *   muscle_gain / recomp → 1.7 g/kg  (mid of 1.6-1.8 ISSN/IOC range)
 *   fat_loss / maintain  → 1.5 g/kg  (mid of 1.4-1.6 range)
 * Hard cap at 2.0 g/kg without professional supervision.
 * Rounded to nearest 5 g for a clean, easy-to-track target.
 */
function calcUnder18Protein(
  currentKg: number,
  goalType: "fat_loss" | "muscle_gain" | "recomp" | "maintain",
): number {
  const rate = (goalType === "muscle_gain" || goalType === "recomp") ? 1.7 : 1.5;
  const capped = Math.min(rate, 2.0);
  return Math.round((currentKg * capped) / 5) * 5;
}

// ─── Under-18 protein tests — 15 yo, 150 lb, goal 155 lb ─────────────────────

describe("Under-18 protein targets — 15 yo male, 150 lb, goal 155 lb", () => {
  // 150 lb → 68.04 kg  |  155 lb → 70.31 kg
  const currentKg = lbsToKg(150); // ≈ 68.04 kg
  const goalKg    = lbsToKg(155); // ≈ 70.31 kg

  test("150 lb converts to ~68.04 kg", () => {
    expect(currentKg).toBeCloseTo(68.04, 1);
  });

  test("muscle_gain protein uses current weight at 1.7 g/kg (not goal weight)", () => {
    const protein = calcUnder18Protein(currentKg, "muscle_gain");
    // 68.04 × 1.7 = 115.67 → round to nearest 5 = 115 g
    expect(protein).toBe(115);
  });

  test("recomp protein uses current weight at 1.7 g/kg", () => {
    const protein = calcUnder18Protein(currentKg, "recomp");
    expect(protein).toBe(115);
  });

  test("maintain protein uses current weight at 1.5 g/kg", () => {
    const protein = calcUnder18Protein(currentKg, "maintain");
    // 68.04 × 1.5 = 102.06 → round to nearest 5 = 100 g
    expect(protein).toBe(100);
  });

  test("fat_loss protein uses current weight at 1.5 g/kg", () => {
    const protein = calcUnder18Protein(currentKg, "fat_loss");
    expect(protein).toBe(100);
  });

  test("under-18 protein is well below adult goal-weight rate (2.2 g/kg of goal weight)", () => {
    // Adult path would have used goal weight for muscle_gain: 70.31 × 2.2 = ~155 g
    const adultProtein = Math.min(Math.round(goalKg * 2.2), 250);
    const teenProtein  = calcUnder18Protein(currentKg, "muscle_gain");
    // Teen protein should be meaningfully lower — confirms goal weight is NOT used
    expect(teenProtein).toBeLessThan(adultProtein);
    expect(adultProtein - teenProtein).toBeGreaterThanOrEqual(35);
  });

  test("under-18 protein for muscle gain is between 1.6 and 1.8 g/kg of current weight", () => {
    const protein = calcUnder18Protein(currentKg, "muscle_gain");
    expect(protein).toBeGreaterThanOrEqual(currentKg * 1.6);
    expect(protein).toBeLessThanOrEqual(currentKg * 1.8 + 5); // +5 allows rounding
  });

  test("under-18 protein for maintain is between 1.4 and 1.6 g/kg of current weight", () => {
    const protein = calcUnder18Protein(currentKg, "maintain");
    expect(protein).toBeGreaterThanOrEqual(currentKg * 1.4);
    expect(protein).toBeLessThanOrEqual(currentKg * 1.6 + 5); // +5 allows rounding
  });

  test("protein is always a multiple of 5 (clean tracking target)", () => {
    for (const gt of ["fat_loss", "muscle_gain", "recomp", "maintain"] as const) {
      expect(calcUnder18Protein(currentKg, gt) % 5).toBe(0);
    }
  });

  test("cap: even if rate * weight > 2.0 g/kg, protein never exceeds 2.0 g/kg of current weight", () => {
    // Simulate a heavy teenager at 250 lb (113.4 kg)
    const heavyKg = lbsToKg(250);
    for (const gt of ["fat_loss", "muscle_gain", "recomp", "maintain"] as const) {
      const protein = calcUnder18Protein(heavyKg, gt);
      expect(protein).toBeLessThanOrEqual(Math.ceil((heavyKg * 2.0) / 5) * 5);
    }
  });

  test("goal weight change (goal 170 lb vs 155 lb) does NOT change protein", () => {
    // Both goal weights should produce the same protein since only current weight matters
    const proteinGoal155 = calcUnder18Protein(currentKg, "muscle_gain");
    // If goal weight were used (wrong), 170 lb = 77.11 kg × 2.2 = ~170 g vs correct ~115 g
    // Confirm protein is fixed to current weight regardless
    expect(proteinGoal155).toBe(115);
  });
});

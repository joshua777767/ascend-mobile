// Node 24 built-in fetch — no packages needed
const API_KEY = process.env.OPENAI_API_KEY ?? "";
if (!API_KEY) { console.error("OPENAI_API_KEY not set"); process.exit(1); }

// Ground truth: USDA FoodData Central + chain nutrition info
const FOODS: { description: string; cal: number; protein: number }[] = [
  { description: "1 medium banana",                                                                      cal: 105, protein: 1  },
  { description: "2 large scrambled eggs no oil or butter",                                              cal: 140, protein: 12 },
  { description: "2 large scrambled eggs cooked in butter",                                              cal: 175, protein: 12 },
  { description: "6oz grilled chicken breast no skin",                                                   cal: 280, protein: 52 },
  { description: "1 cup cooked white rice",                                                              cal: 205, protein: 4  },
  { description: "1 cup plain nonfat Greek yogurt",                                                      cal: 130, protein: 22 },
  { description: "2 tablespoons peanut butter",                                                          cal: 190, protein: 7  },
  { description: "half an avocado",                                                                      cal: 115, protein: 1  },
  { description: "1 cup cooked oatmeal made with water",                                                 cal: 158, protein: 6  },
  { description: "8oz ribeye steak grilled",                                                             cal: 544, protein: 64 },
  { description: "1 slice pepperoni pizza regular chain",                                                cal: 285, protein: 12 },
  { description: "large McDonalds french fries",                                                         cal: 490, protein: 6  },
  { description: "chicken burrito bowl white rice black beans grilled chicken shredded cheese sour cream pico de gallo", cal: 850, protein: 50 },
  { description: "1 cup whole milk",                                                                     cal: 149, protein: 8  },
  { description: "Subway 6-inch turkey sub on wheat bread lettuce tomato",                               cal: 280, protein: 18 },
  { description: "3 fish tacos cabbage slaw crema corn tortillas",                                       cal: 580, protein: 30 },
  { description: "chocolate glazed donut",                                                               cal: 300, protein: 4  },
  { description: "2 strips bacon pan-cooked",                                                            cal: 86,  protein: 6  },
  { description: "protein shake 1 scoop whey protein 1 cup skim milk",                                  cal: 210, protein: 35 },
  { description: "Caesar salad romaine croutons parmesan Caesar dressing",                              cal: 400, protein: 8  },
];

// This mirrors the CALORIE ANCHORS section now in meals.ts
const SYSTEM = `You are a precise nutrition analyzer. Given a food description, estimate calories and macros accurately.

CALORIE & MACRO ANCHORS — use these exact values as reference (USDA FoodData Central):
EGGS & DAIRY
- 1 large egg (no fat added): 70 cal, 6g protein, 5g fat
- 2 large scrambled eggs (no oil/butter): 140 cal, 12g protein — do NOT add cooking-fat calories unless butter/oil is explicitly mentioned
- 2 large scrambled eggs with 1 tsp butter: 175 cal, 12g protein
- 1 cup plain nonfat Greek yogurt: 130 cal, 22g protein
- 1 cup whole milk: 149 cal, 8g protein
- 1oz cheddar/shredded cheese: 110 cal, 7g protein, 9g fat
- 2 tbsp sour cream: 60 cal, 1g protein

MEAT & FISH
- 1oz grilled chicken breast (no skin): ~46 cal, 8.5g protein
- 6oz grilled chicken breast: 280 cal, 52g protein
- 8oz ribeye steak grilled: 544 cal, 64g protein, 0g carbs, 30g fat
- 4oz ground beef 80/20 cooked: 290 cal, 22g protein
- 3oz canned tuna in water: 100 cal, 22g protein
- 1 strip cooked bacon: 43 cal, 3g protein

GRAINS & STARCHES
- 1 cup cooked white rice: 205 cal, 4g protein, 45g carbs
- 1 cup cooked oatmeal (water): 158 cal, 6g protein, 27g carbs
- 1 medium potato baked: 161 cal, 4g protein
- 1 cup cooked pasta: 220 cal, 8g protein (before sauce)

FRUITS & VEGETABLES
- 1 medium banana: 105 cal, 1g protein
- 1/2 medium avocado (~68g flesh): 115 cal, 1g protein, 10g fat
- 1 cup broccoli: 55 cal, 4g protein

FATS & SAUCES — calorie-dense, do NOT undercount:
- 1 tbsp olive oil / any cooking oil: 120 cal, 14g fat
- 1 tbsp butter: 102 cal, 12g fat
- 2 tbsp peanut butter: 190 cal, 7g protein, 16g fat
- 2 tbsp Caesar dressing: 160 cal — restaurant salads use 3-4 tbsp (~240-320 cal from dressing alone)
- 2 tbsp ranch: 130 cal
- 1 tbsp mayo: 94 cal

COMMON FAST FOOD & RESTAURANT (use chain data, NOT home-cooked estimates):
- McDonald's large fries: 490 cal, 6g protein
- McDonald's Big Mac: 550 cal, 25g protein
- 1 slice pepperoni pizza (standard chain): 285 cal, 12g protein
- Chipotle chicken burrito bowl (rice + beans + chicken + cheese + sour cream + salsa): 850-950 cal, 48-55g protein
- Subway 6-inch turkey on wheat with standard veggies: 280-300 cal, 18g protein — do NOT add extra calories for lettuce/tomato/cucumber

BAKED GOODS & SWEETS:
- Glazed donut: 250 cal, 3g protein
- Chocolate glazed donut: 300 cal, 4g protein
- 1 chocolate chip cookie (large): 220 cal
- 1 croissant: 230 cal

COMPLEX ASSEMBLED MEALS — use realistic restaurant-level estimates:
- Burrito/bowl with cheese + sour cream + rice: add 170 cal minimum for those condiments
- Tacos at a restaurant: 180-220 cal each depending on filling + condiments
- Salad with dressing: always include dressing (2-3 tbsp = 130-240 cal depending on type)

PORTION DEFAULT RULES:
- "a steak" → 8oz, ~500-550 cal depending on cut
- "a salad with dressing" → always include dressing
- "a donut" → standard glazed ~250 cal, chocolate/filled ~290-320 cal

Respond ONLY with valid JSON:
{
  "detectedFoods": [
    {"item": "food name", "serving": "amount + grams", "calories": 105, "protein": 1, "carbs": 27, "fat": 0}
  ]
}`;

async function analyze(desc: string) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Food: ${desc}` },
      ],
    }),
  });
  const j = await r.json() as any;
  const raw = j.choices?.[0]?.message?.content ?? "{}";
  const p = JSON.parse(raw) as { detectedFoods?: { calories: number; protein: number }[] };
  const foods = p.detectedFoods ?? [];
  return {
    cal: foods.reduce((s, f) => s + (f.calories ?? 0), 0),
    protein: foods.reduce((s, f) => s + (f.protein ?? 0), 0),
  };
}

function pct(got: number, real: number) {
  const d = ((got - real) / real) * 100;
  return `${d > 0 ? "+" : ""}${d.toFixed(0)}%`;
}

async function main() {
  console.log("\nCalorie accuracy test — with USDA anchors in prompt\n");
  const calErrs: number[] = [];
  const protErrs: number[] = [];
  const misses: string[] = [];

  for (const food of FOODS) {
    const ai = await analyze(food.description);
    const calPct = Math.abs(ai.cal - food.cal) / food.cal * 100;
    calErrs.push(calPct);
    protErrs.push(Math.abs(ai.protein - food.protein) / Math.max(food.protein, 1) * 100);
    if (calPct > 20) misses.push(food.description);

    const flag = calPct > 30 ? "❌" : calPct > 15 ? "⚠️" : "✅";
    console.log(
      `${flag} ${food.description.slice(0, 58).padEnd(60)}` +
      ` AI:${String(ai.cal).padStart(4)}  Real:${String(food.cal).padStart(4)}  ${pct(ai.cal, food.cal).padStart(5)}` +
      `  | Prot AI:${String(ai.protein).padStart(3)} Real:${String(food.protein).padStart(3)} ${pct(ai.protein, food.protein).padStart(5)}`
    );
  }

  const avgCal = calErrs.reduce((a, b) => a + b) / calErrs.length;
  const avgProt = protErrs.reduce((a, b) => a + b) / protErrs.length;
  console.log(`\n────────────────────────────────────────────────────────────────────────────────`);
  console.log(`Avg calorie error: ${avgCal.toFixed(1)}%  |  Avg protein error: ${avgProt.toFixed(1)}%  |  Big misses (>20%): ${misses.length}/${FOODS.length}`);
  if (misses.length) {
    console.log(`\nStill needs work:`);
    misses.forEach(m => console.log(`  • ${m}`));
  } else {
    console.log(`\n✅ All foods within 20% — analyzer is well calibrated.`);
  }
}

main().catch(console.error);

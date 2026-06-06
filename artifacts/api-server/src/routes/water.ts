import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, waterLogsTable, plansTable } from "@workspace/db";
import { LogWaterBody } from "@workspace/api-zod";
import { openai } from "../lib/openai";
import { logger } from "../lib/logger";
import { getUserId } from "../middlewares/auth";

const router: IRouter = Router();

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getWaterSummary(
  userId: number,
  detectedOz?: number,
): Promise<{ totalOz: number; targetOz: number; date: string; detectedOz?: number }> {
  const date = todayString();
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, userId));
  const targetOz = plan ? Math.round(plan.waterTargetL * 33.814) : 64;

  const rows = await db
    .select({ amountOz: waterLogsTable.amountOz })
    .from(waterLogsTable)
    .where(and(eq(waterLogsTable.userId, userId), eq(waterLogsTable.date, date)));

  const totalOz = rows.reduce((s, r) => s + r.amountOz, 0);
  return detectedOz !== undefined
    ? { totalOz, targetOz, date, detectedOz }
    : { totalOz, targetOz, date };
}

// Common container sizes as fallback when AI can't identify the vessel
const CONTAINER_DEFAULTS: Record<string, number> = {
  "small glass": 8,
  "glass": 12,
  "large glass": 16,
  "mug": 12,
  "large mug": 16,
  "water bottle": 24,
  "large bottle": 32,
  "sports bottle": 24,
  "cup": 8,
  "tall glass": 16,
};

function heuristicWaterOz(): number {
  // Default to 12 oz (a standard glass) when AI is unavailable
  return 12;
}

async function estimateWaterOzFromPhoto(imageUrl: string): Promise<{ oz: number; lowConfidence: boolean }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 120,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a water intake estimator. The user has taken a photo of a water or drink container.
Your job: estimate how many fluid ounces of liquid are in the container.

Rules:
- Focus on the liquid level relative to the container size.
- Common references: small glass = 8 oz, standard glass = 12 oz, large glass = 16 oz, mug = 12 oz, standard water bottle = 16-24 oz, large Nalgene = 32 oz, tumbler/dark cup = 16-24 oz.
- Dark, opaque, or metal containers (black cup, Yeti, Stanley): estimate based on container shape and fill level.
- If no container or liquid is visible, set confident to false.
- Round to the nearest 2 oz.

Respond with ONLY valid JSON: {"oz": <number>, "confident": true|false, "description": "<1-sentence description>"}`,
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const oz = typeof parsed.oz === "number" ? Math.round(parsed.oz) : null;
    const confident = parsed.confident !== false; // default true unless AI says false
    if (oz && oz >= 1 && oz <= 500) {
      logger.info({ oz, confident, description: parsed.description }, "AI water photo estimate");
      return { oz, lowConfidence: !confident };
    }
    return { oz: heuristicWaterOz(), lowConfidence: true };
  } catch (err) {
    logger.warn({ err }, "AI water photo estimate failed, using heuristic");
    return { oz: heuristicWaterOz(), lowConfidence: true };
  }
}

router.get("/water/today", async (req, res): Promise<void> => {
  try {
    const summary = await getWaterSummary(getUserId(req));
    res.json(summary);
  } catch (err) {
    logger.error({ err }, "Failed to get water summary");
    res.status(500).json({ error: "Failed to get water data." });
  }
});

router.post("/water", async (req, res): Promise<void> => {
  const parsed = LogWaterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { amountOz, imageUrl } = parsed.data;

  // Need at least one of: a manual amount or a photo
  if ((!amountOz || amountOz < 1) && !imageUrl) {
    res.status(400).json({ error: "Provide an amount or a photo." });
    return;
  }

  if (imageUrl && !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(imageUrl)) {
    res.status(400).json({ error: "Invalid image format." });
    return;
  }

  try {
    const userId = getUserId(req);
    let ozToLog: number;
    let detectedOz: number | undefined;

    if (imageUrl) {
      // Photo path: AI estimates the volume
      const estimate = await estimateWaterOzFromPhoto(imageUrl);
      if (estimate.lowConfidence) {
        // Can't confidently read the container — ask user to confirm amount
        res.status(200).json({ lowConfidence: true, suggestedOz: estimate.oz });
        return;
      }
      detectedOz = estimate.oz;
      ozToLog = estimate.oz;
    } else {
      ozToLog = amountOz!;
    }

    await db.insert(waterLogsTable).values({ userId, date: todayString(), amountOz: ozToLog });
    const summary = await getWaterSummary(userId, detectedOz);
    res.status(201).json(summary);
  } catch (err) {
    logger.error({ err }, "Failed to log water");
    res.status(500).json({ error: "Failed to log water." });
  }
});

export default router;

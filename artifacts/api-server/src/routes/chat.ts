import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, chatMessagesTable, userProfilesTable, plansTable } from "@workspace/db";
import { SendChatMessageBody } from "@workspace/api-zod";
import { openai } from "../lib/openai";
import { USER_ID } from "./users";

const router: IRouter = Router();

router.get("/chat/history", async (req, res): Promise<void> => {
  const messages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.userId, USER_ID))
    .orderBy(chatMessagesTable.createdAt);
  res.json(messages);
});

router.post("/chat", async (req, res): Promise<void> => {
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.id, USER_ID));
  const [plan] = await db.select().from(plansTable).where(eq(plansTable.userId, USER_ID));

  const recentMessages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.userId, USER_ID))
    .orderBy(desc(chatMessagesTable.createdAt));

  const profileSummary = profile
    ? `User: ${profile.name}, ${profile.age}yo, ${profile.gender}, ${Math.round(profile.currentWeightKg * 2.2046226)}lbs → ${Math.round(profile.goalWeightKg * 2.2046226)}lbs goal. Fitness: ${profile.fitnessLevel}. Gym: ${profile.gymAccess}. Always reference weight in pounds (lbs), never kilograms.`
    : "No profile yet.";

  const planSummary = plan
    ? `Goal type: ${plan.goalType}. Calories: ${plan.calorieTarget}/day. Protein: ${plan.proteinTargetG}g/day. Weekly pace: ${plan.weeklyPace}.`
    : "No plan yet.";

  const systemPrompt = `You are Project Upgrade — a strict, direct, and safe AI transformation coach. You are NOT a therapist, NOT a friend, NOT a hype machine. You give real, actionable answers based on the user's actual profile and goals.

${profileSummary}
${planSummary}

Rules:
- Be strict, direct, and safe. No medical advice. No diagnosing conditions.
- Short answers. 2-4 sentences max unless detail is genuinely needed.
- No fluff. No generic motivation. No "great question!"
- If asked about something dangerous (extreme fasting, steroids, etc.), decline and redirect.
- For minors, eating disorders, diabetes, pregnancy, or serious health conditions: recommend speaking with a professional.
- Always tie answers back to the user's actual goals.`;

  const conversationHistory = recentMessages.slice(0, 20).reverse().map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Save user message first
  await db.insert(chatMessagesTable).values({
    userId: USER_ID,
    role: "user",
    content: parsed.data.message,
  });

  let reply: string;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: parsed.data.message },
      ],
    });
    reply = response.choices[0]?.message?.content ?? "Keep working. Ask again.";
  } catch {
    reply = "Your coach is temporarily offline. Keep executing the basics: hit your protein, drink your water, train. Check back soon.";
  }

  // Save assistant reply
  await db.insert(chatMessagesTable).values({
    userId: USER_ID,
    role: "assistant",
    content: reply,
  });

  res.json({ reply, timestamp: new Date().toISOString() });
});

export default router;

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  plansTable,
  workoutsTable,
  mealsTable,
  journalEntriesTable,
  coachReviewsTable,
  weighInsTable,
  chatMessagesTable,
} from "@workspace/db";
import { CreateUserProfileBody, UpdateUserProfileBody } from "@workspace/api-zod";
import { getUserId } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/users/profile", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  const parsed = {
    ...profile,
    goals: JSON.parse(profile.goals || "[]"),
    skinConcerns: JSON.parse(profile.skinConcerns || "[]"),
    digestionConcerns: JSON.parse(profile.digestionConcerns || "[]"),
  };
  res.json(parsed);
});

router.post("/users/profile", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = CreateUserProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { goals, skinConcerns, digestionConcerns, ...rest } = parsed.data as any;

  const values = {
    ...rest,
    userId,
    goals: JSON.stringify(goals || []),
    skinConcerns: JSON.stringify(skinConcerns || []),
    digestionConcerns: JSON.stringify(digestionConcerns || []),
  };

  // Upsert by userId
  const existing = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  let profile;
  if (existing.length > 0) {
    [profile] = await db.update(userProfilesTable).set(values).where(eq(userProfilesTable.userId, userId)).returning();
  } else {
    [profile] = await db.insert(userProfilesTable).values(values).returning();
  }

  res.status(201).json({
    ...profile,
    goals: JSON.parse(profile.goals || "[]"),
    skinConcerns: JSON.parse(profile.skinConcerns || "[]"),
    digestionConcerns: JSON.parse(profile.digestionConcerns || "[]"),
  });
});

router.patch("/users/profile", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const parsed = UpdateUserProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db
    .update(userProfilesTable)
    .set(parsed.data as any)
    .where(eq(userProfilesTable.userId, userId))
    .returning();
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  res.json({
    ...profile,
    goals: JSON.parse(profile.goals || "[]"),
    skinConcerns: JSON.parse(profile.skinConcerns || "[]"),
    digestionConcerns: JSON.parse(profile.digestionConcerns || "[]"),
  });
});

// Reset my profile: wipe all of this user's data so they can re-onboard.
router.delete("/users/profile", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.userId, userId));
  await db.delete(weighInsTable).where(eq(weighInsTable.userId, userId));
  await db.delete(coachReviewsTable).where(eq(coachReviewsTable.userId, userId));
  await db.delete(journalEntriesTable).where(eq(journalEntriesTable.userId, userId));
  await db.delete(mealsTable).where(eq(mealsTable.userId, userId));
  await db.delete(workoutsTable).where(eq(workoutsTable.userId, userId));
  await db.delete(plansTable).where(eq(plansTable.userId, userId));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.userId, userId));
  res.status(204).end();
});

export default router;

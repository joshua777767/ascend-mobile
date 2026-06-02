import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";
import { CreateUserProfileBody, UpdateUserProfileBody } from "@workspace/api-zod";

const router: IRouter = Router();

// Default userId = 1 (single-user MVP)
const USER_ID = 1;

router.get("/users/profile", async (req, res): Promise<void> => {
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.id, USER_ID));
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
  const parsed = CreateUserProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { goals, skinConcerns, digestionConcerns, ...rest } = parsed.data as any;

  const values = {
    ...rest,
    id: USER_ID,
    goals: JSON.stringify(goals || []),
    skinConcerns: JSON.stringify(skinConcerns || []),
    digestionConcerns: JSON.stringify(digestionConcerns || []),
  };

  // Upsert
  const existing = await db.select().from(userProfilesTable).where(eq(userProfilesTable.id, USER_ID));
  let profile;
  if (existing.length > 0) {
    [profile] = await db.update(userProfilesTable).set(values).where(eq(userProfilesTable.id, USER_ID)).returning();
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
  const parsed = UpdateUserProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db.update(userProfilesTable).set(parsed.data as any).where(eq(userProfilesTable.id, USER_ID)).returning();
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

export default router;
export { USER_ID };

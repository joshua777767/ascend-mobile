import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { SignupBody, LoginBody } from "@workspace/api-zod";
import { hashPassword, verifyPassword } from "../lib/password";

const router: IRouter = Router();

function publicUser(user: { id: number; email: string }) {
  return { id: user.id, email: user.email };
}

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({ email, passwordHash }).returning();

  req.session.regenerate((err) => {
    if (err) {
      req.log.error({ err }, "Failed to regenerate session on signup");
      res.status(500).json({ error: "Failed to create session" });
      return;
    }
    req.session.userId = user.id;
    res.status(201).json(publicUser(user));
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  req.session.regenerate((err) => {
    if (err) {
      req.log.error({ err }, "Failed to regenerate session on login");
      res.status(500).json({ error: "Failed to create session" });
      return;
    }
    req.session.userId = user.id;
    res.json(publicUser(user));
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Failed to destroy session");
      res.status(500).json({ error: "Failed to log out" });
      return;
    }
    res.clearCookie("connect.sid");
    res.status(204).end();
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(publicUser(user));
});

export default router;

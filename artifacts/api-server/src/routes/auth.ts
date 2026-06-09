import { randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, usersTable, passwordResetTokensTable } from "@workspace/db";
import { SignupBody, LoginBody, ForgotPasswordBody, ResetPasswordBody } from "@workspace/api-zod";
import { hashPassword, verifyPassword } from "../lib/password";

const router: IRouter = Router();

const SAFE_RESET_MSG = "If an account exists with that email, a reset link has been sent.";

function publicUser(user: { id: number; email: string; freePro: boolean; freeProExpiresAt: Date | null }) {
  const isFreePro = user.freePro && (
    !user.freeProExpiresAt || user.freeProExpiresAt > new Date()
  );
  return { id: user.id, email: user.email, isFreePro: !!isFreePro };
}

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ reason: "validation_failed", issues: parsed.error.issues }, "signup blocked: invalid body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const rawEmail = parsed.data.email;
  const email = rawEmail.trim().toLowerCase();
  const { password } = parsed.data;

  // Mask email in logs: show first 2 chars + domain only (e.g. jo***@icloud.com)
  const [localPart, domain] = email.split("@");
  const maskedEmail = `${localPart.slice(0, 2)}***@${domain ?? "?"}`;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    const hasValidHash = typeof existing.passwordHash === "string" && existing.passwordHash.includes(":");
    req.log.warn(
      { reason: "email_exists", maskedEmail, userId: existing.id, hasValidHash },
      "signup blocked: email already registered"
    );
    res.status(409).json({
      error: "An account already exists with this email. Please log in or reset your password.",
    });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({ email, passwordHash }).returning();

  req.session.regenerate(async (err) => {
    if (err) {
      // Roll back the user row so the email is free to retry — a partial
      // record with no session is indistinguishable from a stuck account.
      req.log.error({ err, maskedEmail, userId: user.id }, "signup: session failed, rolling back user row");
      try { await db.delete(usersTable).where(eq(usersTable.id, user.id)); } catch {}
      res.status(500).json({ error: "Account creation failed. Please try again." });
      return;
    }
    req.session.userId = user.id;
    req.log.info({ maskedEmail, userId: user.id }, "signup success: new account created");
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

  const [localPart2, domain2] = email.split("@");
  const maskedEmail = `${localPart2.slice(0, 2)}***@${domain2 ?? "?"}`;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    req.log.warn({ reason: "no_account", maskedEmail }, "login failed: email not found");
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const passwordMatch = await verifyPassword(password, user.passwordHash);
  if (!passwordMatch) {
    req.log.warn({ reason: "wrong_password", maskedEmail, userId: user.id }, "login failed: password mismatch");
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

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user) {
    res.json({ message: SAFE_RESET_MSG });
    return;
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await db.insert(passwordResetTokensTable).values({ userId: user.id, token, expiresAt });

  const resetLink = `/reset-password?token=${token}`;
  req.log.info(
    { token, expiresAt },
    `[FORGOT PASSWORD] Reset link → ${resetLink}`
  );

  // TODO: Send email via Resend when RESEND_API_KEY is configured
  // For now, include the reset link in the response for development testing
  const resendConfigured = !!process.env.RESEND_API_KEY;
  res.json({
    message: SAFE_RESET_MSG,
    resetLink: resendConfigured ? undefined : resetLink,
    token: resendConfigured ? undefined : token,
    note: resendConfigured ? undefined : "Development mode: use this link to reset your password.",
  });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { token, password } = parsed.data;

  const [resetToken] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.token, token),
        gt(passwordResetTokensTable.expiresAt, new Date()),
        isNull(passwordResetTokensTable.usedAt)
      )
    );

  if (!resetToken) {
    res.status(400).json({ error: "This reset link is invalid or has expired." });
    return;
  }

  const passwordHash = await hashPassword(password);

  await Promise.all([
    db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, resetToken.userId)),
    db
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokensTable.id, resetToken.id)),
  ]);

  res.json({ message: "Password updated. You can now log in with your new password." });
});

export default router;

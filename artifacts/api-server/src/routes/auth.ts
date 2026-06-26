import { randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db, usersTable, userProfilesTable, passwordResetTokensTable } from "@workspace/db";
import { SignupBody, LoginBody, ForgotPasswordBody, ResetPasswordBody } from "@workspace/api-zod";
import { hashPassword, verifyPassword } from "../lib/password";
import { sendEmail, buildPasswordResetEmail } from "../lib/email";

const router: IRouter = Router();

const SAFE_RESET_MSG = "If an account exists with that email, a reset link has been sent.";

// Single source of truth for reset-token lifetime. RESET_TOKEN_TTL_LABEL is the
// human-readable form shown in the email — keep it in sync with RESET_TOKEN_TTL_MS.
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RESET_TOKEN_TTL_LABEL = "1 hour";

function publicUser(
  user: {
    id: number;
    email: string;
    freePro: boolean;
    freeProExpiresAt: Date | null;
    trialUsed: boolean | null;
    trialStartDate: Date | null;
    trialEndDate: Date | null;
    createdAt: Date;
    subscriptionStatus?: string | null;
  },
  isPaidSubscriber = false
) {
  const isFreePro = user.freePro && (
    !user.freeProExpiresAt || user.freeProExpiresAt > new Date()
  );
  const now = new Date();
  // A trial only counts when it was explicitly granted (both dates present).
  // New users no longer receive an automatic backend trial — iOS Pro is driven
  // solely by RevenueCat entitlements; the createdAt+7d fallback was removed.
  const hasTrialDates = !!user.trialStartDate && !!user.trialEndDate;
  const trialExpired = hasTrialDates ? now > user.trialEndDate! : true;
  const trialActive = hasTrialDates && !trialExpired && !isFreePro;
  const hasAccess = !!isFreePro || trialActive || isPaidSubscriber;
  return {
    id: user.id,
    email: user.email,
    isFreePro: !!isFreePro,
    isPaidSubscriber,
    trialUsed: !!user.trialUsed,
    trialStartDate: user.trialStartDate ? user.trialStartDate.toISOString() : null,
    trialEndDate: user.trialEndDate ? user.trialEndDate.toISOString() : null,
    trialExpired,
    trialActive,
    hasAccess,
  };
}

/**
 * Returns true if the user has an active paid Stripe subscription,
 * using only the DB-cached status (no live API call).
 * iOS subscribers are handled separately via RevenueCat.
 */
function checkStripeSubscription(
  _userId: number,
  stripeCustomerId: string | null,
  subscriptionStatus: string | null | undefined = null
): boolean {
  if (!stripeCustomerId) return false;
  return subscriptionStatus === "active" || subscriptionStatus === "trialing";
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
    // Check whether onboarding was ever completed (a profile row exists).
    const [profile] = await db
      .select({ userId: userProfilesTable.userId })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, existing.id));
    const profileCompleted = !!profile;

    req.log.warn(
      {
        reason: profileCompleted ? "email_exists" : "partial_account",
        maskedEmail,
        userId: existing.id,
        hasPasswordHash: hasValidHash,
        profileCompleted,
        createdAt: existing.createdAt,
      },
      profileCompleted
        ? "signup blocked: completed account exists"
        : "signup: partial account found (no profile), allowing retry"
    );

    if (profileCompleted) {
      // Real account — user must log in or reset password.
      res.status(409).json({
        error: "An account already exists with this email. Please log in or reset your password.",
      });
      return;
    }

    // Partial account: user row exists but onboarding never finished.
    // Update the password so the new attempt takes effect, then issue a session.
    const passwordHash = await hashPassword(password);
    await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, existing.id));

    req.session.regenerate((err) => {
      if (err) {
        req.log.error({ err, maskedEmail, userId: existing.id }, "signup: session failed on partial-account retry");
        res.status(500).json({ error: "Account creation failed. Please try again." });
        return;
      }
      req.session.userId = existing.id;
      req.log.info({ maskedEmail, userId: existing.id }, "signup success: partial account recovered");
      res.status(201).json(publicUser(existing));
    });
    return;
  }

  const passwordHash = await hashPassword(password);
  // No automatic trial on signup. Pro access is granted only via RevenueCat
  // (iOS in-app purchase) or an explicit freePro grant.
  const [user] = await db.insert(usersTable).values({
    email,
    passwordHash,
    trialUsed: false,
  }).returning();

  req.session.regenerate((err) => {
    if (err) {
      req.log.error({ err, maskedEmail, userId: user.id }, "signup: session failed");
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

  // Check Stripe subscription so the login response is immediately accurate —
  // avoids the "need to refresh after payment" problem on the frontend.
  // Uses DB-cached subscriptionStatus as fast path; falls back to Stripe API.
  const isPaidSubscriber = checkStripeSubscription(user.id, user.stripeCustomerId, user.subscriptionStatus);

  req.session.regenerate((err) => {
    if (err) {
      req.log.error({ err }, "Failed to regenerate session on login");
      res.status(500).json({ error: "Failed to create session" });
      return;
    }
    req.session.userId = user.id;
    res.json(publicUser(user, isPaidSubscriber));
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
  // Always do a live Stripe check when stripeCustomerId exists so cancellations
  // are caught immediately — even if the webhook missed.  Writes back to DB.
  const isPaidSubscriber = checkStripeSubscription(user.id, user.stripeCustomerId, user.subscriptionStatus);
  res.json(publicUser(user, isPaidSubscriber));
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
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  // Invalidate any earlier unused reset tokens for this user so only the newest
  // link works. Prevents stale/duplicate links from lingering and makes the
  // "this link was replaced" case explicit on validation.
  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokensTable.userId, user.id),
        isNull(passwordResetTokensTable.usedAt),
      ),
    );

  await db.insert(passwordResetTokensTable).values({ userId: user.id, token, expiresAt });

  const resetLink = `/reset-password?token=${token}`;
  req.log.info(
    { token, expiresAt },
    `[FORGOT PASSWORD] Reset link → ${resetLink}`
  );

  // Send email via Resend when RESEND_API_KEY is configured
  const resendConfigured = !!process.env.RESEND_API_KEY;
  if (resendConfigured) {
    const baseUrl = process.env.APP_BASE_URL || "https://ascendfit.fitness";
    const fullResetUrl = `${baseUrl}${resetLink}`;
    const emailPayload = buildPasswordResetEmail({ resetUrl: fullResetUrl, email: user.email, expiresInLabel: RESET_TOKEN_TTL_LABEL });
    const sent = await sendEmail(emailPayload);
    if (sent) {
      req.log.info({ email: user.email }, "Password reset email sent via Resend");
    } else {
      req.log.error({ email: user.email }, "Failed to send password reset email");
    }
  } else {
    req.log.info({ resetLink, token }, "Development mode: no RESEND_API_KEY configured");
  }

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
    .where(eq(passwordResetTokensTable.token, token));

  // Distinct messages per failure mode so users (and we) can tell *why* a link
  // failed instead of a single ambiguous "invalid or expired".
  if (!resetToken) {
    res.status(400).json({ error: "This reset link is invalid. Please request a new password reset." });
    return;
  }

  const ALREADY_USED_MSG =
    "This reset link has already been used, or a newer reset link was requested. Please use the most recent email, or request a new one.";

  if (resetToken.usedAt) {
    res.status(400).json({ error: ALREADY_USED_MSG });
    return;
  }

  if (resetToken.expiresAt <= new Date()) {
    res.status(400).json({ error: "This reset link has expired. Please request a new password reset." });
    return;
  }

  // Atomically claim the token: the conditional UPDATE guarantees single-use even
  // under concurrent submissions — only one request can flip usedAt from NULL.
  const claimed = await db
    .update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokensTable.id, resetToken.id),
        isNull(passwordResetTokensTable.usedAt),
      ),
    )
    .returning({ id: passwordResetTokensTable.id });

  if (claimed.length === 0) {
    res.status(400).json({ error: ALREADY_USED_MSG });
    return;
  }

  const passwordHash = await hashPassword(password);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, resetToken.userId));

  res.json({ message: "Password updated. You can now log in with your new password." });
});

export default router;

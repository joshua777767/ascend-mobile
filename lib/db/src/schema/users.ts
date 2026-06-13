import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  freePro: boolean("free_pro").notNull().default(false),
  freeProExpiresAt: timestamp("free_pro_expires_at", { withTimezone: true }),
  trialUsed: boolean("trial_used").notNull().default(true),
  trialStartDate: timestamp("trial_start_date", { withTimezone: true }),
  trialEndDate: timestamp("trial_end_date", { withTimezone: true }),
});

export type User = typeof usersTable.$inferSelect;

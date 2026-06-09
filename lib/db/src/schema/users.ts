import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  freePro: boolean("free_pro").notNull().default(false),
  freeProExpiresAt: timestamp("free_pro_expires_at", { withTimezone: true }),
});

export type User = typeof usersTable.$inferSelect;

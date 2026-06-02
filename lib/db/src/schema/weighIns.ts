import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const weighInsTable = pgTable("weigh_ins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  weightKg: real("weight_kg").notNull(),
  weekNumber: integer("week_number").notNull().default(1),
  adjustment: text("adjustment").notNull().default(""),
  coachMessage: text("coach_message").notNull().default(""),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWeighInSchema = createInsertSchema(weighInsTable).omit({ id: true });
export type InsertWeighIn = z.infer<typeof insertWeighInSchema>;
export type WeighIn = typeof weighInsTable.$inferSelect;

import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const coachReviewsTable = pgTable("coach_reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: text("date").notNull(),
  dailyScore: integer("daily_score").notNull().default(0),
  biggestWin: text("biggest_win").notNull().default(""),
  biggestMistake: text("biggest_mistake").notNull().default(""),
  whatSlowedProgress: text("what_slowed_progress").notNull().default(""),
  exactFixForTomorrow: text("exact_fix_for_tomorrow").notNull().default(""),
  onPace: boolean("on_pace").notNull().default(true),
  strictCoachMessage: text("strict_coach_message").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCoachReviewSchema = createInsertSchema(coachReviewsTable).omit({ id: true, createdAt: true });
export type InsertCoachReview = z.infer<typeof insertCoachReviewSchema>;
export type CoachReview = typeof coachReviewsTable.$inferSelect;

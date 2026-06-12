import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const weeklyReviewsTable = pgTable("weekly_reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  weekNumber: integer("week_number").notNull().default(1),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  weightChangeLbs: real("weight_change_lbs").notNull().default(0),
  calorieConsistency: integer("calorie_consistency").notNull().default(0),
  proteinConsistency: integer("protein_consistency").notNull().default(0),
  waterConsistency: integer("water_consistency").notNull().default(0),
  workoutConsistency: integer("workout_consistency").notNull().default(0),
  streakSummary: text("streak_summary").notNull().default(""),
  whatToImprove: text("what_to_improve").notNull().default(""),
  goalPace: text("goal_pace").notNull().default(""),
  estimatedGoalDate: text("estimated_goal_date"),
  status: text("status").notNull().default("on_track"), // ahead, on_track, behind
  coachMessage: text("coach_message").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWeeklyReviewSchema = createInsertSchema(weeklyReviewsTable).omit({ id: true, createdAt: true });
export type InsertWeeklyReview = z.infer<typeof insertWeeklyReviewSchema>;
export type WeeklyReview = typeof weeklyReviewsTable.$inferSelect;

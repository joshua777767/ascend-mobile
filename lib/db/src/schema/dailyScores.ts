import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const dailyScoresTable = pgTable("daily_scores", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: text("date").notNull(),
  totalScore: integer("total_score").notNull().default(0),
  caloriesScore: integer("calories_score").notNull().default(0),
  proteinScore: integer("protein_score").notNull().default(0),
  waterScore: integer("water_score").notNull().default(0),
  workoutScore: integer("workout_score").notNull().default(0),
  sleepScore: integer("sleep_score").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDailyScoreSchema = createInsertSchema(dailyScoresTable).omit({ id: true, createdAt: true });
export type InsertDailyScore = z.infer<typeof insertDailyScoreSchema>;
export type DailyScore = typeof dailyScoresTable.$inferSelect;

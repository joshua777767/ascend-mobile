import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  goalType: text("goal_type").notNull(),
  calorieTarget: integer("calorie_target").notNull(),
  proteinTargetG: integer("protein_target_g").notNull(),
  waterTargetL: real("water_target_l").notNull(),
  stepsTarget: integer("steps_target").notNull(),
  sleepTargetHours: real("sleep_target_hours").notNull(),
  weeklyPace: text("weekly_pace").notNull(),
  workoutSchedule: text("workout_schedule").notNull(),
  keyHabits: text("key_habits").notNull().default("[]"),
  coachNotes: text("coach_notes").notNull(),
  warnings: text("warnings"),
  restDayCalorieTarget: integer("rest_day_calorie_target"),
  gymDayCalorieTarget: integer("gym_day_calorie_target"),
  practiceDayCalorieTarget: integer("practice_day_calorie_target"),
  gameDayCalorieTarget: integer("game_day_calorie_target"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type Plan = typeof plansTable.$inferSelect;

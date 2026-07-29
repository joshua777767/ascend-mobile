import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  gender: text("gender").notNull(),
  heightCm: real("height_cm").notNull(),
  currentWeightKg: real("current_weight_kg").notNull(),
  goalWeightKg: real("goal_weight_kg").notNull(),
  bodyType: text("body_type").notNull(),
  goals: text("goals").notNull().default("[]"),
  targetDate: text("target_date"),
  fitnessLevel: text("fitness_level").notNull(),
  gymAccess: text("gym_access").notNull(),
  equipment: text("equipment"),
  workoutDaysPerWeek: integer("workout_days_per_week").notNull().default(3),
  // Overall self-reported lifestyle activity level (sedentary/light/moderate/high/extra_active).
  // When present, this already accounts for the user's usual training, so plan
  // generation uses it as the sole TDEE multiplier and does not add scheduled
  // workout/sport calories on top (see planGenerator.ts activityLevelSource).
  activityLevel: text("activity_level"),
  preferredWorkoutTime: text("preferred_workout_time"),
  wakeTime: text("wake_time").notNull(),
  sleepTime: text("sleep_time").notNull(),
  sleepQuality: integer("sleep_quality").notNull().default(5),
  energyLevel: integer("energy_level").notNull().default(5),
  stressLevel: integer("stress_level").notNull().default(5),
  workSchedule: text("work_schedule"),
  averageDailySteps: integer("average_daily_steps"),
  allergies: text("allergies"),
  dislikedFoods: text("disliked_foods"),
  dietStyle: text("diet_style"),
  foodBudget: text("food_budget"),
  mealsPerDay: integer("meals_per_day").notNull().default(3),
  waterIntakeLiters: real("water_intake_liters").notNull().default(2),
  caffeineUse: text("caffeine_use"),
  screenTimeBeforeBed: text("screen_time_before_bed"),
  skinConcerns: text("skin_concerns").notNull().default("[]"),
  digestionConcerns: text("digestion_concerns").notNull().default("[]"),
  biggestStruggle: text("biggest_struggle"),
  sport: text("sport"),
  sportCustom: text("sport_custom"),
  sportSchedule: text("sport_schedule"),
  hasOwnSchedule: text("has_own_schedule"),
  ownSchedule: text("own_schedule"),
  customWorkoutSchedule: text("custom_workout_schedule"),
  workoutFocus: text("workout_focus"),
  commitmentLevel: text("commitment_level"),
  wakeTimeRange: text("wake_time_range"),
  sleepTimeRange: text("sleep_time_range"),
  currentStreak: integer("current_streak").notNull().default(0),
  lastStreakDate: text("last_streak_date"),
  goalReachedAt: timestamp("goal_reached_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserProfileSchema = createInsertSchema(userProfilesTable).omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfilesTable.$inferSelect;

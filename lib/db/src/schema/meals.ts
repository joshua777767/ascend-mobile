import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mealsTable = pgTable("meals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  description: text("description").notNull().default(""),
  imageUrl: text("image_url"),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  coachFeedback: text("coach_feedback").notNull().default(""),
  score: integer("score").notNull().default(0),
  quality: text("quality").notNull().default("neutral"),
  whatWasGood: text("what_was_good"),
  whatWasBad: text("what_was_bad"),
  whatToFixNext: text("what_to_fix_next"),
  detectedFoodsJson: text("detected_foods_json"),
  calories: integer("calories"),
  protein: integer("protein"),
  carbs: integer("carbs"),
  fat: integer("fat"),
});

export const insertMealSchema = createInsertSchema(mealsTable).omit({ id: true });
export type InsertMeal = z.infer<typeof insertMealSchema>;
export type Meal = typeof mealsTable.$inferSelect;

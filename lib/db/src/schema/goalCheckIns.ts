import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const goalCheckInsTable = pgTable("goal_checkins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  goal: text("goal").notNull(),
  weekNumber: integer("week_number").notNull(),
  score: integer("score").notNull(),
  notes: text("notes"),
  coachFeedback: text("coach_feedback"),
  status: text("status").notNull().default("on_track"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GoalCheckIn = typeof goalCheckInsTable.$inferSelect;

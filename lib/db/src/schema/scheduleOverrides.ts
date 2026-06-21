import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const scheduleOverridesTable = pgTable("schedule_overrides", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  activity: text("activity").notNull(),
  type: text("type").notNull(),
  time: text("time").notNull(),
  status: text("status").notNull().default("active"), // active, skipped, completed
  notes: text("notes"),
  isCustom: boolean("is_custom").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

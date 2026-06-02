import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const journalEntriesTable = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: text("date").notNull(),
  followedSchedule: boolean("followed_schedule").notNull().default(false),
  hitProtein: boolean("hit_protein").notNull().default(false),
  stayedNearCalories: boolean("stayed_near_calories").notNull().default(false),
  workedOut: boolean("worked_out").notNull().default(false),
  drankWater: boolean("drank_water").notNull().default(false),
  sleptOnTime: boolean("slept_on_time").notNull().default(false),
  energyRating: integer("energy_rating").notNull().default(5),
  skinBloatingRating: integer("skin_bloating_rating").notNull().default(5),
  whatWentWrong: text("what_went_wrong"),
  biggestWin: text("biggest_win").notNull().default(""),
  needHelpWith: text("need_help_with"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({ id: true, createdAt: true });
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;

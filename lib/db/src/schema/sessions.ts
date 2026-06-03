import { pgTable, varchar, json, timestamp, index } from "drizzle-orm/pg-core";

// Matches the table schema expected by connect-pg-simple. Defined here so
// drizzle-kit push manages it and never drops it.
export const sessionsTable = pgTable(
  "session",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  userId: text("user_id").notNull(),
  bookId: text("book_id").notNull(),
  startedAt: text("started_at").notNull(),
  secondsRead: integer("seconds_read").notNull().default(0),
  segmentsCompleted: integer("segments_completed").notNull().default(0),
  comprehensionScore: integer("comprehension_score").notNull().default(0),
  xpEarned: integer("xp_earned").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ReadingSessionRecord = typeof sessionsTable.$inferSelect;
export type InsertSession = typeof sessionsTable.$inferInsert;

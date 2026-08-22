import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  name: text("name").notNull(),
  ageGroup: text("age_group").notNull().default("adult"),
  readingLevel: text("reading_level").notNull().default("intermediate"),
  interests: jsonb("interests").notNull().$type<string[]>().default([]),
  dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(15),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  streakCurrent: integer("streak_current").notNull().default(0),
  streakBest: integer("streak_best").notNull().default(0),
  lastReadDate: text("last_read_date"),
  badges: jsonb("badges").notNull().$type<string[]>().default([]),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  totalMinutesRead: integer("total_minutes_read").notNull().default(0),
  totalBooksFinished: integer("total_books_finished").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;

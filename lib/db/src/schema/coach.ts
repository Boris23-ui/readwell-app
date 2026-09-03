import { pgTable, text, integer, timestamp, jsonb, doublePrecision } from 'drizzle-orm/pg-core';

export const coachStrategiesTable = pgTable('coach_strategies', {
  userId: text('user_id').primaryKey(),
  version: integer('version').notNull().default(1),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  tone: text('tone').notNull().default('Encouraging, intellectual, Socratic'),
  difficultyLevel: doublePrecision('difficulty_level').notNull().default(0.5),
  preferredQuestionStyle: text('preferred_question_style').notNull().default('Open-ended Socratic with personal reflection'),
  effectiveTactics: jsonb('effective_tactics').notNull().$type<string[]>().default([]),
  ineffectiveTactics: jsonb('ineffective_tactics').notNull().$type<string[]>().default([]),
  sessionPace: text('session_pace').notNull().default('10-15 minute check-ins'),
  evolutionHistory: jsonb('evolution_history').notNull().$type<any[]>().default([]),
});

export const coachFlashcardsTable = pgTable('coach_flashcards', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  front: text('front').notNull(),
  back: text('back').notNull(),
  bookTitle: text('book_title').notNull().default('General'),
  chapter: integer('chapter').notNull().default(1),
  cardType: text('card_type').notNull().default('concept'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  nextReview: timestamp('next_review').defaultNow().notNull(),
  intervalDays: integer('interval_days').notNull().default(1),
  easeFactor: doublePrecision('ease_factor').notNull().default(2.5),
  repetitions: integer('repetitions').notNull().default(0),
});

export const coachConversationsTable = pgTable('coach_conversations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  strategyVersion: integer('strategy_version'),
  agentName: text('agent_name'),
  intent: text('intent'),
  bookContext: jsonb('book_context'),
});

export const coachPlansTable = pgTable('coach_plans', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  bookTitle: text('book_title').notNull(),
  totalChapters: integer('total_chapters').notNull(),
  targetDays: integer('target_days').notNull(),
  pace: jsonb('pace'),
  items: jsonb('items').notNull().$type<any[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type CoachStrategyRecord = typeof coachStrategiesTable.$inferSelect;
export type CoachFlashcardRecord = typeof coachFlashcardsTable.$inferSelect;
export type CoachConversationRecord = typeof coachConversationsTable.$inferSelect;
export type CoachPlanRecord = typeof coachPlansTable.$inferSelect;

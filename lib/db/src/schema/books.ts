import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const booksTable = pgTable("books", {
  id: serial("id").primaryKey(),
  bookId: text("book_id").notNull().unique(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  author: text("author").notNull().default("Unknown Author"),
  content: text("content").notNull().default(""),
  segments: jsonb("segments").notNull().$type<any[]>().default([]),
  status: text("status").notNull().default("in_progress"),
  wordCount: integer("word_count").notNull().default(0),
  currentSegmentIndex: integer("current_segment_index").notNull().default(0),
  coverColor: text("cover_color").notNull().default("#3b82f6"),
  sourceType: text("source_type").notNull().default("text"),
  pages: jsonb("pages").$type<any[]>(),
  ocrUsed: boolean("ocr_used"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type BookRecord = typeof booksTable.$inferSelect;
export type InsertBook = typeof booksTable.$inferInsert;

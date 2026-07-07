import { pgTable, serial, integer, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  thread: jsonb('thread').notNull().default([]),
  html: text('html').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

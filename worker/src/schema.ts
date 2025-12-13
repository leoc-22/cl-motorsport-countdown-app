import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
  sessionId: text('session_id').primaryKey(),
  label: text('label').notNull(),
  startTimeUtc: text('start_time_utc').notNull(),
  durationMs: integer('duration_ms').notNull(),
  metadata: text('metadata'), // JSON string
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  startTimeIdx: index('idx_sessions_start_time').on(table.startTimeUtc),
}));

export const events = sqliteTable('events', {
  eventId: text('event_id').primaryKey(),
  sessionId: text('session_id').notNull(),
  action: text('action').notNull(),
  payload: text('payload'), // JSON string
  occurredAt: text('occurred_at').notNull(),
}, (table) => ({
  sessionIdx: index('idx_events_session').on(table.sessionId),
}));

// Type inference for better TypeScript support
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

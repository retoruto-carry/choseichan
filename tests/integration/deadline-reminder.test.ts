/**
 * Deadline Reminder Integration Tests
 * 
 * 締切リマインダー機能の統合テスト
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DependencyContainer } from '../../src/infrastructure/factories/DependencyContainer';
import type { Env } from '../../src/infrastructure/types/discord';
import type { D1Database } from '../helpers/d1-database';
import {
  applyMigrations,
  closeTestDatabase,
  createTestD1Database,
  createTestEnv,
} from '../helpers/d1-database';

describe('Deadline Reminder Integration', () => {
  let container: DependencyContainer;
  let env: Env;
  let db: D1Database;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup D1 database
    db = createTestD1Database();
    await applyMigrations(db);

    // Create test environment
    env = createTestEnv(db);
    container = new DependencyContainer(env);

    // Mock fetch for Discord API calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: '123456' }),
      text: async () => 'OK',
    });
  });

  afterEach(async () => {
    await closeTestDatabase(db);
    vi.restoreAllMocks();
  });

  describe('Deadline Reminder Use Case Integration', () => {
    it('should check deadlines and identify schedules needing reminders', async () => {
      // 1. Create schedule with deadline approaching (within 8 hours)
      const createResult = await container.applicationServices.createScheduleUseCase.execute({
        guildId: 'guild-123',
        channelId: 'channel-123',
        authorId: 'user-123',
        authorUsername: 'testuser',
        title: 'Deadline Check Test',
        dates: [
          { id: 'date1', datetime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() },
        ],
        deadline: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(), // 7時間後
        reminderTimings: ['8h', '1h'], // 8時間前と1時間前
        reminderMentions: ['@here'],
      });

      expect(createResult.success).toBe(true);
      const scheduleId = createResult.schedule?.id || '';

      // 2. Add some responses
      await container.applicationServices.submitResponseUseCase.execute({
        scheduleId,
        guildId: 'guild-123',
        userId: 'user1',
        username: 'user1',
        responses: [{ dateId: 'date1', status: 'ok' }],
      });

      // 3. Check deadlines using the deadline reminder use case
      const deadlineResult = await container.applicationServices.deadlineReminderUseCase.checkDeadlines(
        'guild-123'
      );

      // 4. Verify deadline checking succeeded
      expect(deadlineResult.success).toBe(true);
      expect(deadlineResult.result).toBeDefined();
      expect(deadlineResult.result?.upcomingReminders).toHaveLength(1);
      expect(deadlineResult.result?.upcomingReminders[0].reminderType).toBe('8h');
      expect(deadlineResult.result?.upcomingReminders[0].scheduleId).toBe(scheduleId);

      // 5. Verify schedule information is included
      const reminder = deadlineResult.result?.upcomingReminders[0];
      expect(reminder?.scheduleId).toBe(scheduleId);
      expect(reminder?.reminderType).toBe('8h');
    });

    it('should identify schedules that need to be closed', async () => {
      // Create schedule with valid deadline first
      const createResult = await container.applicationServices.createScheduleUseCase.execute({
        guildId: 'guild-123',
        channelId: 'channel-123',
        authorId: 'user-123',
        authorUsername: 'testuser', 
        title: 'Soon to Close Test',
        dates: [
          { id: 'date1', datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
        ],
        deadline: new Date(Date.now() + 60 * 1000).toISOString(), // 1分後（近い将来）
      });

      expect(createResult.success).toBe(true);

      // Check deadlines - should not have closed schedules yet
      const deadlineResult = await container.applicationServices.deadlineReminderUseCase.checkDeadlines(
        'guild-123'
      );

      expect(deadlineResult.success).toBe(true);
      // Since the deadline is still in the future (1 minute), it shouldn't be in justClosed
      expect(deadlineResult.result?.justClosed).toHaveLength(0);
    });

    it('should handle multiple schedules with different deadline timings', async () => {
      // Create multiple schedules with different deadlines
      const schedules = [];
      
      for (let i = 0; i < 3; i++) {
        const createResult = await container.applicationServices.createScheduleUseCase.execute({
          guildId: 'guild-123',
          channelId: 'channel-123',
          authorId: 'user-123',
          authorUsername: 'testuser',
          title: `Multi Schedule Test ${i}`,
          dates: [
            { id: 'date1', datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
          ],
          deadline: new Date(Date.now() + (6 + i) * 60 * 60 * 1000).toISOString(), // 6-8時間後
          reminderTimings: ['8h'],
          reminderMentions: ['@here'],
        });
        
        expect(createResult.success).toBe(true);
        schedules.push(createResult.schedule?.id);
      }

      // Check deadlines
      const deadlineResult = await container.applicationServices.deadlineReminderUseCase.checkDeadlines(
        'guild-123'
      );

      expect(deadlineResult.success).toBe(true);
      expect(deadlineResult.result?.upcomingReminders.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty guild with no schedules', async () => {
      // Check deadlines when no schedules exist
      const deadlineResult = await container.applicationServices.deadlineReminderUseCase.checkDeadlines(
        'empty-guild-123'
      );

      expect(deadlineResult.success).toBe(true);
      expect(deadlineResult.result?.upcomingReminders).toHaveLength(0);
      expect(deadlineResult.result?.justClosed).toHaveLength(0);
    });
  });

  describe('Schedule State Integration', () => {
    it('should integrate deadline checking with schedule closure', async () => {
      // Create schedule with valid deadline
      const createResult = await container.applicationServices.createScheduleUseCase.execute({
        guildId: 'guild-123',
        channelId: 'channel-123',
        authorId: 'user-123',
        authorUsername: 'testuser',
        title: 'Manual Close Test',
        dates: [
          { id: 'date1', datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
        ],
        deadline: new Date(Date.now() + 60 * 1000).toISOString(), // 1分後
      });

      expect(createResult.success).toBe(true);
      const scheduleId = createResult.schedule?.id || '';

      // Add a response
      await container.applicationServices.submitResponseUseCase.execute({
        scheduleId,
        guildId: 'guild-123',
        userId: 'user1', 
        username: 'user1',
        responses: [{ dateId: 'date1', status: 'ok' }],
      });

      // Check initial deadline state
      const deadlineResult = await container.applicationServices.deadlineReminderUseCase.checkDeadlines(
        'guild-123'
      );

      expect(deadlineResult.success).toBe(true);

      // Manually close the schedule to test integration
      const closeResult = await container.applicationServices.closeScheduleUseCase.execute({
        scheduleId,
        guildId: 'guild-123',
        editorUserId: 'user-123',
      });

      expect(closeResult.success).toBe(true);

      // Verify schedule is closed
      const scheduleResult = await container.applicationServices.getScheduleUseCase.execute(
        scheduleId,
        'guild-123'
      );
      expect(scheduleResult.success).toBe(true);
      expect(scheduleResult.schedule?.status).toBe('closed');
    });
  });
});
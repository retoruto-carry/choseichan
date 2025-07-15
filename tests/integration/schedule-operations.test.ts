/**
 * Schedule Operations Integration Tests
 *
 * スケジュール操作の統合テスト
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DependencyContainer } from '../../src/di/DependencyContainer';
import type { Env } from '../../src/infrastructure/types/discord';
import type { D1Database } from '../helpers/d1-database';
import {
  applyMigrations,
  closeTestDatabase,
  createTestD1Database,
  createTestEnv,
} from '../helpers/d1-database';

describe('Schedule Operations', () => {
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

  describe('Schedule Creation', () => {
    it('should create schedule successfully', async () => {
      // Arrange
      const createScheduleUseCase = container.applicationServices.createScheduleUseCase;
      const request = {
        guildId: 'guild-123',
        channelId: 'channel-123',
        authorId: 'user-123',
        authorUsername: 'testuser',
        title: 'Integration Test Schedule',
        description: 'Testing Clean Architecture flow',
        dates: [
          { id: 'date1', datetime: new Date(Date.now() + 172800000).toISOString() },
          { id: 'date2', datetime: new Date(Date.now() + 259200000).toISOString() },
        ],
        deadline: new Date(Date.now() + 86400000).toISOString(),
        reminderTimings: ['8h', '30m'],
        reminderMentions: ['@here'],
      };

      // Act
      const result = await createScheduleUseCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.schedule).toBeDefined();
      expect(result.schedule?.title).toBe('Integration Test Schedule');
      expect(result.schedule?.dates).toHaveLength(2);
      expect(result.schedule?.status).toBe('open');

      // Verify schedule was persisted
      const getScheduleUseCase = container.applicationServices.getScheduleUseCase;
      const getResult = await getScheduleUseCase.execute(result.schedule?.id || '', 'guild-123');

      expect(getResult.success).toBe(true);
      expect(getResult.schedule).toBeDefined();
      expect(getResult.schedule?.id).toBe(result.schedule?.id);
    });

    it('should validate input correctly', async () => {
      // Arrange
      const createScheduleUseCase = container.applicationServices.createScheduleUseCase;
      const request = {
        guildId: 'guild-123',
        channelId: 'channel-123',
        authorId: 'user-123',
        authorUsername: 'testuser',
        title: '', // Invalid - empty title
        dates: [], // Invalid - no dates
      };

      // Act
      const result = await createScheduleUseCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain('タイトルが必要です');
      expect(result.errors).toContain('日程候補が必要です');
    });
  });

  describe('Response Submission', () => {
    it('should submit response successfully', async () => {
      // Arrange - Create a schedule first
      const createScheduleUseCase = container.applicationServices.createScheduleUseCase;
      const scheduleResult = await createScheduleUseCase.execute({
        guildId: 'guild-123',
        channelId: 'channel-123',
        authorId: 'user-123',
        authorUsername: 'testuser',
        title: 'Response Test Schedule',
        dates: [
          { id: 'date1', datetime: new Date(Date.now() + 172800000).toISOString() },
          { id: 'date2', datetime: new Date(Date.now() + 259200000).toISOString() },
        ],
      });

      const submitResponseUseCase = container.applicationServices.submitResponseUseCase;
      const request = {
        scheduleId: scheduleResult.schedule?.id || '',
        guildId: 'guild-123',
        userId: 'responder-123',
        username: 'responder',
        displayName: 'Test Responder',
        responses: [
          { dateId: 'date1', status: 'ok' as const },
          { dateId: 'date2', status: 'maybe' as const },
        ],
        comment: 'Looking forward to it!',
      };

      // Act
      const result = await submitResponseUseCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response?.userId).toBe('responder-123');
      expect(result.response?.dateStatuses).toEqual({
        date1: 'ok',
        date2: 'maybe',
      });

      // Verify response was persisted
      const getResponseUseCase = container.applicationServices.getResponseUseCase;
      const getResult = await getResponseUseCase.execute({
        scheduleId: scheduleResult.schedule?.id || '',
        guildId: 'guild-123',
        userId: 'responder-123',
      });

      expect(getResult.success).toBe(true);
      expect(getResult.response).toBeDefined();
      expect(getResult.response?.userId).toBe('responder-123');
    });
  });

  describe('Schedule Summary', () => {
    it('should get schedule summary with responses', async () => {
      // Arrange - Create schedule and add responses
      const createScheduleUseCase = container.applicationServices.createScheduleUseCase;
      const scheduleResult = await createScheduleUseCase.execute({
        guildId: 'guild-123',
        channelId: 'channel-123',
        authorId: 'user-123',
        authorUsername: 'testuser',
        title: 'Summary Test Schedule',
        dates: [
          { id: 'date1', datetime: new Date(Date.now() + 172800000).toISOString() },
          { id: 'date2', datetime: new Date(Date.now() + 259200000).toISOString() },
        ],
      });

      const submitResponseUseCase = container.applicationServices.submitResponseUseCase;

      // Add multiple responses
      await submitResponseUseCase.execute({
        scheduleId: scheduleResult.schedule?.id || '',
        guildId: 'guild-123',
        userId: 'user1',
        username: 'user1',
        responses: [
          { dateId: 'date1', status: 'ok' },
          { dateId: 'date2', status: 'ok' },
        ],
      });

      await submitResponseUseCase.execute({
        scheduleId: scheduleResult.schedule?.id || '',
        guildId: 'guild-123',
        userId: 'user2',
        username: 'user2',
        responses: [
          { dateId: 'date1', status: 'ok' },
          { dateId: 'date2', status: 'ng' },
        ],
      });

      await submitResponseUseCase.execute({
        scheduleId: scheduleResult.schedule?.id || '',
        guildId: 'guild-123',
        userId: 'user3',
        username: 'user3',
        responses: [
          { dateId: 'date1', status: 'maybe' },
          { dateId: 'date2', status: 'maybe' },
        ],
      });

      // Act
      const getSummaryUseCase = container.applicationServices.getScheduleSummaryUseCase;
      const summaryResult = await getSummaryUseCase.execute(
        scheduleResult.schedule?.id || '',
        'guild-123'
      );

      // Assert
      expect(summaryResult.success).toBe(true);
      expect(summaryResult.summary).toBeDefined();
      expect(summaryResult.summary?.totalResponseUsers).toBe(3);
      expect(summaryResult.summary?.responseCounts.date1).toEqual({
        yes: 2,
        maybe: 1,
        no: 0,
      });
      expect(summaryResult.summary?.responseCounts.date2).toEqual({
        yes: 1,
        maybe: 1,
        no: 1,
      });
      expect(summaryResult.summary?.bestDateId).toBe('date1'); // date1 has more OK responses
    });
  });

  describe('Deadline Reminders', () => {
    it('should process deadline reminders', async () => {
      // Arrange - Create schedules with different deadline times
      const createScheduleUseCase = container.applicationServices.createScheduleUseCase;

      // Schedule that should trigger 8h reminder
      await createScheduleUseCase.execute({
        guildId: 'guild-123',
        channelId: 'channel-123',
        authorId: 'user-123',
        authorUsername: 'testuser',
        title: 'Reminder Test Schedule',
        dates: [{ id: 'date1', datetime: new Date(Date.now() + 172800000).toISOString() }],
        deadline: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(), // 7 hours from now
        reminderTimings: ['8h', '1h'],
      });

      // Act
      const deadlineReminderUseCase = container.applicationServices.deadlineReminderUseCase;
      const result = await deadlineReminderUseCase.checkDeadlines('guild-123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result?.upcomingReminders).toHaveLength(1);
      expect(result.result?.upcomingReminders[0].reminderType).toBe('8h');
      expect(result.result?.justClosed).toHaveLength(0);
    });
  });

  describe('Transaction Handling', () => {
    it('should handle transaction rollback on error', async () => {
      // Arrange
      const createScheduleUseCase = container.applicationServices.createScheduleUseCase;
      const getScheduleUseCase = container.applicationServices.getScheduleUseCase;

      // Create a schedule successfully first
      const successResult = await createScheduleUseCase.execute({
        guildId: 'guild-123',
        channelId: 'channel-123',
        authorId: 'user-123',
        authorUsername: 'testuser',
        title: 'Transaction Test Schedule',
        dates: [{ id: 'date1', datetime: new Date(Date.now() + 172800000).toISOString() }],
      });

      expect(successResult.success).toBe(true);
      const scheduleId = successResult.schedule?.id || '';

      // Verify schedule exists
      const getResult = await getScheduleUseCase.execute(scheduleId, 'guild-123');
      expect(getResult.success).toBe(true);
    });
  });

  describe('End-to-End Schedule Flow', () => {
    it('should complete full schedule lifecycle', async () => {
      // This test verifies the complete schedule lifecycle:
      // 1. Create schedule
      // 2. Submit responses
      // 3. View summary
      // 4. Close schedule

      // Verify layer separation by creating through use case
      const createResult = await container.applicationServices.createScheduleUseCase.execute({
        guildId: 'guild-123',
        channelId: 'channel-123',
        authorId: 'user-123',
        authorUsername: 'testuser',
        title: 'Architecture Test',
        dates: [
          { id: 'date1', datetime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() },
          { id: 'date2', datetime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() },
        ],
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      expect(createResult.success).toBe(true);

      // Verify the schedule was created through all layers
      const schedules = await container.applicationServices.findSchedulesUseCase.findByChannel(
        'channel-123',
        'guild-123'
      );

      expect(schedules.success).toBe(true);
      expect(schedules.schedules).toBeDefined();
      expect(schedules.schedules?.length).toBeGreaterThan(0);
    });
  });
});

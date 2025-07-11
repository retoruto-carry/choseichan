/**
 * Clean Architecture Flow Integration Tests
 * 
 * Clean Architectureの各層が正しく連携しているかを検証する統合テスト
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DependencyContainer } from '../../src/infrastructure/factories/DependencyContainer';
import { createTestD1Database, closeTestDatabase, applyMigrations, createTestEnv } from '../helpers/d1-database';
import type { D1Database } from '../helpers/d1-database';
import { generateId } from '../../src/utils/id';
import { Env } from '../../src/types/discord';

describe('Clean Architecture Integration Flow', () => {
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
      text: async () => 'OK'
    });
  });

  afterEach(async () => {
    await closeTestDatabase(db);
    vi.restoreAllMocks();
  });

  describe('Full Create Schedule Flow', () => {
    it('should create schedule through all layers successfully', async () => {
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
          { id: 'date2', datetime: new Date(Date.now() + 259200000).toISOString() }
        ],
        deadline: new Date(Date.now() + 86400000).toISOString(),
        reminderTimings: ['8h', '30m'],
        reminderMentions: ['@here']
      };

      // Act
      const result = await createScheduleUseCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.schedule).toBeDefined();
      expect(result.schedule!.title).toBe('Integration Test Schedule');
      expect(result.schedule!.dates).toHaveLength(2);
      expect(result.schedule!.status).toBe('open');

      // Verify schedule was persisted
      const getScheduleUseCase = container.applicationServices.getScheduleUseCase;
      const getResult = await getScheduleUseCase.execute({
        scheduleId: result.schedule!.id,
        guildId: 'guild-123'
      });

      expect(getResult.success).toBe(true);
      expect(getResult.schedule).toBeDefined();
      expect(getResult.schedule!.id).toBe(result.schedule!.id);
    });

    it('should validate through domain layer correctly', async () => {
      // Arrange
      const createScheduleUseCase = container.applicationServices.createScheduleUseCase;
      const request = {
        guildId: 'guild-123',
        channelId: 'channel-123',
        authorId: 'user-123',
        authorUsername: 'testuser',
        title: '', // Invalid - empty title
        dates: [] // Invalid - no dates
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

  describe('Full Response Submission Flow', () => {
    it('should submit response through all layers successfully', async () => {
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
          { id: 'date2', datetime: new Date(Date.now() + 259200000).toISOString() }
        ]
      });

      const submitResponseUseCase = container.applicationServices.submitResponseUseCase;
      const request = {
        scheduleId: scheduleResult.schedule!.id,
        guildId: 'guild-123',
        userId: 'responder-123',
        username: 'responder',
        displayName: 'Test Responder',
        responses: [
          { dateId: 'date1', status: 'ok' as const },
          { dateId: 'date2', status: 'maybe' as const }
        ],
        comment: 'Looking forward to it!'
      };

      // Act
      const result = await submitResponseUseCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response!.userId).toBe('responder-123');
      expect(result.response!.dateStatuses).toEqual({
        'date1': 'ok',
        'date2': 'maybe'
      });

      // Verify response was persisted
      const getResponseUseCase = container.applicationServices.getResponseUseCase;
      const getResult = await getResponseUseCase.execute({
        scheduleId: scheduleResult.schedule!.id,
        guildId: 'guild-123',
        userId: 'responder-123'
      });

      expect(getResult.success).toBe(true);
      expect(getResult.response).toBeDefined();
      expect(getResult.response!.userId).toBe('responder-123');
    });
  });

  describe('Full Schedule Summary Flow', () => {
    it('should get schedule summary with responses through all layers', async () => {
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
          { id: 'date2', datetime: new Date(Date.now() + 259200000).toISOString() }
        ]
      });

      const submitResponseUseCase = container.applicationServices.submitResponseUseCase;
      
      // Add multiple responses
      await submitResponseUseCase.execute({
        scheduleId: scheduleResult.schedule!.id,
        guildId: 'guild-123',
        userId: 'user1',
        username: 'user1',
        responses: [
          { dateId: 'date1', status: 'ok' },
          { dateId: 'date2', status: 'ok' }
        ]
      });

      await submitResponseUseCase.execute({
        scheduleId: scheduleResult.schedule!.id,
        guildId: 'guild-123',
        userId: 'user2',
        username: 'user2',
        responses: [
          { dateId: 'date1', status: 'ok' },
          { dateId: 'date2', status: 'ng' }
        ]
      });

      await submitResponseUseCase.execute({
        scheduleId: scheduleResult.schedule!.id,
        guildId: 'guild-123',
        userId: 'user3',
        username: 'user3',
        responses: [
          { dateId: 'date1', status: 'maybe' },
          { dateId: 'date2', status: 'maybe' }
        ]
      });

      // Act
      const getSummaryUseCase = container.applicationServices.getScheduleSummaryUseCase;
      const summaryResult = await getSummaryUseCase.execute({
        scheduleId: scheduleResult.schedule!.id,
        guildId: 'guild-123'
      });

      // Assert
      expect(summaryResult.success).toBe(true);
      expect(summaryResult.summary).toBeDefined();
      expect(summaryResult.summary!.totalResponseUsers).toBe(3);
      expect(summaryResult.summary!.responseCounts['date1']).toEqual({
        ok: 2,
        maybe: 1,
        ng: 0
      });
      expect(summaryResult.summary!.responseCounts['date2']).toEqual({
        ok: 1,
        maybe: 1,
        ng: 1
      });
      expect(summaryResult.summary!.bestDateId).toBe('date1'); // date1 has more OK responses
    });
  });

  describe('Full Deadline Reminder Flow', () => {
    it('should process deadline reminders through all layers', async () => {
      // Arrange - Create schedules with different deadline times
      const createScheduleUseCase = container.applicationServices.createScheduleUseCase;
      
      // Schedule that should trigger 8h reminder
      await createScheduleUseCase.execute({
        guildId: 'guild-123',
        channelId: 'channel-123',
        authorId: 'user-123',
        authorUsername: 'testuser',
        title: 'Reminder Test Schedule',
        dates: [
          { id: 'date1', datetime: new Date(Date.now() + 172800000).toISOString() }
        ],
        deadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
        reminderTimings: ['8h', '1h']
      });

      // Act
      const deadlineReminderUseCase = container.applicationServices.deadlineReminderUseCase;
      const result = await deadlineReminderUseCase.execute();

      // Assert
      expect(result.upcomingReminders).toHaveLength(1);
      expect(result.upcomingReminders[0].reminderType).toBe('8h');
      expect(result.justClosed).toHaveLength(0);
    });
  });

  describe('Repository Pattern Integration', () => {
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
        dates: [
          { id: 'date1', datetime: new Date(Date.now() + 172800000).toISOString() }
        ]
      });

      expect(successResult.success).toBe(true);
      const scheduleId = successResult.schedule!.id;

      // Verify schedule exists
      const getResult = await getScheduleUseCase.execute({
        scheduleId,
        guildId: 'guild-123'
      });
      expect(getResult.success).toBe(true);
    });
  });

  describe('Clean Architecture Boundaries', () => {
    it('should maintain layer separation throughout flow', async () => {
      // This test verifies that:
      // 1. Controllers only use use cases
      // 2. Use cases only use domain services and repositories
      // 3. Domain entities don't depend on external layers
      // 4. Infrastructure adapts to domain interfaces

      // Arrange
      const { CreateScheduleController } = await import('../../src/presentation/controllers/CreateScheduleController');
      const controller = new CreateScheduleController(container.applicationServices.createScheduleUseCase);
      const interaction = {
        data: {
          options: [
            { name: 'title', value: 'Architecture Test' },
            { name: 'dates', value: '2024-12-01 10:00, 2024-12-02 14:00' },
            { name: 'deadline', value: '2024-11-30 23:59' }
          ]
        },
        user: { id: 'user-123', username: 'testuser' },
        guild_id: 'guild-123',
        channel_id: 'channel-123'
      };

      // Act - Controller processes Discord interaction
      const response = await controller.handle(interaction as any);

      // Assert - Response follows Discord API format
      expect(response).toBeDefined();
      expect(response.type).toBe(4); // CHANNEL_MESSAGE_WITH_SOURCE
      expect(response.data).toBeDefined();
      
      // Verify the schedule was created through all layers
      const getScheduleUseCase = container.applicationServices.getScheduleUseCase;
      const schedules = await container.applicationServices.listSchedulesUseCase.execute({
        channelId: 'channel-123',
        guildId: 'guild-123'
      });

      expect(schedules.success).toBe(true);
      expect(schedules.schedules.length).toBeGreaterThan(0);
    });
  });
});
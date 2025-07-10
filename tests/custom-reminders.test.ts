import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendDeadlineReminders } from '../src/cron/deadline-reminder';
import { Env } from '../src/types/discord';
import { Schedule } from '../src/types/schedule';
import { createTestD1Database, closeTestDatabase, applyMigrations, createTestEnv } from './helpers/d1-database';
import type { D1Database } from './helpers/d1-database';
import { StorageServiceV2 } from '../src/services/storage-v2';
import { NotificationService } from '../src/services/notification';

// Mock fetch globally
global.fetch = vi.fn();

// Mock NotificationService
vi.mock('../src/services/notification', () => {
  return {
    NotificationService: vi.fn().mockImplementation(() => ({
      sendDeadlineReminder: vi.fn().mockResolvedValue(undefined)
    }))
  };
});

describe('Custom Reminder Settings', () => {
  let db: D1Database;
  let mockEnv: Env;
  let storage: StorageServiceV2;
  let mockNotification: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    
    // Reset global fetch mock
    (global.fetch as any) = vi.fn();
    
    // Setup D1 database
    db = createTestD1Database();
    await applyMigrations(db);
    
    mockEnv = {
      DISCORD_PUBLIC_KEY: 'test-public-key',
      DISCORD_APPLICATION_ID: 'test-app-id',
      DISCORD_TOKEN: 'test-token',
      DATABASE_TYPE: 'd1' as const,
      DB: db as unknown as D1Database,
      SCHEDULES: {} as KVNamespace,
      RESPONSES: {} as KVNamespace,
      REMINDER_BATCH_SIZE: '10',
      REMINDER_BATCH_DELAY: '50'
    };
    
    storage = new StorageServiceV2({} as KVNamespace, {} as KVNamespace, mockEnv);
    
    // Create mock notification with spy
    mockNotification = {
      sendDeadlineReminder: vi.fn().mockResolvedValue(undefined)
    };
    
    // Mock NotificationService constructor to return our mock
    (NotificationService as any).mockImplementation(() => mockNotification);
  });

  afterEach(() => {
    closeTestDatabase(db);
  });

  describe('Custom reminder timings', () => {
    it('should use custom timings instead of defaults', async () => {
      const now = new Date();
      const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);
      
      const schedule: Schedule = {
        id: 'schedule-1',
        title: 'Custom Timing Event',
        dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
        createdBy: { id: 'user123', username: 'TestUser' },
        authorId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        messageId: 'message123',
        deadline: in30Minutes,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'open',
        notificationSent: false,
        remindersSent: [],
        reminderTimings: ['30m', '15m', '5m'], // Custom timings
        reminderMentions: ['@everyone'],
        totalResponses: 0
      };

      // Save schedule to D1
      await storage.saveSchedule(schedule);

      await sendDeadlineReminders(mockEnv);

      // Verify that the notification service was called with correct parameters
      expect(mockNotification.sendDeadlineReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'schedule-1',
          reminderMentions: ['@everyone']
        }),
        '締切まで30分'
      );

      // Verify schedule was updated with the sent reminder
      const updatedSchedule = await storage.getSchedule('schedule-1', 'guild123');
      expect(updatedSchedule?.remindersSent).toContain('30m');
    });

    it('should handle multiple custom mentions', async () => {
      const now = new Date();
      // Set deadline exactly 29 minutes and 59 seconds from now
      // This ensures we've just passed the 30 minute reminder threshold
      const deadline = new Date(now.getTime() + 29 * 60 * 1000 + 59 * 1000);
      
      const schedule: Schedule = {
        id: 'schedule-2',
        title: 'Multi-mention Event',
        dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
        createdBy: { id: 'user123', username: 'TestUser' },
        authorId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        messageId: 'message123',
        deadline: deadline,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'open',
        notificationSent: false,
        remindersSent: [],
        reminderTimings: ['30m'],  // 30 minute reminder
        reminderMentions: ['@everyone', '@here', '<@123456789>'], // Multiple mentions
        totalResponses: 0
      };

      // Save schedule to D1
      await storage.saveSchedule(schedule);

      await sendDeadlineReminders(mockEnv);

      // Verify that the notification service was called with schedule containing multiple mentions
      expect(mockNotification.sendDeadlineReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'schedule-2',
          reminderMentions: ['@everyone', '@here', '<@123456789>']
        }),
        '締切まで30分'
      );
    });

    it('should parse different time units correctly', async () => {
      const now = new Date();
      // Set deadline to be less than 2 days away (47 hours and 59 minutes)
      // This ensures the 2d reminder should fire
      const deadline = new Date(now.getTime() + 47 * 60 * 60 * 1000 + 59 * 60 * 1000);
      
      const schedule: Schedule = {
        id: 'schedule-3',
        title: 'Multi-unit Event',
        dates: [{ id: 'date1', datetime: '2024-12-27 19:00' }],
        createdBy: { id: 'user123', username: 'TestUser' },
        authorId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        messageId: 'message123',
        deadline: deadline,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'open',
        notificationSent: false,
        remindersSent: [],
        reminderTimings: ['2d', '12h', '30m'], // Days, hours, minutes
        totalResponses: 0
      };

      // Save schedule to D1
      await storage.saveSchedule(schedule);

      await sendDeadlineReminders(mockEnv);

      // Verify notification was sent with correct message
      expect(mockNotification.sendDeadlineReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'schedule-3'
        }),
        '締切まで2日'
      );

      // Verify schedule was updated with the sent reminder
      const updatedSchedule = await storage.getSchedule('schedule-3', 'guild123');
      expect(updatedSchedule?.remindersSent).toContain('2d');
    });

    it('should not send reminders if no custom timings and defaults would not apply', async () => {
      const now = new Date();
      const in5Minutes = new Date(now.getTime() + 5 * 60 * 1000); // Too close for default reminders
      
      const schedule: Schedule = {
        id: 'schedule-4',
        title: 'No Reminders Event',
        dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
        createdBy: { id: 'user123', username: 'TestUser' },
        authorId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        messageId: 'message123',
        deadline: in5Minutes,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'open',
        notificationSent: false,
        remindersSent: ['3d', '1d', '8h', '30m'], // All default reminders already sent including 30m
        totalResponses: 0
      };

      // Save schedule to D1
      await storage.saveSchedule(schedule);

      await sendDeadlineReminders(mockEnv);

      // Should not send any reminders
      expect(mockNotification.sendDeadlineReminder).not.toHaveBeenCalled();
      
      // Verify schedule remains unchanged
      const unchangedSchedule = await storage.getSchedule('schedule-4', 'guild123');
      expect(unchangedSchedule?.remindersSent).toEqual(['3d', '1d', '8h', '30m']);
    });
  });
});
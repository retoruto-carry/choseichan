import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendDeadlineReminders } from '../../src/cron/deadline-reminder';
import { Schedule } from '../../src/types/schedule';
import { createTestD1Database, closeTestDatabase, applyMigrations, createTestEnv } from '../helpers/d1-database';
import type { D1Database } from '../helpers/d1-database';
import { StorageServiceV2 } from '../../src/services/storage-v2';

// Create a shared mock instance
const mockNotificationService = {
  sendDeadlineReminder: vi.fn(async () => true),
  sendClosureNotification: vi.fn(async () => true),
  sendSummaryMessage: vi.fn(async () => true),
  sendPRMessage: vi.fn(async () => true)
};

// Mock the notification service
vi.mock('../../src/services/notification', () => ({
  NotificationService: vi.fn().mockImplementation(() => mockNotificationService)
}));


describe('Deadline Reminder', () => {
  let db: D1Database;
  let storage: StorageServiceV2;
  let mockEnv: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup D1 database
    db = createTestD1Database();
    await applyMigrations(db);
    
    mockEnv = {
      DISCORD_TOKEN: 'test-token',
      DISCORD_APPLICATION_ID: 'test-app',
      DATABASE_TYPE: 'd1',
      DB: db,
    };
    
    storage = new StorageServiceV2(mockEnv);
  });

  afterEach(() => {
    closeTestDatabase(db);
  });

  it('should send 8h reminder for schedule with deadline in 4 hours', async () => {
    const now = new Date();
    const deadlineIn4Hours = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    
    const schedule: Schedule = {
      id: 'test-schedule-1',
      title: 'テストイベント',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: deadlineIn4Hours,
      remindersSent: ['3d', '1d'], // Already sent 3d and 1d
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false
    };

    await storage.saveSchedule(schedule);

    await sendDeadlineReminders(mockEnv);

    expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-schedule-1',
        title: 'テストイベント'
      }),
      '締切まで8時間'
    );
    
    // Check that remindersSent was updated
    const updatedSchedule = await storage.getSchedule('test-schedule-1', 'guild123');
    expect(updatedSchedule?.remindersSent).toContain('8h');
  });

  it('should not send reminder if already sent', async () => {
    const now = new Date();
    const deadlineIn30Min = new Date(now.getTime() + 30 * 60 * 1000);
    
    const schedule: Schedule = {
      id: 'test-schedule-2',
      title: 'Already Reminded Event',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: deadlineIn30Min,
      reminderSent: true, // Already sent
      remindersSent: ['3d', '1d', '8h', '1h'], // All reminders already sent
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false
    };

    await storage.saveSchedule(schedule);

    await sendDeadlineReminders(mockEnv);

    expect(mockNotificationService.sendDeadlineReminder).not.toHaveBeenCalled();
  });

  it('should send closure notification for closed schedule', async () => {
    const now = new Date();
    const pastDeadline = new Date(now.getTime() - 10 * 60 * 1000); // 10 minutes ago
    
    const schedule: Schedule = {
      id: 'test-schedule-3',
      title: 'Closed Event',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: pastDeadline,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open', // Should be open to trigger closure notification
      notificationSent: false
    };

    await storage.saveSchedule(schedule);

    await sendDeadlineReminders(mockEnv);

    expect(mockNotificationService.sendSummaryMessage).toHaveBeenCalledWith(
      'test-schedule-3',
      'guild123'
    );
    
    // Check that status was updated to closed
    const updatedSchedule = await storage.getSchedule('test-schedule-3', 'guild123');
    expect(updatedSchedule?.status).toBe('closed');
  });

  it('should not send closure notification if already sent', async () => {
    const now = new Date();
    const pastDeadline = new Date(now.getTime() - 10 * 60 * 1000);
    
    const schedule: Schedule = {
      id: 'test-schedule-4',
      title: 'Already Notified Event',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: pastDeadline,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'closed',
      notificationSent: true // Already notified
    };

    await storage.saveSchedule(schedule);

    await sendDeadlineReminders(mockEnv);

    expect(mockNotificationService.sendSummaryMessage).not.toHaveBeenCalled();
  });

  it('should handle schedules without deadlines', async () => {
    const schedule: Schedule = {
      id: 'test-schedule-5',
      title: 'No Deadline Event',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: undefined, // No deadline
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false
    };

    await storage.saveSchedule(schedule);

    await sendDeadlineReminders(mockEnv);

    expect(mockNotificationService.sendDeadlineReminder).not.toHaveBeenCalled();
    expect(mockNotificationService.sendSummaryMessage).not.toHaveBeenCalled();
  });

  it('should handle multiple guilds independently', async () => {
    const now = new Date();
    const deadlineIn4Hours = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    
    // Guild 1 schedule
    const schedule1: Schedule = {
      id: 'multi-guild-1',
      title: 'Guild 1 Event',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: deadlineIn4Hours,
      remindersSent: ['3d', '1d'], // Already sent 3d and 1d
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false
    };

    // Guild 2 schedule
    const schedule2: Schedule = {
      id: 'multi-guild-2',
      title: 'Guild 2 Event',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user456', username: 'TestUser2' },
      authorId: 'user456',
      channelId: 'channel456',
      guildId: 'guild456',
      deadline: deadlineIn4Hours,
      remindersSent: ['3d', '1d'], // Already sent 3d and 1d
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false
    };

    await storage.saveSchedule(schedule1);
    await storage.saveSchedule(schedule2);

    await sendDeadlineReminders(mockEnv);

    expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledTimes(2);
    expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'multi-guild-1',
        title: 'Guild 1 Event'
      }),
      '締切まで8時間'
    );
    expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'multi-guild-2',
        title: 'Guild 2 Event'
      }),
      '締切まで8時間'
    );
  });

  it('should skip old reminders based on dynamic thresholds', async () => {
    const now = new Date();
    const deadlineIn10Hours = new Date(now.getTime() + 10 * 60 * 60 * 1000);
    
    // Create a schedule where 3d and 1d reminders would be more than 8 hours late
    // With deadline in 10 hours:
    // - 3d reminder should have been sent 62 hours ago (too old)
    // - 1d reminder should have been sent 14 hours ago (too old)  
    // - 8h reminder is still 2 hours in the future (not ready yet)
    const schedule: Schedule = {
      id: 'test-old-reminder',
      title: 'Old Reminder Test',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: deadlineIn10Hours,
      remindersSent: [], // No reminders sent yet
      createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // Created 4 days ago
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false
    };

    await storage.saveSchedule(schedule);

    await sendDeadlineReminders(mockEnv);

    // Should not send any reminders because:
    // - 3d and 1d reminders are more than 8 hours late (skipped)
    // - 8h reminder is not due yet (deadline is in 10 hours)
    expect(mockNotificationService.sendDeadlineReminder).not.toHaveBeenCalled();
  });

  it('should apply appropriate thresholds for different reminder types', async () => {
    const now = new Date();
    
    // Test 1: Hour-based reminder with 1.5 hours late (should send - threshold is 2h)
    const deadlineIn30Min = new Date(now.getTime() + 30 * 60 * 1000);
    const schedule1: Schedule = {
      id: 'test-hour-reminder',
      title: 'Hour Reminder Test',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: deadlineIn30Min,
      remindersSent: [],
      reminderTimings: ['2h'], // 2 hour reminder, currently 1.5 hours late
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false
    };

    await storage.saveSchedule(schedule1);

    // Test 2: Minute-based reminder with 25 minutes late (should send - threshold is 30m)
    const deadlineIn5Min = new Date(now.getTime() + 5 * 60 * 1000);
    const schedule2: Schedule = {
      id: 'test-minute-reminder',
      title: 'Minute Reminder Test',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: deadlineIn5Min,
      remindersSent: [],
      reminderTimings: ['30m'], // 30 minute reminder, currently 25 minutes late
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false
    };

    await storage.saveSchedule(schedule2);

    // Test 3: Hour reminder more than 2 hours late (should skip)
    const deadlinePast1Hour = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    const schedule3: Schedule = {
      id: 'test-old-hour-reminder',
      title: 'Old Hour Reminder Test',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: deadlinePast1Hour,
      remindersSent: [],
      reminderTimings: ['1h'], // Should have been sent 2+ hours ago
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false
    };

    await storage.saveSchedule(schedule3);

    await sendDeadlineReminders(mockEnv);

    // Should send 2 reminders (hour and minute based)
    expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledTimes(2);
    expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-hour-reminder' }),
      '締切まで2時間'
    );
    expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-minute-reminder' }),
      '締切まで30分'
    );

    // Should also send closure notification for the past deadline
    expect(mockNotificationService.sendSummaryMessage).toHaveBeenCalledWith(
      'test-old-hour-reminder',
      'guild123'
    );
  });
});
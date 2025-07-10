import { describe, it, expect, beforeEach, vi } from 'vitest';
import { sendDeadlineReminders } from '../../src/cron/deadline-reminder';
import { Schedule } from '../../src/types/schedule';
import { NotificationService } from '../../src/services/notification';

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

// Mock KVNamespace
const createMockKVNamespace = () => {
  const storage = new Map();
  return {
    get: vi.fn(async (key: string) => storage.get(key) || null),
    put: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    list: vi.fn(async (options: { prefix: string }) => {
      const keys = Array.from(storage.keys())
        .filter(k => k.startsWith(options.prefix))
        .map(name => ({ name, metadata: {} }));
      return { keys, list_complete: true };
    })
  } as unknown as KVNamespace;
};

describe('Deadline Reminder', () => {
  let mockKV: KVNamespace;
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockKV = createMockKVNamespace();
    mockEnv = {
      SCHEDULES: mockKV,
      RESPONSES: createMockKVNamespace(),
      DISCORD_TOKEN: 'test-token',
      DISCORD_APPLICATION_ID: 'test-app'
    };
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
      reminderSent: false,
      remindersSent: ['3d', '1d'], // Already sent 3d and 1d
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false
    };

    await mockKV.put(
      `guild:guild123:schedule:test-schedule-1`,
      JSON.stringify(schedule)
    );
    
    // Add deadline index entry
    const deadlineTimestamp = Math.floor(deadlineIn4Hours.getTime() / 1000);
    await mockKV.put(
      `deadline:${deadlineTimestamp}:guild123:test-schedule-1`,
      ''
    );

    await sendDeadlineReminders(mockEnv);

    expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-schedule-1',
        title: 'テストイベント'
      }),
      '締切まで8時間'
    );
    
    // Check that reminderSent was updated
    const updatedSchedule = await mockKV.get(`guild:guild123:schedule:test-schedule-1`);
    const parsed = JSON.parse(updatedSchedule as string);
    expect(parsed.reminderSent).toBe(true);
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

    await mockKV.put(
      `guild:guild123:schedule:test-schedule-2`,
      JSON.stringify(schedule)
    );

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
      reminderSent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open', // Should be open to trigger closure notification
      notificationSent: false
    };

    await mockKV.put(
      `guild:guild123:schedule:test-schedule-3`,
      JSON.stringify(schedule)
    );
    
    // Add deadline index entry for past deadline
    const deadlineTimestamp = Math.floor(pastDeadline.getTime() / 1000);
    await mockKV.put(
      `deadline:${deadlineTimestamp}:guild123:test-schedule-3`,
      ''
    );

    await sendDeadlineReminders(mockEnv);

    expect(mockNotificationService.sendSummaryMessage).toHaveBeenCalledWith(
      'test-schedule-3',
      'guild123'
    );
    
    // Check that status was updated to closed
    const updatedSchedule = await mockKV.get(`guild:guild123:schedule:test-schedule-3`);
    const parsed = JSON.parse(updatedSchedule as string);
    expect(parsed.status).toBe('closed');
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
      reminderSent: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'closed',
      notificationSent: true // Already notified
    };

    await mockKV.put(
      `guild:guild123:schedule:test-schedule-4`,
      JSON.stringify(schedule)
    );

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

    await mockKV.put(
      `guild:guild123:schedule:test-schedule-5`,
      JSON.stringify(schedule)
    );

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
      reminderSent: false,
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
      reminderSent: false,
      remindersSent: ['3d', '1d'], // Already sent 3d and 1d
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false
    };

    await mockKV.put(
      `guild:guild123:schedule:multi-guild-1`,
      JSON.stringify(schedule1)
    );
    await mockKV.put(
      `guild:guild456:schedule:multi-guild-2`,
      JSON.stringify(schedule2)
    );
    
    // Add deadline index entries
    const deadlineTimestamp = Math.floor(deadlineIn4Hours.getTime() / 1000);
    await mockKV.put(
      `deadline:${deadlineTimestamp}:guild123:multi-guild-1`,
      ''
    );
    await mockKV.put(
      `deadline:${deadlineTimestamp}:guild456:multi-guild-2`,
      ''
    );

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
      reminderSent: false,
      remindersSent: [], // No reminders sent yet
      createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // Created 4 days ago
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false
    };

    await mockKV.put(
      `guild:guild123:schedule:test-old-reminder`,
      JSON.stringify(schedule)
    );
    
    // Add deadline index entry
    const deadlineTimestamp = Math.floor(deadlineIn10Hours.getTime() / 1000);
    await mockKV.put(
      `deadline:${deadlineTimestamp}:guild123:test-old-reminder`,
      ''
    );

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
      reminderSent: false,
      remindersSent: [],
      reminderTimings: ['2h'], // 2 hour reminder, currently 1.5 hours late
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false
    };

    await mockKV.put(
      `guild:guild123:schedule:test-hour-reminder`,
      JSON.stringify(schedule1)
    );
    const timestamp1 = Math.floor(deadlineIn30Min.getTime() / 1000);
    await mockKV.put(
      `deadline:${timestamp1}:guild123:test-hour-reminder`,
      ''
    );

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
      reminderSent: false,
      remindersSent: [],
      reminderTimings: ['30m'], // 30 minute reminder, currently 25 minutes late
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false
    };

    await mockKV.put(
      `guild:guild123:schedule:test-minute-reminder`,
      JSON.stringify(schedule2)
    );
    const timestamp2 = Math.floor(deadlineIn5Min.getTime() / 1000);
    await mockKV.put(
      `deadline:${timestamp2}:guild123:test-minute-reminder`,
      ''
    );

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
      reminderSent: false,
      remindersSent: [],
      reminderTimings: ['1h'], // Should have been sent 2+ hours ago
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false
    };

    await mockKV.put(
      `guild:guild123:schedule:test-old-hour-reminder`,
      JSON.stringify(schedule3)
    );
    const timestamp3 = Math.floor(deadlinePast1Hour.getTime() / 1000);
    await mockKV.put(
      `deadline:${timestamp3}:guild123:test-old-hour-reminder`,
      ''
    );

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
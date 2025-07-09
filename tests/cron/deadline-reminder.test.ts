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

  it('should send 1h reminder for schedule with deadline in 30 minutes', async () => {
    const now = new Date();
    const deadlineIn30Min = new Date(now.getTime() + 30 * 60 * 1000);
    
    const schedule: Schedule = {
      id: 'test-schedule-1',
      title: 'テストイベント',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: deadlineIn30Min,
      reminderSent: false,
      remindersSent: ['3d', '1d', '8h'], // Already sent other reminders
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
    const deadlineTimestamp = Math.floor(deadlineIn30Min.getTime() / 1000);
    await mockKV.put(
      `guild:guild123:deadline:${deadlineTimestamp}:test-schedule-1`,
      ''
    );

    await sendDeadlineReminders(mockEnv);

    expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-schedule-1',
        title: 'テストイベント'
      }),
      '締切まで1時間'
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
      `guild:guild123:deadline:${deadlineTimestamp}:test-schedule-3`,
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
    const deadlineIn30Min = new Date(now.getTime() + 30 * 60 * 1000);
    
    // Guild 1 schedule
    const schedule1: Schedule = {
      id: 'multi-guild-1',
      title: 'Guild 1 Event',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: deadlineIn30Min,
      reminderSent: false,
      remindersSent: ['3d', '1d', '8h'], // Already sent other reminders
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
      deadline: deadlineIn30Min,
      reminderSent: false,
      remindersSent: ['3d', '1d', '8h'], // Already sent other reminders
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
    const deadlineTimestamp = Math.floor(deadlineIn30Min.getTime() / 1000);
    await mockKV.put(
      `guild:guild123:deadline:${deadlineTimestamp}:multi-guild-1`,
      ''
    );
    await mockKV.put(
      `guild:guild456:deadline:${deadlineTimestamp}:multi-guild-2`,
      ''
    );

    await sendDeadlineReminders(mockEnv);

    expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledTimes(2);
    expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'multi-guild-1',
        title: 'Guild 1 Event'
      }),
      '締切まで1時間'
    );
    expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'multi-guild-2',
        title: 'Guild 2 Event'
      }),
      '締切まで1時間'
    );
  });

  it('should skip old reminders (more than 8 hours late)', async () => {
    const now = new Date();
    const deadlineIn30Min = new Date(now.getTime() + 30 * 60 * 1000);
    
    // Create a schedule where we missed the 3d reminder by 10 hours
    const schedule: Schedule = {
      id: 'test-old-reminder',
      title: 'Old Reminder Test',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: deadlineIn30Min,
      reminderSent: false,
      remindersSent: ['8h'], // 8h reminder already sent to test that only 1h is sent
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
    const deadlineTimestamp = Math.floor(deadlineIn30Min.getTime() / 1000);
    await mockKV.put(
      `guild:guild123:deadline:${deadlineTimestamp}:test-old-reminder`,
      ''
    );

    await sendDeadlineReminders(mockEnv);

    // Should only send the 1h reminder, not the old 3d, 1d, 8h reminders
    expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledTimes(1);
    expect(mockNotificationService.sendDeadlineReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-old-reminder'
      }),
      '締切まで1時間'
    );
  });
});
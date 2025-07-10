import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendDeadlineReminders } from '../src/cron/deadline-reminder';
import { Env } from '../src/types/discord';
import { Schedule } from '../src/types/schedule';

// Mock fetch globally
global.fetch = vi.fn();

describe('Custom Reminder Settings', () => {
  let mockEnv: Env;
  let mockKV: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    
    // Reset global fetch mock
    (global.fetch as any) = vi.fn();
    
    // Mock KV storage - create fresh instances
    mockKV = {
      list: vi.fn().mockResolvedValue({ keys: [] }),
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    };
    
    mockEnv = {
      DISCORD_PUBLIC_KEY: 'test-public-key',
      DISCORD_APPLICATION_ID: 'test-app-id',
      DISCORD_TOKEN: 'test-token',
      SCHEDULES: mockKV,
      RESPONSES: mockKV,
      REMINDER_BATCH_SIZE: '10',
      REMINDER_BATCH_DELAY: '50'
    } as Env;
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
        reminderSent: false,
        remindersSent: [],
        reminderTimings: ['30m', '15m', '5m'], // Custom timings
        reminderMentions: ['@everyone'],
        totalResponses: 0
      };

      // Mock guild list and deadline index
      mockKV.list.mockImplementation(({ prefix }: any) => {
        if (prefix === 'deadline:') {
          const deadlineTimestamp = Math.floor(in30Minutes.getTime() / 1000);
          return Promise.resolve({
            keys: [{ name: `deadline:${deadlineTimestamp}:guild123:schedule-1` }]
          });
        }
        if (prefix?.includes('response:')) {
          return Promise.resolve({ keys: [] });
        }
        return Promise.resolve({ keys: [] });
      });

      // Mock schedule retrieval
      mockKV.get.mockImplementation((key: string) => {
        if (key === 'guild:guild123:schedule:schedule-1') {
          return Promise.resolve(JSON.stringify(schedule));
        }
        return Promise.resolve(null);
      });

      // Mock successful Discord API calls
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'message-sent' })
      });

      await sendDeadlineReminders(mockEnv);

      // Should send 30m reminder (since we're 30 minutes before deadline)
      expect(mockKV.put).toHaveBeenCalledWith(
        'guild:guild123:schedule:schedule-1',
        expect.stringContaining('"remindersSent":["30m"]'),
        expect.any(Object)
      );

      // Should include mention in message
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          body: expect.stringContaining('@everyone')
        })
      );
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
        reminderSent: false,
        remindersSent: [],
        reminderTimings: ['30m'],  // 30 minute reminder
        reminderMentions: ['@everyone', '@here', '<@123456789>'], // Multiple mentions
        totalResponses: 0
      };

      // Mock guild list and deadline index
      mockKV.list.mockImplementation(({ prefix }: any) => {
        if (prefix === 'deadline:') {
          const deadlineTimestamp = Math.floor(deadline.getTime() / 1000);
          return Promise.resolve({
            keys: [{ name: `deadline:${deadlineTimestamp}:guild123:schedule-2` }]
          });
        }
        if (prefix?.includes('response:')) {
          return Promise.resolve({ keys: [] });
        }
        return Promise.resolve({ keys: [] });
      });

      // Mock schedule retrieval
      mockKV.get.mockImplementation((key: string) => {
        if (key === 'guild:guild123:schedule:schedule-2') {
          return Promise.resolve(JSON.stringify(schedule));
        }
        return Promise.resolve(null);
      });

      // Mock successful Discord API calls
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'message-sent' })
      });

      await sendDeadlineReminders(mockEnv);

      // Should include all mentions in the message body
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          body: expect.stringMatching(/@everyone.*@here.*<@123456789>/)
        })
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
        reminderSent: false,
        remindersSent: [],
        reminderTimings: ['2d', '12h', '30m'], // Days, hours, minutes
        totalResponses: 0
      };

      // Mock guild list and deadline index
      mockKV.list.mockImplementation(({ prefix }: any) => {
        if (prefix === 'deadline:') {
          const deadlineTimestamp = Math.floor(deadline.getTime() / 1000);
          return Promise.resolve({
            keys: [{ name: `deadline:${deadlineTimestamp}:guild123:schedule-3` }]
          });
        }
        if (prefix?.includes('response:')) {
          return Promise.resolve({ keys: [] });
        }
        return Promise.resolve({ keys: [] });
      });

      // Mock schedule retrieval
      mockKV.get.mockImplementation((key: string) => {
        if (key === 'guild:guild123:schedule:schedule-3') {
          return Promise.resolve(JSON.stringify(schedule));
        }
        return Promise.resolve(null);
      });

      // Mock successful Discord API calls
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'message-sent' })
      });

      await sendDeadlineReminders(mockEnv);

      // Should send 2d reminder
      expect(mockKV.put).toHaveBeenCalledWith(
        'guild:guild123:schedule:schedule-3',
        expect.stringContaining('"remindersSent":["2d"]'),
        expect.any(Object)
      );

      // Message should say "締切まで2日"
      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall).toBeDefined();
      const body = JSON.parse(fetchCall[1].body);
      expect(body.content).toContain('締切まで2日');
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
        reminderSent: true, // Mark as already sent to avoid 30m default reminder
        remindersSent: ['3d', '1d', '8h', '30m'], // All default reminders already sent including 30m
        totalResponses: 0
      };

      // Mock guild list and deadline index
      mockKV.list.mockImplementation(({ prefix }: any) => {
        if (prefix === 'deadline:') {
          const deadlineTimestamp = Math.floor(in5Minutes.getTime() / 1000);
          return Promise.resolve({
            keys: [{ name: `deadline:${deadlineTimestamp}:guild123:schedule-4` }]
          });
        }
        return Promise.resolve({ keys: [] });
      });

      // Mock schedule retrieval
      mockKV.get.mockImplementation((key: string) => {
        if (key === 'guild:guild123:schedule:schedule-4') {
          return Promise.resolve(JSON.stringify(schedule));
        }
        return Promise.resolve(null);
      });

      await sendDeadlineReminders(mockEnv);

      // Should not send any reminders
      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockKV.put).not.toHaveBeenCalled();
    });
  });
});
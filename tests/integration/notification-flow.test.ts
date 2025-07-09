import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendDeadlineReminders } from '../../src/cron/deadline-reminder';
import { Env } from '../../src/types/discord';
import { Schedule } from '../../src/types/schedule';

// Mock fetch globally
global.fetch = vi.fn();

describe('Notification Flow Integration Tests', () => {
  let mockEnv: Env;
  let mockKV: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock KV storage
    mockKV = {
      list: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
    };
    
    mockEnv = {
      DISCORD_PUBLIC_KEY: 'test-public-key',
      DISCORD_APPLICATION_ID: 'test-app-id',
      DISCORD_TOKEN: 'test-token',
      SCHEDULES: mockKV,
      RESPONSES: mockKV,
      REMINDER_BATCH_SIZE: '2',
      REMINDER_BATCH_DELAY: '50'
    } as Env;
  });

  describe('Full notification flow', () => {
    it('should send reminders for schedules approaching deadline', async () => {
      const now = new Date();
      const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);
      
      const schedule1: Schedule = {
        id: 'schedule-1',
        title: '忘年会',
        dates: [
          { id: 'date1', datetime: '2024-12-23 18:00' },
          { id: 'date2', datetime: '2024-12-24 18:00' }
        ],
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
        totalResponses: 0
      };

      // Mock guild list and deadline index
      mockKV.list.mockImplementation(({ prefix }: any) => {
        if (prefix === 'guild:') {
          return Promise.resolve({
            keys: [{ name: 'guild:guild123:schedule:test-schedule-1' }]
          });
        }
        if (prefix === 'guild:guild123:deadline:') {
          const deadlineTimestamp = Math.floor(in30Minutes.getTime() / 1000);
          return Promise.resolve({
            keys: [{ name: `guild:guild123:deadline:${deadlineTimestamp}:schedule-1` }]
          });
        }
        return Promise.resolve({ keys: [] });
      });

      // Mock schedule retrieval
      mockKV.get.mockImplementation((key: string) => {
        if (key === 'guild:guild123:schedule:schedule-1') {
          return Promise.resolve(JSON.stringify(schedule1));
        }
        return Promise.resolve(null);
      });

      // Update list mock to handle both guild list and response list
      const originalListMock = mockKV.list.getMockImplementation();
      mockKV.list.mockImplementation(({ prefix }: any) => {
        if (prefix === 'guild:guild123:response:schedule-1:') {
          return Promise.resolve({
            keys: [
              { name: 'guild:guild123:response:schedule-1:user1' },
              { name: 'guild:guild123:response:schedule-1:user2' }
            ]
          });
        }
        // Delegate to the original mock for other prefixes
        return originalListMock ? originalListMock({ prefix }) : Promise.resolve({ keys: [] });
      });

      // Mock response data
      mockKV.get.mockImplementation((key: string) => {
        if (key === 'guild:guild123:schedule:schedule-1') {
          return Promise.resolve(JSON.stringify(schedule1));
        }
        if (key === 'guild:guild123:response:schedule-1:user1') {
          return Promise.resolve(JSON.stringify({
            scheduleId: 'schedule-1',
            userId: 'user1',
            userName: 'User 1',
            responses: [
              { dateId: 'date1', status: 'yes' },
              { dateId: 'date2', status: 'maybe' }
            ],
            updatedAt: new Date()
          }));
        }
        if (key === 'guild:guild123:response:schedule-1:user2') {
          return Promise.resolve(JSON.stringify({
            scheduleId: 'schedule-1',
            userId: 'user2',
            userName: 'User 2',
            responses: [
              { dateId: 'date1', status: 'no' },
              { dateId: 'date2', status: 'yes' }
            ],
            updatedAt: new Date()
          }));
        }
        return Promise.resolve(null);
      });

      // Mock Discord API calls
      // 1. DM channel creation
      (global.fetch as any).mockImplementation((url: string, options: any) => {
        if (url === 'https://discord.com/api/v10/users/@me/channels') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 'dm-channel-123' })
          });
        }
        // 2. Message sending
        if (url.includes('/messages')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 'message-sent' })
          });
        }
        return Promise.resolve({ ok: false });
      });

      // Execute
      await sendDeadlineReminders(mockEnv);

      // Verify schedule was updated with reminderSent flag
      // The storage service calls put 3 times per save (main, channel index, deadline index)
      expect(mockKV.put).toHaveBeenCalled();
      expect(mockKV.put).toHaveBeenCalledWith(
        'guild:guild123:schedule:schedule-1',
        expect.stringContaining('"reminderSent":true'),
        expect.any(Object)
      );

      // Verify notifications were sent
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('channels'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bot test-token'
          })
        })
      );
    });

    it('should handle rate limiting with batches', async () => {
      const now = new Date();
      const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);
      
      // Create 5 schedules
      const schedules = Array.from({ length: 5 }, (_, i) => ({
        id: `schedule-${i}`,
        title: `Event ${i}`,
        dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
        createdBy: { id: 'user123', username: 'TestUser' },
        authorId: 'user123',
        channelId: `channel${i}`,
        guildId: 'guild123',
        messageId: `message${i}`,
        deadline: in30Minutes,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'open' as const,
        notificationSent: false,
        reminderSent: false,
        remindersSent: ['3d', '1d'], // Already sent other reminders
        totalResponses: 0
      }));

      // Mock guild list and deadline index with all schedules
      const deadlineTimestamp = Math.floor(in30Minutes.getTime() / 1000);
      mockKV.list.mockImplementation(({ prefix }: any) => {
        if (prefix === 'guild:') {
          return Promise.resolve({
            keys: schedules.map(s => ({ name: `guild:guild123:schedule:${s.id}` }))
          });
        }
        if (prefix === 'guild:guild123:deadline:') {
          return Promise.resolve({
            keys: schedules.map(s => ({ 
              name: `guild:guild123:deadline:${deadlineTimestamp}:${s.id}` 
            }))
          });
        }
        if (prefix?.includes('response:')) {
          return Promise.resolve({ keys: [] });
        }
        return Promise.resolve({ keys: [] });
      });

      // Mock schedule retrieval
      mockKV.get.mockImplementation((key: string) => {
        const match = key.match(/schedule-(\d+)$/);
        if (match) {
          const index = parseInt(match[1]);
          return Promise.resolve(JSON.stringify(schedules[index]));
        }
        return Promise.resolve(null);
      });


      // Mock all Discord API calls as successful
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'message-sent' })
      });

      const startTime = Date.now();
      await sendDeadlineReminders(mockEnv);
      const endTime = Date.now();

      // With batch size 2 and 50ms delay, 5 schedules should take at least 100ms
      // (3 batches: 2, 2, 1 with 2 delays between them)
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);

      // All schedules should be processed (3 puts per schedule save)
      expect(mockKV.put).toHaveBeenCalledTimes(15); // 5 schedules × 3 calls each
      
      // Verify all schedules were marked as reminderSent
      for (let i = 0; i < 5; i++) {
        expect(mockKV.put).toHaveBeenCalledWith(
          `guild:guild123:schedule:schedule-${i}`,
          expect.stringContaining('"reminderSent":true'),
          expect.any(Object)
        );
      }
    });

    it('should not send duplicate reminders', async () => {
      const now = new Date();
      const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);
      
      const schedule: Schedule = {
        id: 'schedule-1',
        title: 'Already Reminded Event',
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
        reminderSent: true, // Already sent!
        remindersSent: ['3d', '1d', '8h'], // All reminders already sent
        totalResponses: 5
      };

      // Mock guild list and deadline index
      mockKV.list.mockImplementation(({ prefix }: any) => {
        if (prefix === 'guild:') {
          return Promise.resolve({
            keys: [{ name: 'guild:guild123:schedule:schedule-1' }]
          });
        }
        if (prefix === 'guild:guild123:deadline:') {
          const deadlineTimestamp = Math.floor(in30Minutes.getTime() / 1000);
          return Promise.resolve({
            keys: [{ name: `guild:guild123:deadline:${deadlineTimestamp}:schedule-1` }]
          });
        }
        return Promise.resolve({ keys: [] });
      });

      // Mock schedule retrieval
      mockKV.get.mockResolvedValueOnce(JSON.stringify(schedule));

      await sendDeadlineReminders(mockEnv);

      // Should not send any notifications
      expect(global.fetch).not.toHaveBeenCalled();
      
      // Should not update the schedule
      expect(mockKV.put).not.toHaveBeenCalled();
    });
  });
});
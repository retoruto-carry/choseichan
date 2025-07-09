import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '../../src/services/notification';
import { StorageServiceV2 } from '../../src/services/storage-v2';
import { Schedule } from '../../src/types/schedule';

// Mock fetch globally
global.fetch = vi.fn();

describe('Mention Resolution', () => {
  let notificationService: NotificationService;
  let mockStorage: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockStorage = {
      getScheduleSummary: vi.fn()
    };
    
    notificationService = new NotificationService(
      mockStorage,
      'test-token',
      'test-app-id'
    );
  });

  describe('Guild member fetching', () => {
    it('should fetch and cache guild members', async () => {
      const mockMembers = [
        { user: { id: '123456789', username: 'TestUser1', discriminator: '0001' } },
        { user: { id: '987654321', username: 'TestUser2', discriminator: '0002' } },
        { user: { id: '555555555', username: 'TestUser3', discriminator: '0003' } }
      ];
      
      // Mock all fetch calls
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/users/@me/channels')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 'dm-channel-123' })
          });
        }
        if (url.includes('/guilds') && url.includes('/members')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockMembers
          });
        }
        if (url.includes('/messages')) {
          return Promise.resolve({ 
            ok: true,
            json: async () => ({ id: 'message-sent' })
          });
        }
        return Promise.resolve({ ok: false });
      });
      
      const schedule: Schedule = {
        id: 'test-schedule',
        title: 'Test Event',
        dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
        createdBy: { id: 'user123', username: 'Creator' },
        authorId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        deadline: new Date(),
        reminderMentions: ['@TestUser1', '@TestUser2', '@nonexistent'],
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'open',
        notificationSent: false,
        totalResponses: 0
      };
      
      await notificationService.sendDeadlineReminder(schedule, '締切まで1時間');
      
      // Check that guild members were fetched
      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/guilds/guild123/members?limit=1000',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bot test-token'
          }
        })
      );
      
      // Check that message was sent with resolved mentions
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          body: expect.stringContaining('<@123456789>') // TestUser1's ID
        })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          body: expect.stringContaining('<@987654321>') // TestUser2's ID
        })
      );
    });

    it('should handle @everyone and @here without resolution', async () => {
      const schedule: Schedule = {
        id: 'test-schedule-2',
        title: 'Test Event 2',
        dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
        createdBy: { id: 'user123', username: 'Creator' },
        authorId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        deadline: new Date(),
        reminderMentions: ['@everyone', '@here'],
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'open',
        notificationSent: false,
        totalResponses: 0
      };
      
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/users/@me/channels')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 'dm-channel-123' })
          });
        }
        if (url.includes('/messages')) {
          return Promise.resolve({ 
            ok: true,
            json: async () => ({ id: 'message-sent' })
          });
        }
        return Promise.resolve({ ok: false });
      });
      
      await notificationService.sendDeadlineReminder(schedule, '締切まで1時間');
      
      // Should not fetch guild members for @everyone/@here
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/guilds/guild123/members'),
        expect.any(Object)
      );
      
      // Check that message contains @everyone and @here
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          body: expect.stringContaining('@everyone @here')
        })
      );
    });

    it('should handle already formatted mentions', async () => {
      const schedule: Schedule = {
        id: 'test-schedule-3',
        title: 'Test Event 3',
        dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
        createdBy: { id: 'user123', username: 'Creator' },
        authorId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        deadline: new Date(),
        reminderMentions: ['<@123456789>', '<@987654321>'],
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'open',
        notificationSent: false,
        totalResponses: 0
      };
      
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/users/@me/channels')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 'dm-channel-123' })
          });
        }
        if (url.includes('/messages')) {
          return Promise.resolve({ 
            ok: true,
            json: async () => ({ id: 'message-sent' })
          });
        }
        return Promise.resolve({ ok: false });
      });
      
      await notificationService.sendDeadlineReminder(schedule, '締切まで1時間');
      
      // Should not fetch guild members for already formatted mentions
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/guilds/guild123/members'),
        expect.any(Object)
      );
      
      // Check that message contains the mentions as-is
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          body: expect.stringContaining('<@123456789> <@987654321>')
        })
      );
    });

    it('should handle pagination when fetching large guilds', async () => {
      // First page of members
      const firstPage = Array.from({ length: 1000 }, (_, i) => ({
        user: { 
          id: `${1000000 + i}`, 
          username: `User${i}`, 
          discriminator: `${i.toString().padStart(4, '0')}` 
        }
      }));
      
      // Second page with our target user
      const secondPage = [
        { user: { id: '2000000', username: 'TargetUser', discriminator: '9999' } }
      ];
      
      let memberCallCount = 0;
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/users/@me/channels')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 'dm-channel-123' })
          });
        }
        if (url.includes('/guilds') && url.includes('/members')) {
          memberCallCount++;
          if (memberCallCount === 1) {
            return Promise.resolve({
              ok: true,
              json: async () => firstPage
            });
          } else if (memberCallCount === 2) {
            return Promise.resolve({
              ok: true,
              json: async () => secondPage
            });
          }
        }
        if (url.includes('/messages')) {
          return Promise.resolve({ 
            ok: true,
            json: async () => ({ id: 'message-sent' })
          });
        }
        return Promise.resolve({ ok: false });
      });
      
      const schedule: Schedule = {
        id: 'test-schedule-4',
        title: 'Test Event 4',
        dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
        createdBy: { id: 'user123', username: 'Creator' },
        authorId: 'user123',
        channelId: 'channel123',
        guildId: 'guild456',
        deadline: new Date(),
        reminderMentions: ['@TargetUser'],
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'open',
        notificationSent: false,
        totalResponses: 0
      };
      
      await notificationService.sendDeadlineReminder(schedule, '締切まで1時間');
      
      // Should have made 2 member fetch requests
      expect(memberCallCount).toBe(2);
      
      // Check that second request included 'after' parameter
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`after=${firstPage[999].user.id}`),
        expect.any(Object)
      );
      
      // Check that message contains resolved mention
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          body: expect.stringContaining('<@2000000>') // TargetUser's ID
        })
      );
    });

    it('should handle mixed mention formats', async () => {
      const mockMembers = [
        { user: { id: '111111111', username: 'Alice', discriminator: '0001' } },
        { user: { id: '222222222', username: 'Bob', discriminator: '0002' } }
      ];
      
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/guilds') && url.includes('/members')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockMembers
          });
        }
        if (url.includes('/messages')) {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({ ok: false });
      });
      
      const schedule: Schedule = {
        id: 'test-schedule-5',
        title: 'Test Event 5',
        dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
        createdBy: { id: 'user123', username: 'Creator' },
        authorId: 'user123',
        channelId: 'channel123',
        guildId: 'guild789',
        deadline: new Date(),
        reminderMentions: [
          '@everyone',
          '@Alice',
          '<@333333333>',
          'Bob', // Without @ prefix
          '@NonExistentUser'
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'open',
        notificationSent: false,
        totalResponses: 0
      };
      
      await notificationService.sendDeadlineReminder(schedule, '締切まで1時間');
      
      // Check that message contains all resolved mentions
      const messageCall = (global.fetch as any).mock.calls.find((call: any[]) => 
        call[0].includes('/messages')
      );
      
      expect(messageCall).toBeDefined();
      const body = JSON.parse(messageCall[1].body);
      
      expect(body.content).toContain('@everyone');
      expect(body.content).toContain('<@111111111>'); // Alice
      expect(body.content).toContain('<@333333333>'); // Already formatted
      expect(body.content).toContain('<@222222222>'); // Bob
      expect(body.content).toContain('@NonExistentUser'); // Kept as fallback
    });
  });
});
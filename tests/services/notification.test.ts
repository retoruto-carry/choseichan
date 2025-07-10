import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '../../src/services/notification';
import { StorageService } from '../../src/services/storage-v2';
import { Schedule, ScheduleSummary } from '../../src/types/schedule';

// Mock fetch globally
global.fetch = vi.fn();

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockStorage: StorageService;
  const mockToken = 'test-discord-token';
  const mockAppId = 'test-app-id';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock storage
    mockStorage = {
      getScheduleSummary: vi.fn(),
      saveSchedule: vi.fn(),
    } as any;
    
    notificationService = new NotificationService(mockStorage, mockToken, mockAppId);
  });


  describe('sendDeadlineReminder', () => {
    it('should send reminder to channel', async () => {
      const schedule: Schedule = {
        id: 'test-schedule',
        title: 'Test Event',
        dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
        createdBy: { id: 'user123', username: 'TestUser' },
        authorId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        messageId: 'message123',
        deadline: new Date('2024-12-25T10:00:00Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'open',
        notificationSent: false,
        reminderSent: false,
        totalResponses: 5
      };
      
      // Mock channel message sending
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'channel-message-123' })
      });

      await notificationService.sendDeadlineReminder(schedule);

      // Verify channel message was sent
      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/channels/channel123/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bot ${mockToken}`
          }),
          body: expect.stringContaining('締切リマインダー')
        })
      );
    });


    it('should skip if no deadline', async () => {
      const schedule: Schedule = {
        id: 'test-schedule',
        title: 'Test Event',
        dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
        createdBy: { id: 'user123', username: 'TestUser' },
        authorId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'open',
        notificationSent: false
      };

      await notificationService.sendDeadlineReminder(schedule);

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('sendSummaryMessage', () => {
    it('should send summary message with results', async () => {
      const scheduleId = 'test-schedule';
      const guildId = 'guild123';
      
      const mockSummary: ScheduleSummary = {
        schedule: {
          id: scheduleId,
          title: 'Test Event',
          dates: [
            { id: 'date1', datetime: '2024-12-25 19:00' },
            { id: 'date2', datetime: '2024-12-26 19:00' }
          ],
          createdBy: { id: 'user123', username: 'TestUser' },
          authorId: 'user123',
          channelId: 'channel123',
          guildId: guildId,
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'closed',
          notificationSent: false
        },
        responseCounts: {
          'date1': { yes: 3, maybe: 1, no: 1, total: 5 },
          'date2': { yes: 4, maybe: 0, no: 1, total: 5 }
        },
        userResponses: [
          {
            scheduleId,
            userId: 'user1',
            userName: 'User1',
            responses: [
              { dateId: 'date1', status: 'yes' },
              { dateId: 'date2', status: 'yes' }
            ],
            updatedAt: new Date()
          }
        ],
        bestDateId: 'date2'
      };

      (mockStorage.getScheduleSummary as any).mockResolvedValueOnce(mockSummary);
      
      // Mock message sending
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'summary-message-123' })
      });

      await notificationService.sendSummaryMessage(scheduleId, guildId);

      expect(mockStorage.getScheduleSummary).toHaveBeenCalledWith(scheduleId, guildId);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/channels/channel123/messages',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('締め切られました')
        })
      );
    });
  });

  describe('sendPRMessage', () => {
    it('should send PR message with message reference after delay', async () => {
      vi.useFakeTimers();
      
      const schedule: Schedule = {
        id: 'test-schedule',
        title: 'Test Event',
        dates: [
          { id: 'date1', datetime: '2024-12-25 19:00' },
          { id: 'date2', datetime: '2024-12-26 19:00' }
        ],
        createdBy: { id: 'user123', username: 'TestUser' },
        authorId: 'user123',
        channelId: 'channel123',
        guildId: 'guild123',
        messageId: 'message123',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'closed',
        notificationSent: false
      };

      // Mock message sending
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'pr-message-123' })
      });

      // Start the PR message sending (which includes the delay)
      const sendPromise = notificationService.sendPRMessage(schedule);

      // Should not be called immediately
      expect(global.fetch).not.toHaveBeenCalled();

      // Fast forward 5 seconds and wait for the promise
      await vi.advanceTimersByTimeAsync(5000);
      await sendPromise;

      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/channels/channel123/messages',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('message_reference')
        })
      );
      
      // Check that message reference is included
      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.message_reference.message_id).toBe('message123');
      
      // Check PR message content
      expect(body.content).toContain('[PR] 画像を貼るだけでリンク集/個人HPを作ろう！[ピクページ](https://piku.page/)');
      expect(body.content).toContain('https://x.com/retoruto_carry/status/1796123557090517067');
      expect(body.content).toContain('調整ちゃんは無料で運営されています。');
      
      vi.useRealTimers();
    });
  });
});
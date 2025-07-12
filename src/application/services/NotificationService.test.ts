import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Schedule, ScheduleStatus } from '../../domain/entities/Schedule';
import { ScheduleDate } from '../../domain/entities/ScheduleDate';
import { User } from '../../domain/entities/User';
import type {
  IResponseRepository,
  IScheduleRepository,
} from '../../domain/repositories/interfaces';
import type { ScheduleSummaryResponse } from '../dto/ScheduleDto';
import { GetScheduleSummaryUseCase } from '../usecases/schedule/GetScheduleSummaryUseCase';
import { NotificationService } from './NotificationService';

// Mock fetch globally
global.fetch = vi.fn();

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockScheduleRepository: IScheduleRepository;
  let mockResponseRepository: IResponseRepository;
  let mockGetScheduleSummaryUseCase: GetScheduleSummaryUseCase;
  const mockToken = 'test-discord-token';
  const mockAppId = 'test-app-id';

  const mockSchedule = Schedule.create({
    id: 'test-schedule',
    guildId: 'guild123',
    channelId: 'channel123',
    messageId: 'message123',
    title: 'Test Event',
    description: 'Test Description',
    dates: [
      ScheduleDate.create('date1', '2024-12-25 19:00'),
      ScheduleDate.create('date2', '2024-12-26 19:00'),
    ],
    createdBy: User.create('user123', 'TestUser'),
    authorId: 'user123',
    deadline: new Date('2024-12-25T10:00:00Z'),
    reminderTimings: ['1d', '1h'],
    reminderMentions: [],
    remindersSent: [],
    status: ScheduleStatus.OPEN,
    notificationSent: false,
    totalResponses: 5,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockScheduleRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByChannel: vi.fn(),
      findByDeadlineRange: vi.fn(),
      delete: vi.fn(),
      findByMessageId: vi.fn(),
      countByGuild: vi.fn(),
      updateReminders: vi.fn(),
    };

    mockResponseRepository = {
      save: vi.fn(),
      findByUser: vi.fn(),
      findByScheduleId: vi.fn(),
      delete: vi.fn(),
      deleteBySchedule: vi.fn(),
      getScheduleSummary: vi.fn(),
    };

    mockGetScheduleSummaryUseCase = new GetScheduleSummaryUseCase(
      mockScheduleRepository,
      mockResponseRepository
    );

    notificationService = new NotificationService(
      mockScheduleRepository,
      mockResponseRepository,
      mockGetScheduleSummaryUseCase,
      mockToken,
      mockAppId
    );
  });

  describe('sendDeadlineReminder', () => {
    it('should send reminder to channel', async () => {
      // Mock channel message sending
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'channel-message-123' }),
      });

      await notificationService.sendDeadlineReminder(mockSchedule);

      // Verify channel message was sent
      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/channels/channel123/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bot ${mockToken}`,
          }),
          body: expect.stringContaining('締切リマインダー'),
        })
      );
    });

    it('should skip if no deadline', async () => {
      const scheduleWithoutDeadline = Schedule.create({
        id: 'test-schedule',
        guildId: 'guild123',
        channelId: 'channel123',
        title: 'Test Event',
        description: 'Test Description',
        dates: [ScheduleDate.create('date1', '2024-12-25 19:00')],
        createdBy: User.create('user123', 'TestUser'),
        authorId: 'user123',
        reminderTimings: [],
        reminderMentions: [],
        remindersSent: [],
        status: ScheduleStatus.OPEN,
        notificationSent: false,
        totalResponses: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });

      await notificationService.sendDeadlineReminder(scheduleWithoutDeadline);

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('sendSummaryMessage', () => {
    it('should send summary message with results', async () => {
      const scheduleId = 'test-schedule';
      const guildId = 'guild123';

      const mockSummaryResponse: ScheduleSummaryResponse = {
        schedule: {
          id: scheduleId,
          guildId: guildId,
          channelId: 'channel123',
          messageId: 'message123',
          title: 'Test Event',
          description: 'Test Description',
          dates: [
            { id: 'date1', datetime: '2024-12-25 19:00' },
            { id: 'date2', datetime: '2024-12-26 19:00' },
          ],
          createdBy: { id: 'user123', username: 'TestUser' },
          authorId: 'user123',
          deadline: '2024-12-25T10:00:00Z',
          reminderTimings: ['1d', '1h'],
          reminderMentions: [],
          remindersSent: [],
          status: 'closed',
          notificationSent: false,
          totalResponses: 5,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        responses: [],
        responseCounts: {
          date1: { yes: 3, maybe: 1, no: 1 },
          date2: { yes: 4, maybe: 0, no: 1 },
        },
        totalResponseUsers: 5,
        bestDateId: 'date2',
        statistics: {
          overallParticipation: {
            fullyAvailable: 2,
            partiallyAvailable: 2,
            unavailable: 1,
          },
          optimalDates: {
            optimalDateId: 'date2',
            alternativeDateIds: ['date1'],
            scores: { date1: 3, date2: 4 },
          },
        },
      };

      vi.spyOn(mockGetScheduleSummaryUseCase, 'execute').mockResolvedValueOnce({
        success: true,
        summary: mockSummaryResponse,
      });

      // Mock message sending
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'summary-message-123' }),
      });

      await notificationService.sendSummaryMessage(scheduleId, guildId);

      expect(mockGetScheduleSummaryUseCase.execute).toHaveBeenCalledWith(scheduleId, guildId);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/channels/channel123/messages',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('締め切られました'),
        })
      );
    });
  });

  describe('sendPRMessage', () => {
    it('should send PR message with message reference after delay', async () => {
      vi.useFakeTimers();

      // Mock message sending
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'pr-message-123' }),
      });

      // Start the PR message sending (which includes the delay)
      const sendPromise = notificationService.sendPRMessage(mockSchedule);

      // Should not be called immediately
      expect(global.fetch).not.toHaveBeenCalled();

      // Fast forward 5 seconds and wait for the promise
      await vi.advanceTimersByTimeAsync(5000);
      await sendPromise;

      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/channels/channel123/messages',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('message_reference'),
        })
      );

      // Check that message reference is included
      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.message_reference.message_id).toBe('message123');

      // Check PR message content
      expect(body.content).toContain(
        '[PR] 画像を貼るだけでリンク集/個人HPを作ろう！[ピクページ](https://piku.page/)'
      );
      expect(body.content).toContain('調整ちゃんは無料で運営されています');

      vi.useRealTimers();
    });
  });

  describe('Mention Resolution', () => {
    it('should fetch and cache guild members', async () => {
      const mockMembers = [
        { user: { id: '123456789', username: 'TestUser1', discriminator: '0001' } },
        { user: { id: '987654321', username: 'TestUser2', discriminator: '0002' } },
        { user: { id: '555555555', username: 'TestUser3', discriminator: '0003' } },
      ];

      // Mock all fetch calls
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/users/@me/channels')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 'dm-channel-123' }),
          });
        }
        if (url.includes('/guilds') && url.includes('/members')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockMembers,
          });
        }
        if (url.includes('/messages')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 'message-sent' }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      const scheduleWithMentions = Schedule.create({
        id: 'test-schedule',
        guildId: 'guild123',
        channelId: 'channel123',
        messageId: 'message123',
        title: 'Test Event',
        description: 'Test Description',
        dates: [
          ScheduleDate.create('date1', '2024-12-25 19:00'),
          ScheduleDate.create('date2', '2024-12-26 19:00'),
        ],
        createdBy: User.create('user123', 'TestUser'),
        authorId: 'user123',
        deadline: new Date('2024-12-25T10:00:00Z'),
        reminderTimings: ['1d', '1h'],
        reminderMentions: ['@TestUser1', '@TestUser2', '@nonexistent'],
        remindersSent: [],
        status: ScheduleStatus.OPEN,
        notificationSent: false,
        totalResponses: 5,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });

      await notificationService.sendDeadlineReminder(scheduleWithMentions, '締切まで1時間');

      // Check that guild members were fetched
      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/guilds/guild123/members?limit=1000',
        expect.objectContaining({
          headers: {
            Authorization: 'Bot test-discord-token',
          },
        })
      );

      // Check that message was sent with resolved mentions
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          body: expect.stringContaining('<@123456789>'), // TestUser1's ID
        })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          body: expect.stringContaining('<@987654321>'), // TestUser2's ID
        })
      );
    });

    it('should handle @everyone and @here without resolution', async () => {
      const scheduleWithSpecialMentions = Schedule.create({
        id: 'test-schedule',
        guildId: 'guild123',
        channelId: 'channel123',
        messageId: 'message123',
        title: 'Test Event',
        description: 'Test Description',
        dates: [
          ScheduleDate.create('date1', '2024-12-25 19:00'),
          ScheduleDate.create('date2', '2024-12-26 19:00'),
        ],
        createdBy: User.create('user123', 'TestUser'),
        authorId: 'user123',
        deadline: new Date('2024-12-25T10:00:00Z'),
        reminderTimings: ['1d', '1h'],
        reminderMentions: ['@everyone', '@here'],
        remindersSent: [],
        status: ScheduleStatus.OPEN,
        notificationSent: false,
        totalResponses: 5,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/users/@me/channels')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 'dm-channel-123' }),
          });
        }
        if (url.includes('/messages')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 'message-sent' }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      await notificationService.sendDeadlineReminder(scheduleWithSpecialMentions, '締切まで1時間');

      // Should not fetch guild members for @everyone/@here
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/guilds/guild123/members'),
        expect.any(Object)
      );

      // Check that message contains @everyone and @here
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          body: expect.stringContaining('@everyone @here'),
        })
      );
    });

    it('should handle already formatted mentions', async () => {
      const scheduleWithFormattedMentions = Schedule.create({
        id: 'test-schedule',
        guildId: 'guild123',
        channelId: 'channel123',
        messageId: 'message123',
        title: 'Test Event',
        description: 'Test Description',
        dates: [
          ScheduleDate.create('date1', '2024-12-25 19:00'),
          ScheduleDate.create('date2', '2024-12-26 19:00'),
        ],
        createdBy: User.create('user123', 'TestUser'),
        authorId: 'user123',
        deadline: new Date('2024-12-25T10:00:00Z'),
        reminderTimings: ['1d', '1h'],
        reminderMentions: ['<@123456789>', '<@987654321>'],
        remindersSent: [],
        status: ScheduleStatus.OPEN,
        notificationSent: false,
        totalResponses: 5,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/users/@me/channels')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 'dm-channel-123' }),
          });
        }
        if (url.includes('/messages')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ id: 'message-sent' }),
          });
        }
        return Promise.resolve({ ok: false });
      });

      await notificationService.sendDeadlineReminder(
        scheduleWithFormattedMentions,
        '締切まで1時間'
      );

      // Should not fetch guild members for already formatted mentions
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/guilds/guild123/members'),
        expect.any(Object)
      );

      // Check that message contains the mentions as-is
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          body: expect.stringContaining('<@123456789> <@987654321>'),
        })
      );
    });

    it('should handle mixed mention formats', async () => {
      const mockMembers = [
        { user: { id: '111111111', username: 'Alice', discriminator: '0001' } },
        { user: { id: '222222222', username: 'Bob', discriminator: '0002' } },
      ];

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/guilds') && url.includes('/members')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockMembers,
          });
        }
        if (url.includes('/messages')) {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({ ok: false });
      });

      const scheduleWithMixedMentions = Schedule.create({
        id: 'test-schedule',
        guildId: 'guild123',
        channelId: 'channel123',
        messageId: 'message123',
        title: 'Test Event',
        description: 'Test Description',
        dates: [
          ScheduleDate.create('date1', '2024-12-25 19:00'),
          ScheduleDate.create('date2', '2024-12-26 19:00'),
        ],
        createdBy: User.create('user123', 'TestUser'),
        authorId: 'user123',
        deadline: new Date('2024-12-25T10:00:00Z'),
        reminderTimings: ['1d', '1h'],
        reminderMentions: [
          '@everyone',
          '@Alice',
          '<@333333333>',
          'Bob', // Without @ prefix
          '@NonExistentUser',
        ],
        remindersSent: [],
        status: ScheduleStatus.OPEN,
        notificationSent: false,
        totalResponses: 5,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });

      await notificationService.sendDeadlineReminder(scheduleWithMixedMentions, '締切まで1時間');

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

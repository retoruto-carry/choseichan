import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Schedule, ScheduleStatus } from '../../domain/entities/Schedule';
import { ScheduleDate } from '../../domain/entities/ScheduleDate';
import { User } from '../../domain/entities/User';
import type {
  IResponseRepository,
  IScheduleRepository,
} from '../../domain/repositories/interfaces';
import type { ScheduleSummaryResponse } from '../dto/ScheduleDto';
import type { IDiscordApiPort } from '../ports/DiscordApiPort';
import type { ILogger } from '../ports/LoggerPort';
import type { BackgroundExecutorPort } from '../ports/BackgroundExecutorPort';
import { GetScheduleSummaryUseCase } from '../usecases/schedule/GetScheduleSummaryUseCase';
import { NotificationService } from './NotificationService';

// Mock fetch globally
global.fetch = vi.fn();

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockLogger: ILogger;
  let mockDiscordApi: IDiscordApiPort;
  let mockScheduleRepository: IScheduleRepository;
  let mockResponseRepository: IResponseRepository;
  let mockGetScheduleSummaryUseCase: GetScheduleSummaryUseCase;
  let mockBackgroundExecutor: BackgroundExecutorPort;
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

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    mockDiscordApi = {
      updateMessage: vi.fn(),
      sendMessage: vi.fn(),
      sendNotification: vi.fn(),
      fetchGuildMembers: vi.fn(),
    };

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
    vi.spyOn(mockGetScheduleSummaryUseCase, 'execute').mockResolvedValue({
      success: true,
      summary: {
        schedule: {
          id: mockSchedule.id,
          guildId: mockSchedule.guildId,
          channelId: mockSchedule.channelId,
          messageId: mockSchedule.messageId,
          title: mockSchedule.title,
          description: mockSchedule.description,
          dates: mockSchedule.dates.map((d) => ({ id: d.id, datetime: d.datetime })),
          createdBy: { id: mockSchedule.createdBy.id, username: mockSchedule.createdBy.username },
          authorId: mockSchedule.authorId,
          deadline: mockSchedule.deadline?.toISOString(),
          reminderTimings: mockSchedule.reminderTimings || [],
          reminderMentions: mockSchedule.reminderMentions || [],
          remindersSent: mockSchedule.remindersSent || [],
          status: mockSchedule.status,
          notificationSent: mockSchedule.notificationSent,
          totalResponses: mockSchedule.totalResponses,
          createdAt: mockSchedule.createdAt.toISOString(),
          updatedAt: mockSchedule.updatedAt.toISOString(),
        },
        responses: [],
        responseCounts: {},
        totalResponseUsers: 0,
        bestDateId: undefined,
        statistics: {
          overallParticipation: {
            fullyAvailable: 0,
            partiallyAvailable: 0,
            unavailable: 0,
          },
          optimalDates: {
            alternativeDateIds: [],
            scores: {},
          },
        },
      } as ScheduleSummaryResponse,
    });

    mockBackgroundExecutor = {
      execute: vi.fn(),
    };

    notificationService = new NotificationService(
      mockLogger,
      mockDiscordApi,
      mockScheduleRepository,
      mockResponseRepository,
      mockGetScheduleSummaryUseCase,
      mockToken,
      mockAppId,
      mockBackgroundExecutor
    );
  });

  describe('sendDeadlineReminder', () => {
    it('should send reminder to channel', async () => {
      await notificationService.sendDeadlineReminder(mockSchedule);

      expect(mockDiscordApi.sendMessage).toHaveBeenCalledWith(
        'channel123',
        expect.objectContaining({
          content: expect.stringContaining('⏰ **締切リマインダー**'),
          embeds: expect.arrayContaining([
            expect.objectContaining({
              color: 0xffcc00,
              fields: expect.any(Array),
            }),
          ]),
        }),
        mockToken
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

      expect(mockDiscordApi.sendMessage).not.toHaveBeenCalled();
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

      await notificationService.sendSummaryMessage(scheduleId, guildId);

      expect(mockGetScheduleSummaryUseCase.execute).toHaveBeenCalledWith(scheduleId, guildId);

      expect(mockDiscordApi.sendMessage).toHaveBeenCalledWith(
        'channel123',
        expect.objectContaining({
          content: expect.stringContaining('締め切られました'),
          embeds: expect.any(Array),
        }),
        mockToken
      );
    });
  });

  describe('sendPRMessage', () => {
    it('should schedule PR message as background task', async () => {
      notificationService.sendPRMessage(mockSchedule);

      // BackgroundExecutor が呼ばれることを確認
      expect(mockBackgroundExecutor.execute).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle message without messageId', async () => {
      const scheduleWithoutMessageId = Schedule.create({
        id: 'test-schedule',
        guildId: 'guild123',
        channelId: 'channel123',
        messageId: undefined, // messageIdなし
        title: 'Test Event',
        description: 'Test Description',
        dates: [
          ScheduleDate.create('date1', '2024-12-25 19:00'),
          ScheduleDate.create('date2', '2024-12-26 19:00'),
        ],
        createdBy: User.create('user123', 'TestUser'),
        authorId: 'user123',
        deadline: new Date('2024-12-25T10:00:00Z'),
        reminderTimings: ['8h'],
        reminderMentions: ['@here'],
        remindersSent: [],
        status: ScheduleStatus.OPEN,
        notificationSent: false,
        totalResponses: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      });

      notificationService.sendPRMessage(scheduleWithoutMessageId);

      expect(mockBackgroundExecutor.execute).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should execute the task with correct message content', async () => {
      // BackgroundExecutor の実行をモックして、実際にタスクを実行
      vi.mocked(mockBackgroundExecutor.execute).mockImplementation(async (task) => {
        await task();
      });

      notificationService.sendPRMessage(mockSchedule);

      expect(mockDiscordApi.sendMessage).toHaveBeenCalledWith(
        'channel123',
        expect.objectContaining({
          content: expect.stringContaining('ピクページ'),
          message_reference: {
            message_id: 'message123',
          },
        }),
        mockToken
      );
    });
  });

  describe('Mention Resolution', () => {
    it('should fetch and cache guild members', async () => {
      const mockMembers = [
        { user: { id: '123456789', username: 'TestUser1', discriminator: '0001' } },
        { user: { id: '987654321', username: 'TestUser2', discriminator: '0002' } },
        { user: { id: '555555555', username: 'TestUser3', discriminator: '0003' } },
      ];

      // Mock fetchGuildMembers
      vi.mocked(mockDiscordApi.fetchGuildMembers).mockResolvedValue(mockMembers);

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
      expect(mockDiscordApi.fetchGuildMembers).toHaveBeenCalledWith('guild123', mockToken);

      // Check that message was sent with resolved mentions
      expect(mockDiscordApi.sendMessage).toHaveBeenCalledWith(
        'channel123',
        expect.objectContaining({
          content: expect.stringContaining('<@123456789>'), // TestUser1's ID
        }),
        mockToken
      );
      expect(mockDiscordApi.sendMessage).toHaveBeenCalledWith(
        'channel123',
        expect.objectContaining({
          content: expect.stringContaining('<@987654321>'), // TestUser2's ID
        }),
        mockToken
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

      await notificationService.sendDeadlineReminder(scheduleWithSpecialMentions, '締切まで1時間');

      // Should not fetch guild members for @everyone/@here
      expect(mockDiscordApi.fetchGuildMembers).not.toHaveBeenCalled();

      // Check that message contains @everyone and @here
      expect(mockDiscordApi.sendMessage).toHaveBeenCalledWith(
        'channel123',
        expect.objectContaining({
          content: expect.stringContaining('@everyone @here'),
        }),
        mockToken
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

      await notificationService.sendDeadlineReminder(
        scheduleWithFormattedMentions,
        '締切まで1時間'
      );

      // Should not fetch guild members for already formatted mentions
      expect(mockDiscordApi.fetchGuildMembers).not.toHaveBeenCalled();

      // Check that message contains the mentions as-is
      expect(mockDiscordApi.sendMessage).toHaveBeenCalledWith(
        'channel123',
        expect.objectContaining({
          content: expect.stringContaining('<@123456789> <@987654321>'),
        }),
        mockToken
      );
    });

    it('should handle mixed mention formats', async () => {
      const mockMembers = [
        { user: { id: '111111111', username: 'Alice', discriminator: '0001' } },
        { user: { id: '222222222', username: 'Bob', discriminator: '0002' } },
      ];

      // Mock fetchGuildMembers for mixed mentions
      vi.mocked(mockDiscordApi.fetchGuildMembers).mockResolvedValue(mockMembers);

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
      expect(mockDiscordApi.sendMessage).toHaveBeenCalledWith(
        'channel123',
        expect.objectContaining({
          content: expect.stringMatching(
            /@everyone.*<@111111111>.*<@333333333>.*<@222222222>.*@NonExistentUser/
          ),
        }),
        mockToken
      );
    });
  });
});

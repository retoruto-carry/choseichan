import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IResponseRepository,
  IScheduleRepository,
} from '../../../domain/repositories/interfaces';
import type { DomainResponse, DomainSchedule } from '../../../domain/types/DomainTypes';
import { GetScheduleSummaryUseCase } from './GetScheduleSummaryUseCase';

describe('GetScheduleSummaryUseCase', () => {
  let useCase: GetScheduleSummaryUseCase;
  let mockScheduleRepository: IScheduleRepository;
  let mockResponseRepository: IResponseRepository;

  const mockSchedule: DomainSchedule = {
    id: 'schedule-123',
    guildId: 'guild-123',
    channelId: 'channel-123',
    messageId: 'msg-123',
    title: 'Test Schedule',
    description: 'Test description',
    dates: [
      { id: 'date-1', datetime: '2024/01/20 19:00' },
      { id: 'date-2', datetime: '2024/01/21 19:00' },
      { id: 'date-3', datetime: '2024/01/22 19:00' },
    ],
    deadline: new Date('2024-01-19'),
    createdBy: { id: 'user-123', username: 'TestUser' },
    authorId: 'user-123',
    status: 'open',
    reminderTimings: ['1d', '1h'],
    reminderMentions: ['@here'],
    remindersSent: [],
    notificationSent: false,
    totalResponses: 3,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockResponses: DomainResponse[] = [
    {
      scheduleId: 'schedule-123',
      userId: 'user-456',
      username: 'User1',
      dateStatuses: {
        'date-1': 'ok',
        'date-2': 'ok',
        'date-3': 'maybe',
      },
      updatedAt: new Date('2024-01-02'),
    },
    {
      scheduleId: 'schedule-123',
      userId: 'user-789',
      username: 'User2',
      dateStatuses: {
        'date-1': 'ok',
        'date-2': 'maybe',
        'date-3': 'ng',
      },
      updatedAt: new Date('2024-01-03'),
    },
    {
      scheduleId: 'schedule-123',
      userId: 'user-999',
      username: 'User3',
      dateStatuses: {
        'date-1': 'ng',
        'date-2': 'ok',
        'date-3': 'ok',
      },
      updatedAt: new Date('2024-01-04'),
    },
  ];

  beforeEach(() => {
    mockScheduleRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByChannel: vi.fn(),
      findByAuthor: vi.fn(),
      findByDeadlineRange: vi.fn(),
      delete: vi.fn(),
      findByMessageId: vi.fn(),
      countByGuild: vi.fn(),
      updateReminders: vi.fn(),
    } as any;

    mockResponseRepository = {
      save: vi.fn(),
      findByUser: vi.fn(),
      findByScheduleId: vi.fn(),
      delete: vi.fn(),
      deleteBySchedule: vi.fn(),
      getScheduleSummary: vi.fn(),
    };

    useCase = new GetScheduleSummaryUseCase(mockScheduleRepository, mockResponseRepository);
  });

  describe('execute', () => {
    it('should get schedule summary successfully', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockResponseRepository.findByScheduleId).mockResolvedValueOnce(mockResponses);

      const result = await useCase.execute('schedule-123', 'guild-123');

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();

      // Verify schedule data
      expect(result.summary?.schedule).toMatchObject({
        id: 'schedule-123',
        title: 'Test Schedule',
        description: 'Test description',
        status: 'open',
        totalResponses: 3,
      });

      // Verify responses
      expect(result.summary?.responses).toHaveLength(3);
      expect(result.summary?.responses[0]).toMatchObject({
        userId: 'user-456',
        username: 'User1',
      });

      // Verify response counts
      expect(result.summary?.responseCounts).toEqual({
        'date-1': { yes: 2, maybe: 0, no: 1 },
        'date-2': { yes: 2, maybe: 1, no: 0 },
        'date-3': { yes: 1, maybe: 1, no: 1 },
      });

      // Verify statistics
      expect(result.summary?.totalResponseUsers).toBe(3);
      expect(result.summary?.bestDateId).toBe('date-2'); // Has most "yes" votes (tied with date-1)

      expect(result.summary?.statistics?.overallParticipation).toEqual({
        fullyAvailable: 0, // No one is available for all dates
        partiallyAvailable: 3, // All users are partially available
        unavailable: 0,
      });

      expect(mockScheduleRepository.findById).toHaveBeenCalledWith('schedule-123', 'guild-123');
      expect(mockResponseRepository.findByScheduleId).toHaveBeenCalledWith(
        'schedule-123',
        'guild-123'
      );
    });

    it('should return error when schedule not found', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(null);

      const result = await useCase.execute('schedule-123', 'guild-123');

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['指定されたスケジュールが見つかりません']);
      expect(mockResponseRepository.findByScheduleId).not.toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const testCases = [
        {
          scheduleId: '',
          guildId: 'guild-123',
          expectedError: 'スケジュールIDとGuild IDが必要です',
        },
        {
          scheduleId: 'schedule-123',
          guildId: '',
          expectedError: 'スケジュールIDとGuild IDが必要です',
        },
        {
          scheduleId: '  ',
          guildId: '  ',
          expectedError: 'スケジュールIDとGuild IDが必要です',
        },
      ];

      for (const { scheduleId, guildId, expectedError } of testCases) {
        const result = await useCase.execute(scheduleId, guildId);
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors).toContain(expectedError);
      }
    });

    it('should handle schedule with no responses', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockResponseRepository.findByScheduleId).mockResolvedValueOnce([]);

      const result = await useCase.execute('schedule-123', 'guild-123');

      expect(result.success).toBe(true);
      expect(result.summary?.responses).toHaveLength(0);
      expect(result.summary?.totalResponseUsers).toBe(0);

      // All counts should be zero
      expect(result.summary?.responseCounts).toEqual({
        'date-1': { yes: 0, maybe: 0, no: 0 },
        'date-2': { yes: 0, maybe: 0, no: 0 },
        'date-3': { yes: 0, maybe: 0, no: 0 },
      });

      expect(result.summary?.statistics?.overallParticipation).toEqual({
        fullyAvailable: 0,
        partiallyAvailable: 0,
        unavailable: 0,
      });
    });

    it('should handle responses with legacy status format', async () => {
      const legacyResponses: DomainResponse[] = [
        {
          scheduleId: 'schedule-123',
          userId: 'user-456',
          username: 'User1',
          dateStatuses: {
            'date-1': 'ok',
            'date-2': 'maybe',
            'date-3': 'ng',
          },
          updatedAt: new Date('2024-01-02'),
        },
      ];

      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockResponseRepository.findByScheduleId).mockResolvedValueOnce(legacyResponses);

      const result = await useCase.execute('schedule-123', 'guild-123');

      expect(result.success).toBe(true);

      // Should convert legacy formats
      expect(result.summary?.responses[0].dateStatuses).toEqual({
        'date-1': 'ok',
        'date-2': 'maybe',
        'date-3': 'ng',
      });
    });

    it('should calculate best date correctly', async () => {
      const responsesForBestDate: DomainResponse[] = [
        {
          scheduleId: 'schedule-123',
          userId: 'user-1',
          username: 'User1',
          dateStatuses: {
            'date-1': 'ok',
            'date-2': 'ng',
            'date-3': 'ng',
          },
          updatedAt: new Date('2024-01-02'),
        },
        {
          scheduleId: 'schedule-123',
          userId: 'user-2',
          username: 'User2',
          dateStatuses: {
            'date-1': 'ok',
            'date-2': 'ok',
            'date-3': 'ng',
          },
          updatedAt: new Date('2024-01-02'),
        },
        {
          scheduleId: 'schedule-123',
          userId: 'user-3',
          username: 'User3',
          dateStatuses: {
            'date-1': 'maybe',
            'date-2': 'ok',
            'date-3': 'ok',
          },
          updatedAt: new Date('2024-01-02'),
        },
      ];

      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockResponseRepository.findByScheduleId).mockResolvedValueOnce(
        responsesForBestDate
      );

      const result = await useCase.execute('schedule-123', 'guild-123');

      // date-1: 2 ok + 1 maybe = 2*2 + 1*1 = 5 points
      // date-2: 2 ok = 2*2 = 4 points
      // date-3: 1 ok = 1*2 = 2 points
      expect(result.summary?.bestDateId).toBe('date-1');

      // date-2 should be an alternative (4/5 = 80%)
      expect(result.summary?.statistics?.optimalDates.alternativeDateIds).toContain('date-2');
      expect(result.summary?.statistics?.optimalDates.alternativeDateIds).not.toContain('date-3');
    });

    it('should handle fully available users', async () => {
      const fullyAvailableResponses: DomainResponse[] = [
        {
          scheduleId: 'schedule-123',
          userId: 'user-1',
          username: 'User1',
          dateStatuses: {
            'date-1': 'ok',
            'date-2': 'ok',
            'date-3': 'ok',
          },
          updatedAt: new Date('2024-01-02'),
        },
        {
          scheduleId: 'schedule-123',
          userId: 'user-2',
          username: 'User2',
          dateStatuses: {
            'date-1': 'ok',
            'date-2': 'maybe',
            'date-3': 'ng',
          },
          updatedAt: new Date('2024-01-02'),
        },
      ];

      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockResponseRepository.findByScheduleId).mockResolvedValueOnce(
        fullyAvailableResponses
      );

      const result = await useCase.execute('schedule-123', 'guild-123');

      expect(result.summary?.statistics?.overallParticipation).toEqual({
        fullyAvailable: 1,
        partiallyAvailable: 1,
        unavailable: 0,
      });
    });

    it('should handle unavailable users', async () => {
      const unavailableResponses: DomainResponse[] = [
        {
          scheduleId: 'schedule-123',
          userId: 'user-1',
          username: 'User1',
          dateStatuses: {
            'date-1': 'ng',
            'date-2': 'ng',
            'date-3': 'ng',
          },
          updatedAt: new Date('2024-01-02'),
        },
        {
          scheduleId: 'schedule-123',
          userId: 'user-2',
          username: 'User2',
          dateStatuses: {
            'date-1': 'maybe',
            'date-2': 'maybe',
            'date-3': 'ng',
          },
          updatedAt: new Date('2024-01-02'),
        },
      ];

      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockResponseRepository.findByScheduleId).mockResolvedValueOnce(
        unavailableResponses
      );

      const result = await useCase.execute('schedule-123', 'guild-123');

      expect(result.summary?.statistics?.overallParticipation).toEqual({
        fullyAvailable: 0,
        partiallyAvailable: 0,
        unavailable: 2,
      });
    });

    it('should handle repository errors', async () => {
      vi.mocked(mockScheduleRepository.findById).mockRejectedValueOnce(new Error('Database error'));

      const result = await useCase.execute('schedule-123', 'guild-123');

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('スケジュール概要の取得に失敗しました');
      expect(result.errors?.[0]).toContain('Database error');
    });

    it('should handle unexpected errors', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockResponseRepository.findByScheduleId).mockRejectedValueOnce('Unexpected error');

      const result = await useCase.execute('schedule-123', 'guild-123');

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('スケジュール概要の取得に失敗しました');
      expect(result.errors?.[0]).toContain('Unknown error');
    });

    it('should handle schedule without optional fields', async () => {
      const minimalSchedule: DomainSchedule = {
        ...mockSchedule,
        messageId: undefined,
        description: undefined,
        deadline: undefined,
        reminderTimings: undefined,
        reminderMentions: undefined,
        remindersSent: undefined,
      };

      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(minimalSchedule);
      vi.mocked(mockResponseRepository.findByScheduleId).mockResolvedValueOnce([]);

      const result = await useCase.execute('schedule-123', 'guild-123');

      expect(result.success).toBe(true);
      expect(result.summary?.schedule.description).toBeUndefined();
      expect(result.summary?.schedule.deadline).toBeUndefined();
      expect(result.summary?.schedule.reminderTimings).toBeUndefined();
    });

    it('should format dates correctly', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockResponseRepository.findByScheduleId).mockResolvedValueOnce(mockResponses);

      const result = await useCase.execute('schedule-123', 'guild-123');

      expect(result.summary?.schedule.deadline).toBe('2024-01-19T00:00:00.000Z');
      expect(result.summary?.schedule.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(result.summary?.schedule.updatedAt).toBe('2024-01-01T00:00:00.000Z');

      expect(result.summary?.responses[0].updatedAt).toBe('2024-01-02T00:00:00.000Z');
    });

    it('should handle unknown status values', async () => {
      const responsesWithUnknownStatus: DomainResponse[] = [
        {
          scheduleId: 'schedule-123',
          userId: 'user-456',
          username: 'User1',
          dateStatuses: {
            'date-1': 'unknown' as any,
            'date-2': 'invalid' as any,
            'date-3': '' as any,
          },
          updatedAt: new Date('2024-01-02'),
        },
      ];

      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockResponseRepository.findByScheduleId).mockResolvedValueOnce(
        responsesWithUnknownStatus
      );

      const result = await useCase.execute('schedule-123', 'guild-123');

      expect(result.success).toBe(true);

      // Unknown statuses should default to 'ng'
      expect(result.summary?.responses[0].dateStatuses).toEqual({
        'date-1': 'ng',
        'date-2': 'ng',
        'date-3': 'ng',
      });
    });
  });
});

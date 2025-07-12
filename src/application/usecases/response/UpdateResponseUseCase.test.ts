import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  IResponseRepository,
  IScheduleRepository,
} from '../../../domain/repositories/interfaces';
import type { ResponseDomainService } from '../../../domain/services/ResponseDomainService';
import type { DomainResponse, DomainSchedule } from '../../../domain/types/DomainTypes';
import { UpdateResponseUseCase } from './UpdateResponseUseCase';

describe('UpdateResponseUseCase', () => {
  let useCase: UpdateResponseUseCase;
  let mockScheduleRepository: IScheduleRepository;
  let mockResponseRepository: IResponseRepository;
  let _mockResponseDomainService: ResponseDomainService;

  const mockSchedule: DomainSchedule = {
    id: 'schedule-123',
    guildId: 'guild-123',
    channelId: 'channel-123',
    title: 'Test Schedule',
    dates: [
      { id: 'date-1', datetime: '2024/01/20 19:00' },
      { id: 'date-2', datetime: '2024/01/21 19:00' },
    ],
    createdBy: { id: 'user-123', username: 'TestUser' },
    authorId: 'user-123',
    status: 'open',
    notificationSent: false,
    totalResponses: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockResponse: DomainResponse = {
    scheduleId: 'schedule-123',
    userId: 'user-456',
    username: 'Responder',
    dateStatuses: {
      'date-1': 'ok',
      'date-2': 'maybe',
    },
    updatedAt: new Date('2024-01-02'),
  };

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
    } as any;

    useCase = new UpdateResponseUseCase(mockScheduleRepository, mockResponseRepository);
  });

  describe('execute', () => {
    it('should update response successfully', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockResponseRepository.findByUser).mockResolvedValueOnce(mockResponse);
      vi.mocked(mockResponseRepository.save).mockResolvedValueOnce(undefined);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        userId: 'user-456',
        responses: [
          { dateId: 'date-1', status: 'ng' }, // Changed
          { dateId: 'date-2', status: 'ok' }, // Changed
        ],
        guildId: 'guild-123',
      });

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response?.dateStatuses).toEqual({
        'date-1': 'ng',
        'date-2': 'ok',
      });

      const savedResponse = vi.mocked(mockResponseRepository.save).mock.calls[0][0];
      expect(savedResponse.dateStatuses).toEqual({
        'date-1': 'ng',
        'date-2': 'ok',
      });
    });

    it('should return error when schedule not found', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(null);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        userId: 'user-456',
        responses: [{ dateId: 'date-1', status: 'ok' }],
        guildId: 'guild-123',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['スケジュールが見つかりません']);
    });

    it('should return error when response not found', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockResponseRepository.findByUser).mockResolvedValueOnce(null);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        userId: 'user-456',
        responses: [{ dateId: 'date-1', status: 'ok' }],
        guildId: 'guild-123',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['更新対象のレスポンスが見つかりません']);
    });

    it('should return error when schedule is closed for non-author', async () => {
      const closedSchedule = { ...mockSchedule, status: 'closed' as const };

      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(closedSchedule);
      vi.mocked(mockResponseRepository.findByUser).mockResolvedValueOnce(mockResponse);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        userId: 'user-456', // Not the author
        responses: [{ dateId: 'date-1', status: 'ok' }],
        guildId: 'guild-123',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['この日程調整は締め切られています']);
    });

    it('should not allow even author to update response on closed schedule', async () => {
      const closedSchedule = { ...mockSchedule, status: 'closed' as const };
      const authorResponse = { ...mockResponse, userId: 'user-123' };

      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(closedSchedule);
      vi.mocked(mockResponseRepository.findByUser).mockResolvedValueOnce(authorResponse);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        userId: 'user-123', // Author
        responses: [{ dateId: 'date-1', status: 'ok' }],
        guildId: 'guild-123',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['この日程調整は締め切られています']);
    });

    it('should validate required fields', async () => {
      const testCases = [
        {
          request: {
            scheduleId: '',
            userId: 'user-456',
            responses: [{ dateId: 'date-1', status: 'ok' }],
            guildId: 'guild-123',
          },
          expectedError: 'スケジュールIDが必要です',
        },
        {
          request: {
            scheduleId: 'schedule-123',
            userId: '',
            responses: [{ dateId: 'date-1', status: 'ok' }],
            guildId: 'guild-123',
          },
          expectedError: 'ユーザーIDが必要です',
        },
        {
          request: {
            scheduleId: 'schedule-123',
            userId: 'user-456',
            responses: [{ dateId: 'date-1', status: 'ok' }],
            guildId: '',
          },
          expectedError: 'Guild IDが必要です',
        },
      ];

      for (const { request, expectedError } of testCases) {
        const result = await useCase.execute(request as any);
        expect(result.success).toBe(false);
        expect(result.errors).toContain(expectedError);
      }
    });

    it('should validate response date IDs exist in schedule', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockResponseRepository.findByUser).mockResolvedValueOnce(mockResponse);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        userId: 'user-456',
        responses: [
          { dateId: 'date-1', status: 'ok' },
          { dateId: 'invalid-date', status: 'ok' }, // Invalid date ID
        ],
        guildId: 'guild-123',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('無効な日程候補です: invalid-date');
    });

    it('should handle repository save errors', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockResponseRepository.findByUser).mockResolvedValueOnce(mockResponse);
      vi.mocked(mockResponseRepository.save).mockRejectedValueOnce(new Error('Save failed'));

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        userId: 'user-456',
        responses: [{ dateId: 'date-1', status: 'ok' }],
        guildId: 'guild-123',
      });

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('レスポンスの更新に失敗しました');
    });

    it('should handle unexpected errors', async () => {
      vi.mocked(mockScheduleRepository.findById).mockRejectedValueOnce(
        new Error('Unexpected error')
      );

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        userId: 'user-456',
        responses: [{ dateId: 'date-1', status: 'ok' }],
        guildId: 'guild-123',
      });

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('レスポンスの更新に失敗しました');
    });

    it('should preserve display name if provided', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockResponseRepository.findByUser).mockResolvedValueOnce({
        ...mockResponse,
        displayName: 'Display Name',
      });
      vi.mocked(mockResponseRepository.save).mockResolvedValueOnce(undefined);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        userId: 'user-456',
        responses: [{ dateId: 'date-1', status: 'ok' }],
        guildId: 'guild-123',
      });

      expect(result.success).toBe(true);
      expect(result.response?.displayName).toBe('Display Name');
    });
  });
});

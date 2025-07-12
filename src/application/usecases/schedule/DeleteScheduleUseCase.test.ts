import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type IResponseRepository,
  type IScheduleRepository,
  NotFoundError,
  RepositoryError,
} from '../../../domain/repositories/interfaces';
import type { DomainSchedule } from '../../../domain/types/DomainTypes';
import { DeleteScheduleUseCase } from './DeleteScheduleUseCase';

describe('DeleteScheduleUseCase', () => {
  let useCase: DeleteScheduleUseCase;
  let mockScheduleRepository: IScheduleRepository;
  let mockResponseRepository: IResponseRepository;

  const mockSchedule: DomainSchedule = {
    id: 'schedule-123',
    guildId: 'guild-123',
    channelId: 'channel-123',
    title: 'Test Schedule',
    dates: [{ id: 'date-1', datetime: '2024/01/20 19:00' }],
    createdBy: { id: 'user-123', username: 'TestUser' },
    authorId: 'user-123',
    status: 'open',
    notificationSent: false,
    totalResponses: 5,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
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
      getScheduleSummary: vi.fn(),
    };

    useCase = new DeleteScheduleUseCase(mockScheduleRepository, mockResponseRepository);
  });

  describe('execute', () => {
    it('should delete schedule successfully when user is authorized', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockResponseRepository.deleteBySchedule).mockResolvedValueOnce(undefined);
      vi.mocked(mockScheduleRepository.delete).mockResolvedValueOnce(undefined);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        deletedByUserId: 'user-123',
      });

      expect(result.success).toBe(true);
      expect(result.deletedSchedule).toEqual({
        id: 'schedule-123',
        title: 'Test Schedule',
        channelId: 'channel-123',
        responseCount: 5,
      });

      expect(mockScheduleRepository.findById).toHaveBeenCalledWith('schedule-123', 'guild-123');
      expect(mockScheduleRepository.delete).toHaveBeenCalledWith('schedule-123', 'guild-123');
    });

    it('should return error when schedule not found', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(null);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        deletedByUserId: 'user-123',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['スケジュールが見つかりません']);
      expect(mockScheduleRepository.delete).not.toHaveBeenCalled();
    });

    it('should return error when user is not authorized', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        deletedByUserId: 'other-user-456', // Different user
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['このスケジュールを削除する権限がありません']);
      expect(mockScheduleRepository.delete).not.toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const testCases = [
        {
          request: { scheduleId: '', guildId: 'guild-123', deletedByUserId: 'user-123' },
          expectedError: 'スケジュールIDが必要です',
        },
        {
          request: { scheduleId: 'schedule-123', guildId: '', deletedByUserId: 'user-123' },
          expectedError: 'Guild IDが必要です',
        },
        {
          request: { scheduleId: 'schedule-123', guildId: 'guild-123', deletedByUserId: '' },
          expectedError: '削除者IDが必要です',
        },
      ];

      for (const { request, expectedError } of testCases) {
        const result = await useCase.execute(request as any);
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors).toContain(expectedError);
      }
    });

    it('should handle NotFoundError from repository', async () => {
      vi.mocked(mockScheduleRepository.findById).mockRejectedValueOnce(
        new NotFoundError('Schedule', 'schedule-123')
      );

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        deletedByUserId: 'user-123',
      });

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('スケジュールの削除に失敗しました');
    });

    it('should handle repository delete errors', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockScheduleRepository.delete).mockRejectedValueOnce(
        new RepositoryError('Delete failed', 'DELETE_ERROR')
      );

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        deletedByUserId: 'user-123',
      });

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('スケジュールの削除に失敗しました');
    });

    it('should handle unexpected errors', async () => {
      vi.mocked(mockScheduleRepository.findById).mockRejectedValueOnce(
        new Error('Unexpected error')
      );

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        deletedByUserId: 'user-123',
      });

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('スケジュールの削除に失敗しました');
    });

    it('should delete schedule with all optional fields', async () => {
      const fullSchedule: DomainSchedule = {
        ...mockSchedule,
        messageId: 'msg-123',
        description: 'Test description',
        deadline: new Date('2024-02-01'),
        reminderTimings: ['1h', '30m'],
        reminderMentions: ['@here'],
        remindersSent: ['1h'],
      };

      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(fullSchedule);
      vi.mocked(mockResponseRepository.deleteBySchedule).mockResolvedValueOnce(undefined);
      vi.mocked(mockScheduleRepository.delete).mockResolvedValueOnce(undefined);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        deletedByUserId: 'user-123',
      });

      expect(result.success).toBe(true);
      expect(result.deletedSchedule).toEqual({
        id: 'schedule-123',
        title: 'Test Schedule',
        channelId: 'channel-123',
        responseCount: 5,
      });
    });

    it('should delete closed schedule', async () => {
      const closedSchedule = { ...mockSchedule, status: 'closed' as const };

      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(closedSchedule);
      vi.mocked(mockResponseRepository.deleteBySchedule).mockResolvedValueOnce(undefined);
      vi.mocked(mockScheduleRepository.delete).mockResolvedValueOnce(undefined);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        deletedByUserId: 'user-123',
      });

      expect(result.success).toBe(true);
      expect(mockScheduleRepository.delete).toHaveBeenCalled();
    });

    it('should handle schedule with no responses', async () => {
      const scheduleNoResponses = { ...mockSchedule, totalResponses: 0 };

      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(scheduleNoResponses);
      vi.mocked(mockResponseRepository.deleteBySchedule).mockResolvedValueOnce(undefined);
      vi.mocked(mockScheduleRepository.delete).mockResolvedValueOnce(undefined);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        deletedByUserId: 'user-123',
      });

      expect(result.success).toBe(true);
      expect(result.deletedSchedule?.responseCount).toBe(0);
    });
  });
});

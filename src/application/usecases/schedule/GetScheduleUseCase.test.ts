import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type IResponseRepository,
  type IScheduleRepository,
  NotFoundError,
  RepositoryError,
} from '../../../domain/repositories/interfaces';
import type { DomainSchedule } from '../../../domain/types/DomainTypes';
import { GetScheduleUseCase } from './GetScheduleUseCase';

describe('GetScheduleUseCase', () => {
  let useCase: GetScheduleUseCase;
  let mockScheduleRepository: IScheduleRepository;
  let mockResponseRepository: IResponseRepository;

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
    totalResponses: 0,
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
    } as any;

    useCase = new GetScheduleUseCase(mockScheduleRepository, mockResponseRepository);
  });

  describe('execute', () => {
    it('should return schedule when found', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);

      const result = await useCase.execute('schedule-123', 'guild-123');

      expect(result.success).toBe(true);
      expect(result.schedule).toEqual({
        id: 'schedule-123',
        guildId: 'guild-123',
        channelId: 'channel-123',
        title: 'Test Schedule',
        dates: [
          { id: 'date-1', datetime: '2024/01/20 19:00' },
          { id: 'date-2', datetime: '2024/01/21 19:00' },
        ],
        createdBy: {
          id: 'user-123',
          username: 'TestUser',
        },
        authorId: 'user-123',
        deadline: undefined,
        reminderTimings: undefined,
        reminderMentions: undefined,
        remindersSent: undefined,
        status: 'open',
        notificationSent: false,
        totalResponses: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });
      expect(mockScheduleRepository.findById).toHaveBeenCalledWith('schedule-123', 'guild-123');
    });

    it('should return failure when schedule not found', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(null);

      const result = await useCase.execute('schedule-123', 'guild-123');

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['スケジュールが見つかりません']);
      expect(result.schedule).toBeUndefined();
    });

    it('should handle NotFoundError from repository', async () => {
      vi.mocked(mockScheduleRepository.findById).mockRejectedValueOnce(
        new NotFoundError('Schedule', 'schedule-123')
      );

      const result = await useCase.execute('schedule-123', 'guild-123');

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('スケジュールの取得に失敗しました');
    });

    it('should handle general repository errors', async () => {
      vi.mocked(mockScheduleRepository.findById).mockRejectedValueOnce(
        new RepositoryError('Database error', 'DB_ERROR')
      );

      const result = await useCase.execute('schedule-123', 'guild-123');

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('スケジュールの取得に失敗しました');
    });

    it('should handle unexpected errors', async () => {
      vi.mocked(mockScheduleRepository.findById).mockRejectedValueOnce(
        new Error('Unexpected error')
      );

      const result = await useCase.execute('schedule-123', 'guild-123');

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('スケジュールの取得に失敗しました');
    });

    it('should handle schedules with all optional fields', async () => {
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

      const result = await useCase.execute('schedule-123', 'guild-123');

      expect(result.success).toBe(true);
      expect(result.schedule).toBeDefined();
      expect(result.schedule?.messageId).toBe('msg-123');
      expect(result.schedule?.description).toBe('Test description');
      expect(result.schedule?.deadline).toBe('2024-02-01T00:00:00.000Z');
      expect(result.schedule?.reminderTimings).toEqual(['1h', '30m']);
      expect(result.schedule?.reminderMentions).toEqual(['@here']);
      expect(result.schedule?.remindersSent).toEqual(['1h']);
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IScheduleRepository } from '../../../domain/repositories/interfaces';
import type { DomainSchedule } from '../../../domain/types/DomainTypes';
import { ReopenScheduleUseCase } from './ReopenScheduleUseCase';

describe('ReopenScheduleUseCase', () => {
  let useCase: ReopenScheduleUseCase;
  let mockScheduleRepository: IScheduleRepository;

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
    ],
    deadline: new Date('2024-01-19'),
    createdBy: { id: 'user-123', username: 'TestUser' },
    authorId: 'user-123',
    status: 'closed', // Initially closed
    reminderTimings: ['1h', '30m'],
    reminderMentions: ['@here'],
    remindersSent: ['1h'],
    notificationSent: true,
    totalResponses: 5,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
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

    useCase = new ReopenScheduleUseCase(mockScheduleRepository);
  });

  describe('execute', () => {
    it('should reopen schedule successfully when user is authorized', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce(undefined);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123', // Author
      });

      expect(result.success).toBe(true);
      expect(result.schedule).toBeDefined();
      expect(result.schedule?.status).toBe('open');
      expect(result.schedule?.id).toBe('schedule-123');
      expect(result.schedule?.title).toBe('Test Schedule');

      // Verify that save was called with reopened schedule
      const savedSchedule = vi.mocked(mockScheduleRepository.save).mock.calls[0][0];
      expect(savedSchedule.status).toBe('open');
      expect(savedSchedule.id).toBe('schedule-123');
    });

    it('should include all schedule properties in response', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce(undefined);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
      });

      expect(result.schedule).toMatchObject({
        id: 'schedule-123',
        guildId: 'guild-123',
        channelId: 'channel-123',
        messageId: 'msg-123',
        title: 'Test Schedule',
        description: 'Test description',
        dates: [
          { id: 'date-1', datetime: '2024/01/20 19:00' },
          { id: 'date-2', datetime: '2024/01/21 19:00' },
        ],
        deadline: '2024-01-19T00:00:00.000Z',
        status: 'open',
        reminderTimings: ['1h', '30m'],
        reminderMentions: ['@here'],
        remindersSent: ['1h'],
        notificationSent: true,
        createdBy: {
          id: 'user-123',
          username: 'TestUser',
        },
        authorId: 'user-123',
        totalResponses: 5,
      });
    });

    it('should return error when schedule not found', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(null);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['指定されたスケジュールが見つかりません']);
      expect(mockScheduleRepository.save).not.toHaveBeenCalled();
    });

    it('should return error when user is not authorized', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'other-user-456', // Not the author
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['このスケジュールを再開する権限がありません']);
      expect(mockScheduleRepository.save).not.toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const testCases = [
        {
          request: { scheduleId: '', guildId: 'guild-123', editorUserId: 'user-123' },
          expectedError: '必須パラメータが不足しています',
        },
        {
          request: { scheduleId: 'schedule-123', guildId: '', editorUserId: 'user-123' },
          expectedError: '必須パラメータが不足しています',
        },
        {
          request: { scheduleId: 'schedule-123', guildId: 'guild-123', editorUserId: '' },
          expectedError: '必須パラメータが不足しています',
        },
        {
          request: { scheduleId: '  ', guildId: 'guild-123', editorUserId: 'user-123' },
          expectedError: '必須パラメータが不足しています',
        },
      ];

      for (const { request, expectedError } of testCases) {
        const result = await useCase.execute(request as any);
        expect(result.success).toBe(false);
        expect(result.errors).toContain(expectedError);
      }
    });

    it('should return error when trying to reopen already open schedule', async () => {
      const openSchedule = { ...mockSchedule, status: 'open' as const };

      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(openSchedule);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
      });

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Schedule is not closed');
      expect(mockScheduleRepository.save).not.toHaveBeenCalled();
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
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce(undefined);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
      });

      expect(result.success).toBe(true);
      expect(result.schedule?.description).toBeUndefined();
      expect(result.schedule?.deadline).toBeUndefined();
      expect(result.schedule?.reminderTimings).toEqual(['3d', '1d', '8h']);
    });

    it('should handle repository save errors', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockScheduleRepository.save).mockRejectedValueOnce(new Error('Database error'));

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['Database error']);
    });

    it('should handle unexpected errors', async () => {
      vi.mocked(mockScheduleRepository.findById).mockRejectedValueOnce('Unexpected error');

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['スケジュールの再開に失敗しました']);
    });

    it('should update the updatedAt timestamp', async () => {
      const beforeTime = new Date();

      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce(undefined);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
      });

      expect(result.success).toBe(true);

      // Check that updatedAt was updated
      const savedSchedule = vi.mocked(mockScheduleRepository.save).mock.calls[0][0];
      expect(new Date(savedSchedule.updatedAt).getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime()
      );
    });

    it('should preserve notification and reminder state', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce(undefined);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
      });

      expect(result.success).toBe(true);

      // These should be preserved when reopening
      expect(result.schedule?.notificationSent).toBe(true);
      expect(result.schedule?.remindersSent).toEqual(['1h']);
      expect(result.schedule?.totalResponses).toBe(5);
    });
  });
});

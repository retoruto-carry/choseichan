import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateScheduleUseCase } from './UpdateScheduleUseCase';
import { IScheduleRepository, NotFoundError } from '../../../domain/repositories/interfaces';
import { DomainSchedule } from '../../../domain/types/DomainTypes';
import { UpdateScheduleRequest } from '../../dto/ScheduleDto';

describe('UpdateScheduleUseCase', () => {
  let useCase: UpdateScheduleUseCase;
  let mockScheduleRepository: IScheduleRepository;

  const mockSchedule: DomainSchedule = {
    id: 'schedule-123',
    guildId: 'guild-123',
    channelId: 'channel-123',
    title: 'Original Title',
    description: 'Original Description',
    dates: [
      { id: 'date-1', datetime: '2024/01/20 19:00' },
      { id: 'date-2', datetime: '2024/01/21 19:00' }
    ],
    createdBy: { id: 'user-123', username: 'TestUser' },
    authorId: 'user-123',
    status: 'open',
    notificationSent: false,
    totalResponses: 0,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  };

  beforeEach(() => {
    mockScheduleRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByChannel: vi.fn(),
      findByGuild: vi.fn(),
      findUpcomingDeadlines: vi.fn(),
      deleteById: vi.fn()
    };

    useCase = new UpdateScheduleUseCase(mockScheduleRepository);
  });

  describe('execute', () => {
    it('should update title successfully', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce(undefined);

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        title: 'Updated Title'
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule?.title).toBe('Updated Title');
      
      const savedSchedule = vi.mocked(mockScheduleRepository.save).mock.calls[0][0];
      expect(savedSchedule.title).toBe('Updated Title');
    });

    it('should update description successfully', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce(undefined);

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        description: 'Updated Description'
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule?.description).toBe('Updated Description');
    });

    it('should update deadline successfully', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce(undefined);

      const deadline = '2024-02-01T12:00:00Z';
      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        deadline
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule?.deadline).toBe(deadline);
      
      const savedSchedule = vi.mocked(mockScheduleRepository.save).mock.calls[0][0];
      expect(savedSchedule.deadline).toEqual(new Date(deadline));
    });

    it('should remove deadline when null is provided', async () => {
      const scheduleWithDeadline = {
        ...mockSchedule,
        deadline: new Date('2024-02-01')
      };
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(scheduleWithDeadline);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce(undefined);

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        deadline: null
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule?.deadline).toBeUndefined();
      
      const savedSchedule = vi.mocked(mockScheduleRepository.save).mock.calls[0][0];
      expect(savedSchedule.deadline).toBeUndefined();
    });

    it('should update message ID', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce(undefined);

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        messageId: 'msg-456'
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule?.messageId).toBe('msg-456');
    });

    it('should update reminder settings', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce(undefined);

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        reminderTimings: ['1h', '30m'],
        reminderMentions: ['@everyone']
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule?.reminderTimings).toEqual(['1h', '30m']);
      expect(result.schedule?.reminderMentions).toEqual(['@everyone']);
    });

    it('should reset reminder states when specified', async () => {
      const scheduleWithReminders = {
        ...mockSchedule,
        remindersSent: ['1h']
      };
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(scheduleWithReminders);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce(undefined);

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        reminderStates: {}
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule?.remindersSent).toEqual([]);
    });

    it('should update dates', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce(undefined);

      const newDates = [
        { id: 'date-3', datetime: '2024/01/22 19:00' },
        { id: 'date-4', datetime: '2024/01/23 19:00' }
      ];

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        dates: newDates
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule?.dates).toEqual(newDates);
    });

    it('should validate required fields', async () => {
      const request = {
        scheduleId: '',
        guildId: '',
        editorUserId: ''
      } as UpdateScheduleRequest;

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('スケジュールIDが必要です');
      expect(result.errors).toContain('Guild IDが必要です');
      expect(result.errors).toContain('編集者IDが必要です');
    });

    it('should validate empty title', async () => {
      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        title: '   '
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('タイトルが空です');
    });

    it('should validate empty dates', async () => {
      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        dates: []
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Schedule must have at least one date');
    });

    it('should return error when schedule not found', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(null);

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        title: 'Updated Title'
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('スケジュールが見つかりません');
    });

    it('should return error when user is not authorized', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'other-user-456', // Different user
        title: 'Updated Title'
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('このスケジュールを編集する権限がありません');
    });

    it('should return error when schedule is closed', async () => {
      const closedSchedule = { ...mockSchedule, status: 'closed' as const };
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(closedSchedule);

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        title: 'Updated Title'
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('締め切られたスケジュールは編集できません');
    });

    it('should handle repository errors', async () => {
      vi.mocked(mockScheduleRepository.findById).mockRejectedValueOnce(
        new Error('Database error')
      );

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        title: 'Updated Title'
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('スケジュールの更新に失敗しました');
    });

    it('should update multiple fields at once', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce(undefined);

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        title: 'New Title',
        description: 'New Description',
        deadline: '2024-02-15T10:00:00Z',
        messageId: 'msg-789'
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule?.title).toBe('New Title');
      expect(result.schedule?.description).toBe('New Description');
      expect(result.schedule?.deadline).toBe('2024-02-15T10:00:00Z');
      expect(result.schedule?.messageId).toBe('msg-789');
    });
  });
});
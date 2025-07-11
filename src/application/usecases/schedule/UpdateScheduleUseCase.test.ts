import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdateScheduleUseCase } from './UpdateScheduleUseCase';
import { IScheduleRepository, NotFoundError } from '../../../domain/repositories/interfaces';
import { DomainSchedule } from '../../../domain/types/DomainTypes';
import { UpdateScheduleRequest } from '../../dto/ScheduleDto';

describe('UpdateScheduleUseCase', () => {
  let useCase: UpdateScheduleUseCase;
  let mockScheduleRepository: IScheduleRepository;

  // Set dates in the future to avoid validation errors
  const futureDate1 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  const futureDate2 = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000); // 8 days from now
  const futureDeadline = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000); // 6 days from now (before schedule dates)
  
  const mockSchedule: DomainSchedule = {
    id: 'schedule-123',
    guildId: 'guild-123',
    channelId: 'channel-123',
    title: 'Original Title',
    description: 'Original Description',
    dates: [
      { id: 'date-1', datetime: `${futureDate1.getFullYear()}/${(futureDate1.getMonth() + 1).toString().padStart(2, '0')}/${futureDate1.getDate().toString().padStart(2, '0')} 19:00` },
      { id: 'date-2', datetime: `${futureDate2.getFullYear()}/${(futureDate2.getMonth() + 1).toString().padStart(2, '0')}/${futureDate2.getDate().toString().padStart(2, '0')} 19:00` }
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
      findByAuthor: vi.fn(),
      findByDeadlineRange: vi.fn(),
      delete: vi.fn(),
      findByMessageId: vi.fn(),
      countByGuild: vi.fn(),
      updateReminders: vi.fn()
    } as any;

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

      const deadline = futureDeadline.toISOString();
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
        deadline: futureDeadline
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

      const futureDate3 = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000); // 9 days from now
      const futureDate4 = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
      
      const newDates = [
        { id: 'date-3', datetime: `${futureDate3.getFullYear()}/${(futureDate3.getMonth() + 1).toString().padStart(2, '0')}/${futureDate3.getDate().toString().padStart(2, '0')} 19:00` },
        { id: 'date-4', datetime: `${futureDate4.getFullYear()}/${(futureDate4.getMonth() + 1).toString().padStart(2, '0')}/${futureDate4.getDate().toString().padStart(2, '0')} 19:00` }
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
      expect(result.errors!).toContain('スケジュールIDが必要です');
      expect(result.errors!).toContain('Guild IDが必要です');
      expect(result.errors!).toContain('編集者IDが必要です');
    });

    it('should validate empty title', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      
      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        title: '   '
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors!).toContain('タイトルが空です');
    });

    it('should validate empty dates', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      
      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        dates: []
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors![0]).toContain('Schedule must have at least one date');
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
      expect(result.errors!).toContain('スケジュールが見つかりません');
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
      expect(result.errors!).toContain('このスケジュールを編集する権限がありません');
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
      expect(result.errors!).toContain('締め切られたスケジュールは編集できません');
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
      expect(result.errors![0]).toContain('スケジュールの更新に失敗しました');
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
        deadline: futureDeadline.toISOString(),
        messageId: 'msg-789'
      };

      const result = await useCase.execute(request);

      if (!result.success) {
        console.error('Update failed with errors:', result.errors);
      }

      expect(result.success).toBe(true);
      expect(result.schedule?.title).toBe('New Title');
      expect(result.schedule?.description).toBe('New Description');
      expect(result.schedule?.deadline).toBe(futureDeadline.toISOString());
      expect(result.schedule?.messageId).toBe('msg-789');
    });
  });
});
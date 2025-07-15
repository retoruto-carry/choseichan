import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IScheduleRepository } from '../../../domain/repositories/interfaces';
import type { DomainSchedule } from '../../../domain/types/DomainTypes';
import type { UpdateScheduleRequest } from '../../dto/ScheduleDto';
import type { ILogger } from '../../ports/LoggerPort';
import { UpdateScheduleUseCase } from './UpdateScheduleUseCase';

describe('UpdateScheduleUseCase', () => {
  let useCase: UpdateScheduleUseCase;
  let mockScheduleRepository: IScheduleRepository;
  let mockLogger: ILogger;

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
      {
        id: 'date-1',
        datetime: `${futureDate1.getFullYear()}/${(futureDate1.getMonth() + 1).toString().padStart(2, '0')}/${futureDate1.getDate().toString().padStart(2, '0')} 19:00`,
      },
      {
        id: 'date-2',
        datetime: `${futureDate2.getFullYear()}/${(futureDate2.getMonth() + 1).toString().padStart(2, '0')}/${futureDate2.getDate().toString().padStart(2, '0')} 19:00`,
      },
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

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    useCase = new UpdateScheduleUseCase(mockScheduleRepository, mockLogger);
  });

  describe('execute', () => {
    it('should update title successfully', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce(undefined);

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        title: 'Updated Title',
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
        description: 'Updated Description',
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
        deadline,
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
        deadline: futureDeadline,
      };
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(scheduleWithDeadline);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce(undefined);

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        deadline: null,
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
        messageId: 'msg-456',
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
        reminderMentions: ['@everyone'],
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule?.reminderTimings).toEqual(['1h', '30m']);
      expect(result.schedule?.reminderMentions).toEqual(['@everyone']);
    });

    it('should reset reminder states when specified', async () => {
      const scheduleWithReminders = {
        ...mockSchedule,
        remindersSent: ['1h'],
      };
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(scheduleWithReminders);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce(undefined);

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        reminderStates: {},
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
        {
          id: 'date-3',
          datetime: `${futureDate3.getFullYear()}/${(futureDate3.getMonth() + 1).toString().padStart(2, '0')}/${futureDate3.getDate().toString().padStart(2, '0')} 19:00`,
        },
        {
          id: 'date-4',
          datetime: `${futureDate4.getFullYear()}/${(futureDate4.getMonth() + 1).toString().padStart(2, '0')}/${futureDate4.getDate().toString().padStart(2, '0')} 19:00`,
        },
      ];

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        dates: newDates,
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule?.dates).toEqual(newDates);
    });

    it('should validate required fields', async () => {
      const request = {
        scheduleId: '',
        guildId: '',
        editorUserId: '',
      } as UpdateScheduleRequest;

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain('入力内容に問題があります。');
    });

    it('should validate empty title', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        title: '   ',
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain('入力内容に問題があります。');
    });

    it('should validate empty dates', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        dates: [],
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('処理中にエラーが発生しました。');
    });

    it('should return error when schedule not found', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(null);

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        title: 'Updated Title',
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain('日程調整が見つかりません。');
    });

    it('should return error when user is not authorized', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'other-user-456', // Different user
        title: 'Updated Title',
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toContain('権限がありません。');
    });

    it('should allow editing closed schedules (to match old behavior)', async () => {
      const closedSchedule = { ...mockSchedule, status: 'closed' as const };
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(closedSchedule);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce();

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        title: 'Updated Title',
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule).toBeDefined();
      expect(result.schedule?.title).toBe('Updated Title');
    });

    it('should reopen closed schedule when deadline is set to future', async () => {
      const closedSchedule = { ...mockSchedule, status: 'closed' as const };
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(closedSchedule);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce();

      const futureDeadline = new Date(Date.now() + 86400000); // 24 hours later
      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        deadline: futureDeadline.toISOString(),
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule).toBeDefined();
      expect(result.schedule?.status).toBe('open');
    });

    it('should reopen closed schedule when deadline is removed', async () => {
      const closedSchedule = { ...mockSchedule, status: 'closed' as const };
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(closedSchedule);
      vi.mocked(mockScheduleRepository.save).mockResolvedValueOnce();

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        deadline: null,
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule).toBeDefined();
      expect(result.schedule?.status).toBe('open');
    });

    it('should handle repository errors', async () => {
      vi.mocked(mockScheduleRepository.findById).mockRejectedValueOnce(new Error('Database error'));

      const request: UpdateScheduleRequest = {
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-123',
        title: 'Updated Title',
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('処理中にエラーが発生しました。');
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
        messageId: 'msg-789',
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

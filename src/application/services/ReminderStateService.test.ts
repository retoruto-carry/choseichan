/**
 * ReminderStateService テスト
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IScheduleRepository } from '../../domain/repositories/interfaces';
import { ReminderStateService } from './ReminderStateService';

describe('ReminderStateService', () => {
  let mockScheduleRepository: IScheduleRepository;
  let service: ReminderStateService;

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

    service = new ReminderStateService(mockScheduleRepository);
  });

  describe('markReminderSent', () => {
    it('should mark reminder as sent', async () => {
      const mockSchedule = {
        id: 'schedule-123',
        guildId: 'guild-123',
        channelId: 'channel-123',
        title: 'Test Schedule',
        dates: [],
        createdBy: { id: 'user-123', username: 'TestUser' },
        authorId: 'user-123',
        status: 'open' as const,
        notificationSent: false,
        totalResponses: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        remindersSent: [],
      };

      vi.mocked(mockScheduleRepository.findById).mockResolvedValue(mockSchedule);

      await service.markReminderSent({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        reminderType: '3d',
      });

      expect(mockScheduleRepository.updateReminders).toHaveBeenCalledWith({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        remindersSent: ['3d'],
        reminderSent: false,
      });
    });

    it('should not duplicate already sent reminders', async () => {
      const mockSchedule = {
        id: 'schedule-123',
        guildId: 'guild-123',
        channelId: 'channel-123',
        title: 'Test Schedule',
        dates: [],
        createdBy: { id: 'user-123', username: 'TestUser' },
        authorId: 'user-123',
        status: 'open' as const,
        notificationSent: false,
        totalResponses: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        remindersSent: ['3d'],
      };

      vi.mocked(mockScheduleRepository.findById).mockResolvedValue(mockSchedule);

      await service.markReminderSent({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        reminderType: '3d',
      });

      expect(mockScheduleRepository.updateReminders).toHaveBeenCalledWith({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        remindersSent: ['3d'], // 重複なし
        reminderSent: false,
      });
    });

    it('should set reminderSent flag for 8h reminder', async () => {
      const mockSchedule = {
        id: 'schedule-123',
        guildId: 'guild-123',
        channelId: 'channel-123',
        title: 'Test Schedule',
        dates: [],
        createdBy: { id: 'user-123', username: 'TestUser' },
        authorId: 'user-123',
        status: 'open' as const,
        notificationSent: false,
        totalResponses: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        remindersSent: [],
      };

      vi.mocked(mockScheduleRepository.findById).mockResolvedValue(mockSchedule);

      await service.markReminderSent({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        reminderType: '8h',
      });

      expect(mockScheduleRepository.updateReminders).toHaveBeenCalledWith({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        remindersSent: ['8h'],
        reminderSent: true, // 8hの場合はtrue
      });
    });

    it('should throw error when schedule not found', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValue(null);

      await expect(
        service.markReminderSent({
          scheduleId: 'invalid-id',
          guildId: 'guild-123',
          reminderType: '3d',
        })
      ).rejects.toThrow('指定されたスケジュールが見つかりません');

      expect(mockScheduleRepository.updateReminders).not.toHaveBeenCalled();
    });

    it('should throw error with invalid parameters', async () => {
      await expect(
        service.markReminderSent({
          scheduleId: '',
          guildId: 'guild-123',
          reminderType: '3d',
        })
      ).rejects.toThrow('スケジュールID、Guild ID、リマインダータイプが必要です');

      await expect(
        service.markReminderSent({
          scheduleId: 'schedule-123',
          guildId: '',
          reminderType: '3d',
        })
      ).rejects.toThrow('スケジュールID、Guild ID、リマインダータイプが必要です');

      await expect(
        service.markReminderSent({
          scheduleId: 'schedule-123',
          guildId: 'guild-123',
          reminderType: '',
        })
      ).rejects.toThrow('スケジュールID、Guild ID、リマインダータイプが必要です');
    });

    it('should handle multiple reminder types', async () => {
      const mockSchedule = {
        id: 'schedule-123',
        guildId: 'guild-123',
        channelId: 'channel-123',
        title: 'Test Schedule',
        dates: [],
        createdBy: { id: 'user-123', username: 'TestUser' },
        authorId: 'user-123',
        status: 'open' as const,
        notificationSent: false,
        totalResponses: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        remindersSent: ['3d', '1d'],
      };

      vi.mocked(mockScheduleRepository.findById).mockResolvedValue(mockSchedule);

      await service.markReminderSent({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        reminderType: '8h',
      });

      expect(mockScheduleRepository.updateReminders).toHaveBeenCalledWith({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        remindersSent: ['3d', '1d', '8h'],
        reminderSent: true,
      });
    });
  });
});

/**
 * DeadlineCheckerService テスト
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Schedule, ScheduleStatus } from '../../domain/entities/Schedule';
import { ScheduleDate } from '../../domain/entities/ScheduleDate';
import { User } from '../../domain/entities/User';
import type { IScheduleRepository } from '../../domain/repositories/interfaces';
import type { ILogger } from '../ports/LoggerPort';
import { DeadlineCheckerService } from './DeadlineCheckerService';

describe('DeadlineCheckerService', () => {
  let mockLogger: ILogger;
  let mockScheduleRepository: IScheduleRepository;
  let service: DeadlineCheckerService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
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

    service = new DeadlineCheckerService(mockLogger, mockScheduleRepository);
  });

  const createTestSchedule = (overrides: Partial<Parameters<typeof Schedule.create>[0]> = {}) => {
    return Schedule.create({
      id: 'schedule-123',
      guildId: 'guild-123',
      channelId: 'channel-123',
      title: 'テストスケジュール',
      dates: [ScheduleDate.create('date-1', '2024-12-25 19:00')],
      createdBy: User.create('user-123', 'TestUser'),
      authorId: 'user-123',
      deadline: new Date('2024-12-31T23:59:59Z'),
      reminderTimings: ['3d', '1d', '8h'],
      reminderMentions: ['@here'],
      remindersSent: [],
      status: ScheduleStatus.OPEN,
      ...overrides,
    });
  };

  describe('checkDeadlines', () => {
    it('should return schedules that need reminders', async () => {
      const currentTime = new Date('2024-12-29T00:00:00Z'); // 締切の3日前
      const schedule = createTestSchedule({
        deadline: new Date('2024-12-31T23:59:59Z'),
        reminderTimings: ['3d', '1d', '8h'],
        remindersSent: [],
      });

      vi.mocked(mockScheduleRepository.findByDeadlineRange).mockResolvedValue([schedule]);

      const result = await service.checkDeadlines(undefined, currentTime);

      expect(result.upcomingReminders).toHaveLength(1);
      expect(result.upcomingReminders[0].scheduleId).toBe('schedule-123');
      expect(result.upcomingReminders[0].reminderType).toBe('3d');
    });

    it('should exclude already sent reminders', async () => {
      const currentTime = new Date('2024-12-29T00:00:00Z');
      const schedule = createTestSchedule({
        deadline: new Date('2024-12-31T23:59:59Z'),
        reminderTimings: ['3d', '1d', '8h'],
        remindersSent: ['3d'], // すでに3d送信済み
      });

      vi.mocked(mockScheduleRepository.findByDeadlineRange).mockResolvedValue([schedule]);

      const result = await service.checkDeadlines(undefined, currentTime);

      expect(result.upcomingReminders).toHaveLength(0); // 送信済みなので対象外
    });

    it('should handle multiple pending reminders', async () => {
      const currentTime = new Date('2024-12-31T15:00:00Z'); // 締切の1時間前
      const schedule = createTestSchedule({
        deadline: new Date('2024-12-31T16:00:00Z'),
        reminderTimings: ['1d', '8h', '1h'],
        remindersSent: ['1d'], // 1dは送信済み
      });

      vi.mocked(mockScheduleRepository.findByDeadlineRange).mockResolvedValue([schedule]);

      const result = await service.checkDeadlines(undefined, currentTime);

      expect(result.upcomingReminders).toHaveLength(2);
      const reminderTypes = result.upcomingReminders.map((r) => r.reminderType).sort();
      expect(reminderTypes).toEqual(['1h', '8h']);
    });

    it('should return schedules past deadline', async () => {
      const currentTime = new Date('2025-01-01T00:00:00Z');
      const schedule = createTestSchedule({
        deadline: new Date('2024-12-31T23:59:59Z'),
        status: ScheduleStatus.OPEN,
      });

      vi.mocked(mockScheduleRepository.findByDeadlineRange).mockResolvedValue([schedule]);

      const result = await service.checkDeadlines(undefined, currentTime);

      expect(result.justClosed).toHaveLength(1);
      expect(result.justClosed[0].scheduleId).toBe('schedule-123');
    });

    it('should exclude already closed schedules', async () => {
      const currentTime = new Date('2025-01-01T00:00:00Z');
      const schedule = createTestSchedule({
        deadline: new Date('2024-12-31T23:59:59Z'),
        status: ScheduleStatus.CLOSED,
      });

      vi.mocked(mockScheduleRepository.findByDeadlineRange).mockResolvedValue([schedule]);

      const result = await service.checkDeadlines(undefined, currentTime);

      expect(result.justClosed).toHaveLength(0);
    });
  });

  describe('getSchedulesNeedingReminders', () => {
    it('should skip schedules with no reminders configured', () => {
      const currentTime = new Date('2024-12-29T00:00:00Z');
      const schedule = createTestSchedule({
        deadline: new Date('2024-12-31T23:59:59Z'),
        reminderTimings: [], // 空配列
      });

      const result = service.getSchedulesNeedingReminders(schedule, currentTime);

      expect(result).toHaveLength(0);
    });

    it('should handle schedules with custom mentions', () => {
      const currentTime = new Date('2024-12-29T00:00:00Z');
      const schedule = createTestSchedule({
        deadline: new Date('2024-12-31T23:59:59Z'),
        reminderTimings: ['3d'],
        reminderMentions: ['@everyone', '<@&123456789>'], // カスタムメンション
        remindersSent: [],
      });

      const result = service.getSchedulesNeedingReminders(schedule, currentTime);

      expect(result).toHaveLength(1);
      expect(result[0].reminderType).toBe('3d');
    });

    it('should handle schedules with past reminders correctly', () => {
      const currentTime = new Date('2024-12-31T23:00:00Z'); // 締切の1時間前
      const schedule = createTestSchedule({
        deadline: new Date('2025-01-01T00:00:00Z'),
        reminderTimings: ['3d', '1d', '8h', '1h'],
        remindersSent: [],
      });

      const result = service.getSchedulesNeedingReminders(schedule, currentTime);

      expect(result).toHaveLength(1);
      // 3d, 1d, 8hは過去なのでスキップされる
      expect(result[0].reminderType).toBe('1h');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Skipping old reminder')
      );
    });

    it('should handle invalid reminder timing formats gracefully', () => {
      const currentTime = new Date('2024-12-29T00:00:00Z');
      const schedule = createTestSchedule({
        deadline: new Date('2024-12-31T23:59:59Z'),
        reminderTimings: ['invalid', '3d', 'xyz'],
        remindersSent: [],
      });

      const result = service.getSchedulesNeedingReminders(schedule, currentTime);

      expect(result).toHaveLength(1);
      expect(result[0].reminderType).toBe('3d'); // validなもののみ
    });
  });

  describe('shouldCloseDueToDeadline', () => {
    it('should return true for schedules past deadline within threshold', () => {
      const schedule = createTestSchedule({
        deadline: new Date('2024-12-31T23:59:59Z'),
        status: ScheduleStatus.OPEN,
      });
      const currentTime = new Date('2025-01-01T02:00:00Z'); // 2時間過ぎ

      const result = service.shouldCloseDueToDeadline(schedule, currentTime);

      expect(result).toBe(true);
    });

    it('should return false for schedules past deadline beyond threshold', () => {
      const schedule = createTestSchedule({
        deadline: new Date('2024-12-31T23:59:59Z'),
        status: ScheduleStatus.OPEN,
      });
      const currentTime = new Date('2025-01-01T12:00:00Z'); // 12時間過ぎ

      const result = service.shouldCloseDueToDeadline(schedule, currentTime);

      expect(result).toBe(false);
    });

    it('should return false for schedules before deadline', () => {
      const schedule = createTestSchedule({
        deadline: new Date('2024-12-31T23:59:59Z'),
        status: ScheduleStatus.OPEN,
      });
      const currentTime = new Date('2024-12-30T00:00:00Z');

      const result = service.shouldCloseDueToDeadline(schedule, currentTime);

      expect(result).toBe(false);
    });

    it('should return false for closed schedules', () => {
      const schedule = createTestSchedule({
        deadline: new Date('2024-12-31T23:59:59Z'),
        status: ScheduleStatus.CLOSED,
      });
      const currentTime = new Date('2025-01-01T02:00:00Z');

      const result = service.shouldCloseDueToDeadline(schedule, currentTime);

      expect(result).toBe(false);
    });
  });

  describe('getSchedulesNeedingClosure', () => {
    it('should return only schedules needing closure', async () => {
      const currentTime = new Date('2025-01-01T00:00:00Z');
      const schedules = [
        createTestSchedule({
          id: 'schedule-1',
          deadline: new Date('2024-12-31T22:00:00Z'), // 2時間前
          status: ScheduleStatus.OPEN,
        }),
        createTestSchedule({
          id: 'schedule-2',
          deadline: new Date('2024-12-31T12:00:00Z'), // 12時間前（閾値超え）
          status: ScheduleStatus.OPEN,
        }),
        createTestSchedule({
          id: 'schedule-3',
          deadline: new Date('2024-12-31T22:00:00Z'),
          status: ScheduleStatus.CLOSED, // すでに閉じている
        }),
      ];

      vi.mocked(mockScheduleRepository.findByDeadlineRange).mockResolvedValue(schedules);

      const result = await service.getSchedulesNeedingClosure(currentTime);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('schedule-1');
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IScheduleRepository } from '../../../domain/repositories/interfaces';
import type { DomainSchedule } from '../../../domain/types/DomainTypes';
import { FindSchedulesUseCase } from './FindSchedulesUseCase';

describe('FindSchedulesUseCase', () => {
  let useCase: FindSchedulesUseCase;
  let mockScheduleRepository: IScheduleRepository;

  const mockSchedule1: DomainSchedule = {
    id: 'schedule-123',
    guildId: 'guild-123',
    channelId: 'channel-123',
    messageId: 'msg-123',
    title: 'Test Schedule 1',
    description: 'Description 1',
    dates: [
      { id: 'date-1', datetime: '2024/01/20 19:00' },
      { id: 'date-2', datetime: '2024/01/21 19:00' },
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

  const mockSchedule2: DomainSchedule = {
    id: 'schedule-456',
    guildId: 'guild-123',
    channelId: 'channel-123',
    messageId: 'msg-456',
    title: 'Test Schedule 2',
    dates: [{ id: 'date-3', datetime: '2024/02/01 20:00' }],
    deadline: new Date('2024-01-31'),
    createdBy: { id: 'user-456', username: 'OtherUser' },
    authorId: 'user-456',
    status: 'closed',
    notificationSent: true,
    totalResponses: 10,
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-15'),
  };

  const mockSchedule3: DomainSchedule = {
    id: 'schedule-789',
    guildId: 'guild-456',
    channelId: 'channel-456',
    title: 'Different Guild Schedule',
    dates: [{ id: 'date-4', datetime: '2024/03/01 18:00' }],
    createdBy: { id: 'user-789', username: 'AnotherUser' },
    authorId: 'user-789',
    status: 'open',
    notificationSent: false,
    totalResponses: 0,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
  };

  beforeEach(() => {
    mockScheduleRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByChannel: vi.fn(),
      findByGuild: vi.fn(),
      findUpcomingDeadlines: vi.fn(),
      deleteById: vi.fn(),
      findByDeadlineRange: vi.fn(),
      findByMessageId: vi.fn(),
    } as any;

    useCase = new FindSchedulesUseCase(mockScheduleRepository);
  });

  describe('findByChannel', () => {
    it('should find schedules by channel successfully', async () => {
      vi.mocked(mockScheduleRepository.findByChannel).mockResolvedValueOnce([
        mockSchedule1,
        mockSchedule2,
      ]);

      const result = await useCase.findByChannel('channel-123', 'guild-123');

      expect(result.success).toBe(true);
      expect(result.schedules).toHaveLength(2);
      expect(result.schedules?.[0]).toMatchObject({
        id: 'schedule-123',
        title: 'Test Schedule 1',
        channelId: 'channel-123',
        guildId: 'guild-123',
        status: 'open',
        totalResponses: 3,
      });
      expect(result.schedules?.[1]).toMatchObject({
        id: 'schedule-456',
        title: 'Test Schedule 2',
        status: 'closed',
        totalResponses: 10,
      });

      expect(mockScheduleRepository.findByChannel).toHaveBeenCalledWith(
        'channel-123',
        'guild-123',
        undefined
      );
    });

    it('should find schedules with limit', async () => {
      vi.mocked(mockScheduleRepository.findByChannel).mockResolvedValueOnce([mockSchedule1]);

      const result = await useCase.findByChannel('channel-123', 'guild-123', 1);

      expect(result.success).toBe(true);
      expect(result.schedules).toHaveLength(1);
      expect(mockScheduleRepository.findByChannel).toHaveBeenCalledWith(
        'channel-123',
        'guild-123',
        1
      );
    });

    it('should return empty array when no schedules found', async () => {
      vi.mocked(mockScheduleRepository.findByChannel).mockResolvedValueOnce([]);

      const result = await useCase.findByChannel('channel-999', 'guild-123');

      expect(result.success).toBe(true);
      expect(result.schedules).toEqual([]);
    });

    it('should validate required fields', async () => {
      const testCases = [
        {
          channelId: '',
          guildId: 'guild-123',
          expectedError: 'チャンネルIDとGuild IDが必要です',
        },
        {
          channelId: 'channel-123',
          guildId: '',
          expectedError: 'チャンネルIDとGuild IDが必要です',
        },
        {
          channelId: '  ',
          guildId: 'guild-123',
          expectedError: 'チャンネルIDとGuild IDが必要です',
        },
      ];

      for (const { channelId, guildId, expectedError } of testCases) {
        const result = await useCase.findByChannel(channelId, guildId);
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors).toContain(expectedError);
      }
    });

    it('should handle repository errors', async () => {
      vi.mocked(mockScheduleRepository.findByChannel).mockRejectedValueOnce(
        new Error('Database error')
      );

      const result = await useCase.findByChannel('channel-123', 'guild-123');

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('スケジュールの検索に失敗しました');
      expect(result.errors?.[0]).toContain('Database error');
    });

    it('should format dates correctly', async () => {
      vi.mocked(mockScheduleRepository.findByChannel).mockResolvedValueOnce([mockSchedule1]);

      const result = await useCase.findByChannel('channel-123', 'guild-123');

      expect(result.schedules?.[0].deadline).toBe('2024-01-19T00:00:00.000Z');
      expect(result.schedules?.[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(result.schedules?.[0].updatedAt).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('findByDeadlineRange', () => {
    it('should find schedules by deadline range successfully', async () => {
      const startTime = new Date('2024-01-18');
      const endTime = new Date('2024-02-01');

      vi.mocked(mockScheduleRepository.findByDeadlineRange).mockResolvedValueOnce([
        mockSchedule1,
        mockSchedule2,
      ]);

      const result = await useCase.findByDeadlineRange(startTime, endTime);

      expect(result.success).toBe(true);
      expect(result.schedules).toHaveLength(2);
      expect(mockScheduleRepository.findByDeadlineRange).toHaveBeenCalledWith(
        startTime,
        endTime,
        undefined
      );
    });

    it('should find schedules with guild filter', async () => {
      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-12-31');

      vi.mocked(mockScheduleRepository.findByDeadlineRange).mockResolvedValueOnce([mockSchedule1]);

      const result = await useCase.findByDeadlineRange(startTime, endTime, 'guild-123');

      expect(result.success).toBe(true);
      expect(result.schedules).toHaveLength(1);
      expect(mockScheduleRepository.findByDeadlineRange).toHaveBeenCalledWith(
        startTime,
        endTime,
        'guild-123'
      );
    });

    it('should validate date range', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 1000);

      const testCases = [
        {
          startTime: null as any,
          endTime: now,
          expectedError: '有効な時刻範囲が必要です',
        },
        {
          startTime: now,
          endTime: null as any,
          expectedError: '有効な時刻範囲が必要です',
        },
        {
          startTime: now,
          endTime: past,
          expectedError: '有効な時刻範囲が必要です',
        },
        {
          startTime: now,
          endTime: now,
          expectedError: '有効な時刻範囲が必要です',
        },
      ];

      for (const { startTime, endTime, expectedError } of testCases) {
        const result = await useCase.findByDeadlineRange(startTime, endTime);
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors).toContain(expectedError);
      }
    });

    it('should handle schedules without deadline', async () => {
      const scheduleWithoutDeadline = { ...mockSchedule3, deadline: undefined };

      vi.mocked(mockScheduleRepository.findByDeadlineRange).mockResolvedValueOnce([
        scheduleWithoutDeadline,
      ]);

      const result = await useCase.findByDeadlineRange(
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );

      expect(result.success).toBe(true);
      expect(result.schedules?.[0].deadline).toBeUndefined();
    });

    it('should handle repository errors', async () => {
      vi.mocked(mockScheduleRepository.findByDeadlineRange).mockRejectedValueOnce(
        new Error('Database connection lost')
      );

      const result = await useCase.findByDeadlineRange(
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('締切範囲でのスケジュール検索に失敗しました');
      expect(result.errors?.[0]).toContain('Database connection lost');
    });
  });

  describe('findByMessageId', () => {
    it('should find schedule by message ID successfully', async () => {
      vi.mocked(mockScheduleRepository.findByMessageId).mockResolvedValueOnce(mockSchedule1);

      const result = await useCase.findByMessageId('msg-123', 'guild-123');

      expect(result.success).toBe(true);
      expect(result.schedule).toBeDefined();
      expect(result.schedule?.id).toBe('schedule-123');
      expect(result.schedule?.messageId).toBe('msg-123');

      expect(mockScheduleRepository.findByMessageId).toHaveBeenCalledWith('msg-123', 'guild-123');
    });

    it('should return error when schedule not found', async () => {
      vi.mocked(mockScheduleRepository.findByMessageId).mockResolvedValueOnce(null);

      const result = await useCase.findByMessageId('msg-999', 'guild-123');

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['指定されたメッセージに対応するスケジュールが見つかりません']);
    });

    it('should validate required fields', async () => {
      const testCases = [
        {
          messageId: '',
          guildId: 'guild-123',
          expectedError: 'メッセージIDとGuild IDが必要です',
        },
        {
          messageId: 'msg-123',
          guildId: '',
          expectedError: 'メッセージIDとGuild IDが必要です',
        },
        {
          messageId: '  ',
          guildId: '  ',
          expectedError: 'メッセージIDとGuild IDが必要です',
        },
      ];

      for (const { messageId, guildId, expectedError } of testCases) {
        const result = await useCase.findByMessageId(messageId, guildId);
        expect(result.success).toBe(false);
        expect(result.errors).toBeDefined();
        expect(result.errors).toContain(expectedError);
      }
    });

    it('should handle repository errors', async () => {
      vi.mocked(mockScheduleRepository.findByMessageId).mockRejectedValueOnce(
        new Error('Query timeout')
      );

      const result = await useCase.findByMessageId('msg-123', 'guild-123');

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('メッセージIDでのスケジュール検索に失敗しました');
      expect(result.errors?.[0]).toContain('Query timeout');
    });

    it('should handle schedules with minimal fields', async () => {
      const minimalSchedule: DomainSchedule = {
        id: 'schedule-minimal',
        guildId: 'guild-123',
        channelId: 'channel-123',
        messageId: 'msg-minimal',
        title: 'Minimal Schedule',
        description: undefined,
        dates: [{ id: 'date-1', datetime: '2024-12-25 19:00' }], // 最低限一つの日程が必要
        createdBy: { id: 'user-123', username: 'User' },
        authorId: 'user-123',
        deadline: undefined,
        reminderTimings: undefined,
        reminderMentions: undefined,
        remindersSent: undefined,
        status: 'open',
        notificationSent: false,
        totalResponses: 0,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      vi.mocked(mockScheduleRepository.findByMessageId).mockResolvedValueOnce(minimalSchedule);

      const result = await useCase.findByMessageId('msg-minimal', 'guild-123');

      expect(result.success).toBe(true);
      expect(result.schedule?.description).toBeUndefined();
      expect(result.schedule?.deadline).toBeUndefined();
      expect(result.schedule?.reminderTimings).toEqual(['3d', '1d', '8h']);
    });
  });

  describe('buildScheduleResponse', () => {
    it('should handle all optional fields correctly', async () => {
      const fullSchedule: DomainSchedule = {
        ...mockSchedule1,
        description: 'Full description',
        deadline: new Date('2024-01-19'),
        reminderTimings: ['3d', '1d', '1h'],
        reminderMentions: ['@here', '@everyone'],
        remindersSent: ['3d', '1d'],
      };

      vi.mocked(mockScheduleRepository.findByChannel).mockResolvedValueOnce([fullSchedule]);

      const result = await useCase.findByChannel('channel-123', 'guild-123');

      expect(result.schedules?.[0]).toMatchObject({
        description: 'Full description',
        deadline: '2024-01-19T00:00:00.000Z',
        reminderTimings: ['3d', '1d', '1h'],
        reminderMentions: ['@here', '@everyone'],
        remindersSent: ['3d', '1d'],
      });
    });

    it('should handle undefined optional fields', async () => {
      const minimalSchedule: DomainSchedule = {
        ...mockSchedule1,
        messageId: undefined,
        description: undefined,
        deadline: undefined,
        reminderTimings: undefined,
        reminderMentions: undefined,
        remindersSent: undefined,
      };

      vi.mocked(mockScheduleRepository.findByChannel).mockResolvedValueOnce([minimalSchedule]);

      const result = await useCase.findByChannel('channel-123', 'guild-123');

      const schedule = result.schedules?.[0];
      expect(schedule?.messageId).toBeUndefined();
      expect(schedule?.description).toBeUndefined();
      expect(schedule?.deadline).toBeUndefined();
      expect(schedule?.reminderTimings).toEqual(['3d', '1d', '8h']);
      expect(schedule?.reminderMentions).toEqual(['@here']);
      expect(schedule?.remindersSent).toBeUndefined();
    });
  });
});

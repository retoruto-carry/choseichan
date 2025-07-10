/**
 * CreateScheduleUseCase Unit Tests
 * 
 * スケジュール作成ユースケースのユニットテスト
 * DIパターンを使用したモック依存関係のテスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateScheduleUseCase } from '../../../src/application/usecases/schedule/CreateScheduleUseCase';
import { IScheduleRepository } from '../../../src/domain/repositories/interfaces';
import { DomainSchedule } from '../../../src/domain/types/Schedule';
import { CreateScheduleRequest } from '../../../src/application/dto/ScheduleDto';

// Mock Repository Implementation
class MockScheduleRepository implements IScheduleRepository {
  private schedules: Map<string, DomainSchedule> = new Map();
  
  async save(schedule: DomainSchedule): Promise<void> {
    this.schedules.set(schedule.id, schedule);
  }

  async findById(scheduleId: string, guildId: string): Promise<DomainSchedule | null> {
    return this.schedules.get(scheduleId) || null;
  }

  async findByChannel(channelId: string, guildId: string, limit?: number): Promise<DomainSchedule[]> {
    return Array.from(this.schedules.values())
      .filter(s => s.channelId === channelId && s.guildId === guildId)
      .slice(0, limit || 100);
  }

  async findByDeadlineRange(startTime: Date, endTime: Date, guildId?: string): Promise<DomainSchedule[]> {
    return Array.from(this.schedules.values())
      .filter(s => s.deadline && s.deadline >= startTime && s.deadline <= endTime)
      .filter(s => !guildId || s.guildId === guildId);
  }

  async delete(scheduleId: string, guildId: string): Promise<void> {
    this.schedules.delete(scheduleId);
  }

  async findByMessageId(messageId: string, guildId: string): Promise<DomainSchedule | null> {
    return Array.from(this.schedules.values())
      .find(s => s.messageId === messageId && s.guildId === guildId) || null;
  }

  async countByGuild(guildId: string): Promise<number> {
    return Array.from(this.schedules.values())
      .filter(s => s.guildId === guildId).length;
  }

  async updateReminders(params: {
    scheduleId: string;
    guildId: string;
    remindersSent: string[];
    reminderSent?: boolean;
  }): Promise<void> {
    const schedule = this.schedules.get(params.scheduleId);
    if (schedule) {
      // Update reminders (simplified implementation)
      this.schedules.set(params.scheduleId, {
        ...schedule,
        remindersSent: params.remindersSent
      });
    }
  }

  // Helper methods for testing
  clear() {
    this.schedules.clear();
  }

  getAll() {
    return Array.from(this.schedules.values());
  }
}

describe('CreateScheduleUseCase', () => {
  let useCase: CreateScheduleUseCase;
  let mockRepository: MockScheduleRepository;

  beforeEach(() => {
    mockRepository = new MockScheduleRepository();
    useCase = new CreateScheduleUseCase(mockRepository);
  });

  describe('Valid Schedule Creation', () => {
    it('should create a valid schedule successfully', async () => {
      const request: CreateScheduleRequest = {
        guildId: 'guild123',
        channelId: 'channel123',
        authorId: 'user123',
        authorUsername: 'testuser',
        title: 'Test Schedule',
        description: 'Test description',
        dates: [
          { id: 'date1', datetime: '2024-12-01 10:00' },
          { id: 'date2', datetime: '2024-12-02 14:00' }
        ],
        deadline: new Date(Date.now() + 86400000).toISOString(), // 24 hours later
        reminderTimings: ['1d', '8h', '30m'],
        reminderMentions: ['@here', '@everyone']
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule).toBeDefined();
      expect(result.schedule!.id).toBeDefined();
      expect(result.schedule!.title).toBe('Test Schedule');
      expect(result.schedule!.description).toBe('Test description');
      expect(result.schedule!.dates).toHaveLength(2);
      expect(result.schedule!.status).toBe('open');
      expect(result.schedule!.authorId).toBe('user123');
      expect(result.schedule!.reminderTimings).toEqual(['1d', '8h', '30m']);
      expect(result.schedule!.reminderMentions).toEqual(['@here', '@everyone']);
    });

    it('should create schedule without optional fields', async () => {
      const request: CreateScheduleRequest = {
        guildId: 'guild123',
        channelId: 'channel123',
        authorId: 'user123',
        authorUsername: 'testuser',
        title: 'Simple Schedule',
        dates: [
          { id: 'date1', datetime: '2024-12-01 10:00' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule).toBeDefined();
      expect(result.schedule!.description).toBeUndefined();
      expect(result.schedule!.deadline).toBeUndefined();
      expect(result.schedule!.reminderTimings).toBeUndefined();
      expect(result.schedule!.reminderMentions).toBeUndefined();
    });

    it('should save schedule to repository', async () => {
      const request: CreateScheduleRequest = {
        guildId: 'guild123',
        channelId: 'channel123',
        authorId: 'user123',
        authorUsername: 'testuser',
        title: 'Test Schedule',
        dates: [
          { id: 'date1', datetime: '2024-12-01 10:00' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      
      // Verify schedule was saved to repository
      const savedSchedules = mockRepository.getAll();
      expect(savedSchedules).toHaveLength(1);
      expect(savedSchedules[0].title).toBe('Test Schedule');
    });
  });

  describe('Validation Errors', () => {
    it('should reject request with missing guild ID', async () => {
      const request: CreateScheduleRequest = {
        guildId: '',
        channelId: 'channel123',
        authorId: 'user123',
        authorUsername: 'testuser',
        title: 'Test Schedule',
        dates: [
          { id: 'date1', datetime: '2024-12-01 10:00' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Guild IDが必要です');
    });

    it('should reject request with missing channel ID', async () => {
      const request: CreateScheduleRequest = {
        guildId: 'guild123',
        channelId: '',
        authorId: 'user123',
        authorUsername: 'testuser',
        title: 'Test Schedule',
        dates: [
          { id: 'date1', datetime: '2024-12-01 10:00' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Channel IDが必要です');
    });

    it('should reject request with missing author information', async () => {
      const request: CreateScheduleRequest = {
        guildId: 'guild123',
        channelId: 'channel123',
        authorId: '',
        authorUsername: '',
        title: 'Test Schedule',
        dates: [
          { id: 'date1', datetime: '2024-12-01 10:00' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('作成者IDが必要です');
      expect(result.errors).toContain('作成者名が必要です');
    });

    it('should reject request with missing title', async () => {
      const request: CreateScheduleRequest = {
        guildId: 'guild123',
        channelId: 'channel123',
        authorId: 'user123',
        authorUsername: 'testuser',
        title: '',
        dates: [
          { id: 'date1', datetime: '2024-12-01 10:00' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('タイトルが必要です');
    });

    it('should reject request with no dates', async () => {
      const request: CreateScheduleRequest = {
        guildId: 'guild123',
        channelId: 'channel123',
        authorId: 'user123',
        authorUsername: 'testuser',
        title: 'Test Schedule',
        dates: []
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('日程候補が必要です');
    });

    it('should reject request with invalid date format', async () => {
      const request: CreateScheduleRequest = {
        guildId: 'guild123',
        channelId: 'channel123',
        authorId: 'user123',
        authorUsername: 'testuser',
        title: 'Test Schedule',
        dates: [
          { id: 'date1', datetime: 'invalid-date' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('日程候補1: 日時の形式が正しくありません');
    });

    it('should reject request with invalid deadline format', async () => {
      const request: CreateScheduleRequest = {
        guildId: 'guild123',
        channelId: 'channel123',
        authorId: 'user123',
        authorUsername: 'testuser',
        title: 'Test Schedule',
        dates: [
          { id: 'date1', datetime: '2024-12-01 10:00' }
        ],
        deadline: 'invalid-deadline'
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('締切日時の形式が正しくありません');
    });

    it('should collect multiple validation errors', async () => {
      const request: CreateScheduleRequest = {
        guildId: '',
        channelId: '',
        authorId: '',
        authorUsername: '',
        title: '',
        dates: []
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(6);
    });
  });

  describe('Domain Validation', () => {
    it('should reject schedule with past deadline', async () => {
      const request: CreateScheduleRequest = {
        guildId: 'guild123',
        channelId: 'channel123',
        authorId: 'user123',
        authorUsername: 'testuser',
        title: 'Test Schedule',
        dates: [
          { id: 'date1', datetime: '2024-12-01 10:00' }
        ],
        deadline: new Date(Date.now() - 86400000).toISOString() // 24 hours ago
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('締切は現在時刻より後に設定してください');
    });

    it('should reject schedule with too many dates', async () => {
      const manyDates = Array.from({ length: 26 }, (_, i) => ({
        id: `date${i}`,
        datetime: `2024-12-${(i % 30) + 1} 10:00`
      }));

      const request: CreateScheduleRequest = {
        guildId: 'guild123',
        channelId: 'channel123',
        authorId: 'user123',
        authorUsername: 'testuser',
        title: 'Test Schedule',
        dates: manyDates
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('日程候補は25個以下で設定してください');
    });

    it('should reject schedule with too long title', async () => {
      const longTitle = 'a'.repeat(257);

      const request: CreateScheduleRequest = {
        guildId: 'guild123',
        channelId: 'channel123',
        authorId: 'user123',
        authorUsername: 'testuser',
        title: longTitle,
        dates: [
          { id: 'date1', datetime: '2024-12-01 10:00' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('タイトルは256文字以下で設定してください');
    });
  });

  describe('Repository Errors', () => {
    it('should handle repository save errors', async () => {
      // Mock repository to throw error
      const saveSpy = vi.spyOn(mockRepository, 'save').mockRejectedValue(new Error('Database error'));

      const request: CreateScheduleRequest = {
        guildId: 'guild123',
        channelId: 'channel123',
        authorId: 'user123',
        authorUsername: 'testuser',
        title: 'Test Schedule',
        dates: [
          { id: 'date1', datetime: '2024-12-01 10:00' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('スケジュールの作成に失敗しました: Database error');
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  describe('Response Building', () => {
    it('should build correct response structure', async () => {
      const request: CreateScheduleRequest = {
        guildId: 'guild123',
        channelId: 'channel123',
        authorId: 'user123',
        authorUsername: 'testuser',
        title: 'Test Schedule',
        description: 'Test description',
        dates: [
          { id: 'date1', datetime: '2024-12-01 10:00' },
          { id: 'date2', datetime: '2024-12-02 14:00' }
        ],
        deadline: new Date(Date.now() + 86400000).toISOString(),
        reminderTimings: ['1d', '8h'],
        reminderMentions: ['@here']
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule).toBeDefined();
      
      const schedule = result.schedule!;
      expect(schedule.guildId).toBe('guild123');
      expect(schedule.channelId).toBe('channel123');
      expect(schedule.title).toBe('Test Schedule');
      expect(schedule.description).toBe('Test description');
      expect(schedule.dates).toHaveLength(2);
      expect(schedule.dates[0].id).toBe('date1');
      expect(schedule.dates[1].id).toBe('date2');
      expect(schedule.createdBy.id).toBe('user123');
      expect(schedule.createdBy.username).toBe('testuser');
      expect(schedule.authorId).toBe('user123');
      expect(schedule.deadline).toBeDefined();
      expect(schedule.reminderTimings).toEqual(['1d', '8h']);
      expect(schedule.reminderMentions).toEqual(['@here']);
      expect(schedule.status).toBe('open');
      expect(schedule.notificationSent).toBe(false);
      expect(schedule.totalResponses).toBe(0);
      expect(schedule.createdAt).toBeDefined();
      expect(schedule.updatedAt).toBeDefined();
    });

    it('should handle ISO date string conversion', async () => {
      const deadlineString = '2024-12-01T10:00:00.000Z';
      
      const request: CreateScheduleRequest = {
        guildId: 'guild123',
        channelId: 'channel123',
        authorId: 'user123',
        authorUsername: 'testuser',
        title: 'Test Schedule',
        dates: [
          { id: 'date1', datetime: '2024-12-01 10:00' }
        ],
        deadline: deadlineString
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.schedule!.deadline).toBe(deadlineString);
    });
  });
});
/**
 * SubmitResponseUseCase Unit Tests
 * 
 * 回答送信ユースケースのユニットテスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubmitResponseUseCase } from './SubmitResponseUseCase';
import { IScheduleRepository, IResponseRepository } from '../../../domain/repositories/interfaces';
import { SubmitResponseRequest } from '../../dto/ResponseDto';
import { 
  createMockScheduleRepository, 
  createMockResponseRepository, 
  createTestScheduleData, 
  createTestResponseData 
} from '../../../../tests/test-utils/MockRepositoryFactory';

describe('SubmitResponseUseCase', () => {
  let useCase: SubmitResponseUseCase;
  let mockScheduleRepository: ReturnType<typeof createMockScheduleRepository>;
  let mockResponseRepository: ReturnType<typeof createMockResponseRepository>;

  beforeEach(() => {
    mockScheduleRepository = createMockScheduleRepository();
    mockResponseRepository = createMockResponseRepository();
    useCase = new SubmitResponseUseCase(mockScheduleRepository, mockResponseRepository);
  });

  describe('Valid Response Submission', () => {
    it('should submit a valid response successfully', async () => {
      const schedule = createTestScheduleData();
      await mockScheduleRepository.save(schedule);

      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        displayName: 'Test Responder',
        responses: [
          { dateId: 'date1', status: 'ok' },
          { dateId: 'date2', status: 'maybe' }
        ],
        comment: 'Looking forward to it!'
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response!.scheduleId).toBe('test-schedule-1');
      expect(result.response!.userId).toBe('user456');
      expect(result.response!.username).toBe('responder');
      expect(result.response!.displayName).toBe('Test Responder');
      expect(result.response!.dateStatuses).toEqual({
        'date1': 'ok',
        'date2': 'maybe'
      });
      expect(result.response!.comment).toBe('Looking forward to it!');
    });

    it('should update existing response', async () => {
      const schedule = createTestScheduleData();
      await mockScheduleRepository.save(schedule);

      const existingResponse = createTestResponseData({
        scheduleId: 'test-schedule-1',
        userId: 'user456',
        dateStatuses: {
          'date1': 'ng',
          'date2': 'ng'
        }
      });
      await mockResponseRepository.save(existingResponse, 'guild123');

      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [
          { dateId: 'date1', status: 'ok' },
          { dateId: 'date2', status: 'maybe' }
        ],
        comment: 'Changed my mind!'
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.response!.dateStatuses).toEqual({
        'date1': 'ok',
        'date2': 'maybe'
      });
      expect(result.response!.comment).toBe('Changed my mind!');
    });

    it('should handle response without comment', async () => {
      const schedule = createTestScheduleData();
      await mockScheduleRepository.save(schedule);

      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        dateStatuses: {
          'date1': 'ok',
          'date2': 'maybe'
        }
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.response!.comment).toBeUndefined();
    });

    it('should save response to repository', async () => {
      const schedule = createTestScheduleData();
      await mockScheduleRepository.save(schedule);

      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        dateStatuses: {
          'date1': 'ok',
          'date2': 'maybe'
        }
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      
      // Verify response was saved
      const savedResponse = await mockResponseRepository.findByUser('test-schedule-1', 'user456', 'guild123');
      expect(savedResponse).toBeDefined();
      expect(savedResponse!.dateStatuses).toEqual({
        'date1': 'ok',
        'date2': 'maybe'
      });
    });
  });

  describe('Validation Errors', () => {
    it('should reject request with missing schedule ID', async () => {
      const request: SubmitResponseRequest = {
        scheduleId: '',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [
          { dateId: 'date1', status: 'ok' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('スケジュールIDが必要です');
    });

    it('should reject request with missing user information', async () => {
      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: '',
        username: '',
        responses: [
          { dateId: 'date1', status: 'ok' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('ユーザーIDが必要です');
      expect(result.errors).toContain('ユーザー名が必要です');
    });

    it('should reject request with no date statuses', async () => {
      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: []
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('少なくとも1つの日程への回答が必要です');
    });

    it('should reject request with invalid date status', async () => {
      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [
          { dateId: 'date1', status: 'invalid' as any }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('日程date1への回答が無効です: invalid');
    });

    it('should reject request with too long comment', async () => {
      const longComment = 'a'.repeat(1001);

      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [
          { dateId: 'date1', status: 'ok' }
        ],
        comment: longComment
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('コメントは1000文字以下で入力してください');
    });
  });

  describe('Business Logic Validation', () => {
    it('should reject response for non-existent schedule', async () => {
      const request: SubmitResponseRequest = {
        scheduleId: 'non-existent-schedule',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [
          { dateId: 'date1', status: 'ok' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('スケジュールが見つかりません');
    });

    it('should reject response for closed schedule', async () => {
      const closedSchedule = createTestScheduleData({ status: 'closed' });
      await mockScheduleRepository.save(closedSchedule);

      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [
          { dateId: 'date1', status: 'ok' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('このスケジュールは既に締切られています');
    });

    it('should reject response for schedule with passed deadline', async () => {
      const pastDeadline = new Date(Date.now() - 86400000); // 24 hours ago
      const expiredSchedule = createTestScheduleData({ deadline: pastDeadline });
      await mockScheduleRepository.save(expiredSchedule);

      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [
          { dateId: 'date1', status: 'ok' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('このスケジュールは締切を過ぎています');
    });

    it('should reject response for non-existent dates', async () => {
      const schedule = createTestScheduleData();
      await mockScheduleRepository.save(schedule);

      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [
          { dateId: 'non-existent-date', status: 'ok' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('日程non-existent-dateはこのスケジュールに存在しません');
    });

    it('should validate all date statuses correspond to schedule dates', async () => {
      const schedule = createTestScheduleData();
      await mockScheduleRepository.save(schedule);

      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [
          { dateId: 'date1', status: 'ok' },
          { dateId: 'date2', status: 'maybe' },
          { dateId: 'invalid-date', status: 'ng' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('日程invalid-dateはこのスケジュールに存在しません');
    });
  });

  describe('Repository Errors', () => {
    it('should handle schedule repository errors', async () => {
      const findByIdSpy = vi.spyOn(mockScheduleRepository, 'findById').mockRejectedValue(new Error('Database error'));

      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [
          { dateId: 'date1', status: 'ok' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('回答の送信に失敗しました: Database error');
      expect(findByIdSpy).toHaveBeenCalled();
    });

    it('should handle response repository errors', async () => {
      const schedule = createTestScheduleData();
      await mockScheduleRepository.save(schedule);

      const saveSpy = vi.spyOn(mockResponseRepository, 'save').mockRejectedValue(new Error('Save error'));

      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [
          { dateId: 'date1', status: 'ok' }
        ]
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('回答の送信に失敗しました: Save error');
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  describe('Response Building', () => {
    it('should build correct response structure', async () => {
      const schedule = createTestScheduleData();
      await mockScheduleRepository.save(schedule);

      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        displayName: 'Test Responder',
        responses: [
          { dateId: 'date1', status: 'ok' },
          { dateId: 'date2', status: 'maybe' }
        ],
        comment: 'Test comment'
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      
      const response = result.response!;
      expect(response.scheduleId).toBe('test-schedule-1');
      expect(response.userId).toBe('user456');
      expect(response.username).toBe('responder');
      expect(response.displayName).toBe('Test Responder');
      expect(response.dateStatuses).toEqual({
        'date1': 'ok',
        'date2': 'maybe'
      });
      expect(response.comment).toBe('Test comment');
      expect(response.updatedAt).toBeDefined();
    });

    it('should handle unicode characters in comment', async () => {
      const schedule = createTestScheduleData();
      await mockScheduleRepository.save(schedule);

      const unicodeComment = '参加します！楽しみですね 😊';

      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [
          { dateId: 'date1', status: 'ok' }
        ],
        comment: unicodeComment
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.response!.comment).toBe(unicodeComment);
    });
  });
});
/**
 * SubmitResponseUseCase Unit Tests
 *
 * 回答送信ユースケースのユニットテスト
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockResponseRepository,
  createMockScheduleRepository,
  createTestResponseData,
  createTestScheduleData,
} from '../../../../tests/test-utils/MockRepositoryFactory';
import type { SubmitResponseRequest } from '../../dto/ResponseDto';
import { SubmitResponseUseCase } from './SubmitResponseUseCase';

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
          { dateId: 'date2', status: 'maybe' },
        ],
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response?.scheduleId).toBe('test-schedule-1');
      expect(result.response?.userId).toBe('user456');
      expect(result.response?.username).toBe('responder');
      expect(result.response?.displayName).toBe('Test Responder');
      expect(result.response?.dateStatuses).toEqual({
        date1: 'ok',
        date2: 'maybe',
      });
    });

    it('should update existing response', async () => {
      const schedule = createTestScheduleData();
      await mockScheduleRepository.save(schedule);

      const existingResponse = createTestResponseData({
        scheduleId: 'test-schedule-1',
        userId: 'user456',
        dateStatuses: {
          date1: 'ng',
          date2: 'ng',
        },
      });
      await mockResponseRepository.save(existingResponse, 'guild123');

      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [
          { dateId: 'date1', status: 'ok' },
          { dateId: 'date2', status: 'maybe' },
        ],
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.response?.dateStatuses).toEqual({
        date1: 'ok',
        date2: 'maybe',
      });
    });

    it('should handle response without comment', async () => {
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
        ],
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
    });

    it('should save response to repository', async () => {
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
        ],
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);

      // Verify response was saved
      const savedResponse = await mockResponseRepository.findByUser(
        'test-schedule-1',
        'user456',
        'guild123'
      );
      expect(savedResponse).toBeDefined();
      expect(savedResponse?.dateStatuses).toEqual({
        date1: 'ok',
        date2: 'maybe',
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
        responses: [{ dateId: 'date1', status: 'ok' }],
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
        responses: [{ dateId: 'date1', status: 'ok' }],
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
        responses: [],
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('レスポンスが必要です');
    });

    it('should reject request with invalid date status', async () => {
      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [{ dateId: 'date1', status: 'invalid' as any }],
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('レスポンス1: 無効なステータスです');
    });
  });

  describe('Business Logic Validation', () => {
    it('should reject response for non-existent schedule', async () => {
      const request: SubmitResponseRequest = {
        scheduleId: 'non-existent-schedule',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [{ dateId: 'date1', status: 'ok' }],
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
        responses: [{ dateId: 'date1', status: 'ok' }],
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('この日程調整は締め切られています');
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
        responses: [{ dateId: 'date1', status: 'ok' }],
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('回答期限が過ぎています');
    });

    it('should reject response for non-existent dates', async () => {
      const schedule = createTestScheduleData();
      await mockScheduleRepository.save(schedule);

      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [{ dateId: 'non-existent-date', status: 'ok' }],
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('無効な日程候補です: non-existent-date');
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
          { dateId: 'invalid-date', status: 'ng' },
        ],
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('無効な日程候補です: invalid-date');
    });
  });

  describe('Repository Errors', () => {
    it('should handle schedule repository errors', async () => {
      const findByIdSpy = vi
        .spyOn(mockScheduleRepository, 'findById')
        .mockRejectedValue(new Error('Database error'));

      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [{ dateId: 'date1', status: 'ok' }],
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('レスポンスの投稿に失敗しました: Database error');
      expect(findByIdSpy).toHaveBeenCalled();
    });

    it('should handle response repository errors', async () => {
      const schedule = createTestScheduleData();
      await mockScheduleRepository.save(schedule);

      const saveSpy = vi
        .spyOn(mockResponseRepository, 'save')
        .mockRejectedValue(new Error('Save error'));

      const request: SubmitResponseRequest = {
        scheduleId: 'test-schedule-1',
        guildId: 'guild123',
        userId: 'user456',
        username: 'responder',
        responses: [{ dateId: 'date1', status: 'ok' }],
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('レスポンスの投稿に失敗しました: Save error');
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
          { dateId: 'date2', status: 'maybe' },
        ],
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();

      const response = result.response;
      if (!response) {
        throw new Error('Response should be defined');
      }
      expect(response.scheduleId).toBe('test-schedule-1');
      expect(response.userId).toBe('user456');
      expect(response.username).toBe('responder');
      expect(response.displayName).toBe('Test Responder');
      expect(response.dateStatuses).toEqual({
        date1: 'ok',
        date2: 'maybe',
      });
      expect(response.updatedAt).toBeDefined();
    });
  });
});

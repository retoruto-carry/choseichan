/**
 * ScheduleDomainService Unit Tests
 *
 * スケジュールドメインサービスのユニットテスト
 * ビジネスロジックの検証
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Schedule } from '../entities/Schedule';
import { ScheduleDate } from '../entities/ScheduleDate';
import { User } from '../entities/User';
import { ScheduleDomainService } from './ScheduleDomainService';

// Test helper
function createTestSchedule(): Schedule {
  const user = User.create('user123', 'TestUser');

  // Use dates in the future to avoid validation failures
  const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const dayAfter = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

  const dates = [
    ScheduleDate.create('date1', tomorrow.toISOString().slice(0, 16).replace('T', ' ')),
    ScheduleDate.create('date2', dayAfter.toISOString().slice(0, 16).replace('T', ' ')),
  ];

  return Schedule.create({
    id: 'schedule123',
    guildId: 'guild123',
    channelId: 'channel123',
    title: 'Test Schedule',
    description: 'Test Description',
    dates,
    createdBy: user,
    authorId: 'user123',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('ScheduleDomainService', () => {
  let validDates: ScheduleDate[];

  beforeEach(() => {
    // Use dates in the future to avoid validation failures
    const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const dayAfter = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    validDates = [
      ScheduleDate.create('date1', tomorrow.toISOString().slice(0, 16).replace('T', ' ')),
      ScheduleDate.create('date2', dayAfter.toISOString().slice(0, 16).replace('T', ' ')),
    ];
  });

  describe('validateScheduleForCreation', () => {
    it('should validate valid schedule data', () => {
      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: 'Valid Title',
        dates: validDates,
        deadline: new Date(Date.now() + 86400000), // 24 hours later
      });

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should reject empty title', () => {
      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: '',
        dates: validDates,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('タイトルは必須です');
    });

    it('should reject title over 100 characters', () => {
      const longTitle = 'a'.repeat(101);

      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: longTitle,
        dates: validDates,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('タイトルは100文字以内で入力してください');
    });

    it('should reject empty dates', () => {
      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: 'Valid Title',
        dates: [],
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('日程候補を1つ以上入力してください');
    });

    it('should reject more than 10 dates', () => {
      const manyDates = Array.from({ length: 11 }, (_, i) =>
        ScheduleDate.create(`date${i}`, `2024-12-${i + 1} 10:00`)
      );

      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: 'Valid Title',
        dates: manyDates,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('日程候補は10個以内で入力してください');
    });

    it('should reject past deadline', () => {
      const pastDeadline = new Date(Date.now() - 86400000); // 24 hours ago

      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: 'Valid Title',
        dates: validDates,
        deadline: pastDeadline,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('締切は未来の日時で設定してください');
    });

    it('should accept no deadline', () => {
      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: 'Valid Title',
        dates: validDates,
      });

      expect(validation.isValid).toBe(true);
    });

    it('should collect multiple validation errors', () => {
      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: '', // Invalid
        dates: [], // Invalid
        deadline: new Date(Date.now() - 86400000), // Invalid
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(3);
      expect(validation.errors).toContain('タイトルは必須です');
      expect(validation.errors).toContain('日程候補を1つ以上入力してください');
      expect(validation.errors).toContain('締切は未来の日時で設定してください');
    });
  });

  describe('validateScheduleForUpdate', () => {
    it('should validate valid update data', () => {
      const schedule = createTestSchedule();
      const validation = ScheduleDomainService.validateScheduleForUpdate({
        schedule,
        title: 'Updated Title',
        deadline: new Date(Date.now() + 86400000),
      });

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should allow partial updates', () => {
      const schedule = createTestSchedule();
      const validation = ScheduleDomainService.validateScheduleForUpdate({
        schedule,
        title: 'Updated Title',
      });

      expect(validation.isValid).toBe(true);
    });

    it('should validate provided fields', () => {
      const schedule = createTestSchedule();
      const validation = ScheduleDomainService.validateScheduleForUpdate({
        schedule,
        title: '', // Invalid
        deadline: new Date(Date.now() - 1000), // Past date
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('タイトルは必須です');
      expect(validation.errors).toContain('締切は未来の日時で設定してください');
    });

    it('should reject null deadline', () => {
      const schedule = createTestSchedule();
      const validation = ScheduleDomainService.validateScheduleForUpdate({
        schedule,
        deadline: undefined, // undefined is allowed, null is not
      });

      expect(validation.isValid).toBe(true);
    });
  });

  // Tests for methods that would be needed for reminder validation
  // These methods are not currently implemented in ScheduleDomainService
  // but would be useful additions for complete reminder functionality

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined values gracefully', () => {
      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: null as any,
        dates: null as any,
        deadline: undefined,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle very large numbers', () => {
      // Create dates in far future
      const farFutureDates = [
        ScheduleDate.create('date1', '2100-01-01 10:00'),
        ScheduleDate.create('date2', '2100-01-02 14:00'),
      ];
      const farFutureDeadline = new Date('2099-12-31T23:59:59Z');

      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: 'Valid Title',
        dates: farFutureDates,
        deadline: farFutureDeadline,
      });

      expect(validation.isValid).toBe(true);
    });
  });
});

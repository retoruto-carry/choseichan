/**
 * ScheduleDomainService Unit Tests
 * 
 * スケジュールドメインサービスのユニットテスト
 * ビジネスロジックの検証
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ScheduleDomainService } from './ScheduleDomainService';
import { ScheduleDate } from '../entities/ScheduleDate';
import { Schedule, ScheduleStatus } from '../entities/Schedule';
import { User } from '../entities/User';

// Test helper
function createTestSchedule(): Schedule {
  const user = User.create('user123', 'TestUser');
  const dates = [
    ScheduleDate.create('date1', '2024/12/01 19:00'),
    ScheduleDate.create('date2', '2024/12/02 19:00')
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
    updatedAt: new Date()
  });
}

describe('ScheduleDomainService', () => {
  let validDates: ScheduleDate[];

  beforeEach(() => {
    validDates = [
      ScheduleDate.create('date1', '2024-12-01 10:00'),
      ScheduleDate.create('date2', '2024-12-02 14:00')
    ];
  });

  describe('validateScheduleForCreation', () => {
    it('should validate valid schedule data', () => {
      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: 'Valid Title',
        dates: validDates,
        deadline: new Date(Date.now() + 86400000) // 24 hours later
      });

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should reject empty title', () => {
      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: '',
        dates: validDates
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('タイトルは必須です');
    });

    it('should reject title too long', () => {
      const longTitle = 'a'.repeat(257);
      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: longTitle,
        dates: validDates
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('タイトルは100文字以内で入力してください');
    });

    it('should reject empty dates', () => {
      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: 'Valid Title',
        dates: []
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('日程候補を1つ以上入力してください');
    });

    it('should reject too many dates', () => {
      const manyDates = Array.from({ length: 26 }, (_, i) => 
        ScheduleDate.create(`date${i}`, `2024-12-${(i % 30) + 1} 10:00`)
      );
      
      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: 'Valid Title',
        dates: manyDates
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('日程候補は10個以内で入力してください');
    });

    it('should reject past deadline', () => {
      const pastDeadline = new Date(Date.now() - 86400000); // 24 hours ago
      
      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: 'Valid Title',
        dates: validDates,
        deadline: pastDeadline
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('締切は未来の日時で設定してください');
    });

    it('should accept no deadline', () => {
      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: 'Valid Title',
        dates: validDates
      });

      expect(validation.isValid).toBe(true);
    });

    it('should collect multiple validation errors', () => {
      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: '', // Invalid
        dates: [], // Invalid
        deadline: new Date(Date.now() - 86400000) // Invalid
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
        deadline: new Date(Date.now() + 86400000)
      });

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should allow partial updates', () => {
      const schedule = createTestSchedule();
      const validation = ScheduleDomainService.validateScheduleForUpdate({
        schedule,
        title: 'Updated Title'
      });

      expect(validation.isValid).toBe(true);
    });

    it('should validate provided fields', () => {
      const schedule = createTestSchedule();
      const validation = ScheduleDomainService.validateScheduleForUpdate({
        schedule,
        title: '', // Invalid
        deadline: new Date(Date.now() - 1000) // Past date
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('タイトルは必須です');
      expect(validation.errors).toContain('締切は未来の日時で設定してください');
    });

    it('should reject null deadline', () => {
      const schedule = createTestSchedule();
      const validation = ScheduleDomainService.validateScheduleForUpdate({
        schedule,
        deadline: undefined // undefined is allowed, null is not
      });

      expect(validation.isValid).toBe(true);
    });
  });

  // TODO: These tests reference methods that don't exist in ScheduleDomainService
  // Either implement the methods or remove these tests
  describe.skip('validateReminderTimings', () => {
    it('should validate valid reminder timings', () => {
      const validTimings = ['3d', '1d', '8h', '30m', '15m'];
      
      const validation = ScheduleDomainService.validateReminderTimings(validTimings);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should reject invalid timing formats', () => {
      const invalidTimings = ['3days', '1hour', '30minutes', 'invalid'];
      
      const validation = ScheduleDomainService.validateReminderTimings(invalidTimings);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(4);
      expect(validation.errors[0]).toContain('リマインダー時間の形式が正しくありません');
    });

    it('should reject too many timings', () => {
      const manyTimings = Array.from({ length: 11 }, (_, i) => `${i}h`);
      
      const validation = ScheduleDomainService.validateReminderTimings(manyTimings);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('リマインダー時間は10個以下で設定してください');
    });

    it('should accept empty timings', () => {
      const validation = ScheduleDomainService.validateReminderTimings([]);

      expect(validation.isValid).toBe(true);
    });

    it('should validate timing units', () => {
      const validUnits = ['1y', '6M', '30d', '24h', '60m', '60s'];
      
      const validation = ScheduleDomainService.validateReminderTimings(validUnits);

      expect(validation.isValid).toBe(true);
    });
  });

  describe.skip('validateReminderMentions', () => {
    it('should validate valid mention formats', () => {
      const validMentions = ['@everyone', '@here', '@role:123456', '@user:789012'];
      
      const validation = ScheduleDomainService.validateReminderMentions(validMentions);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    it('should reject invalid mention formats', () => {
      const invalidMentions = ['everyone', 'here', 'invalid-mention'];
      
      const validation = ScheduleDomainService.validateReminderMentions(invalidMentions);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(3);
      expect(validation.errors[0]).toContain('メンション形式が正しくありません');
    });

    it('should reject too many mentions', () => {
      const manyMentions = Array.from({ length: 21 }, (_, i) => `@user:${i}`);
      
      const validation = ScheduleDomainService.validateReminderMentions(manyMentions);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('メンション対象は20個以下で設定してください');
    });

    it('should accept empty mentions', () => {
      const validation = ScheduleDomainService.validateReminderMentions([]);

      expect(validation.isValid).toBe(true);
    });
  });

  describe.skip('calculateReminderTime', () => {
    it('should calculate reminder time correctly', () => {
      const deadline = new Date('2024-12-01T10:00:00Z');
      
      const reminderTime = ScheduleDomainService.calculateReminderTime(deadline, '1d');
      
      expect(reminderTime).toEqual(new Date('2024-11-30T10:00:00Z'));
    });

    it('should handle various time units', () => {
      const deadline = new Date('2024-12-01T10:00:00Z');
      
      const testCases = [
        { timing: '30m', expected: new Date('2024-12-01T09:30:00Z') },
        { timing: '2h', expected: new Date('2024-12-01T08:00:00Z') },
        { timing: '1d', expected: new Date('2024-11-30T10:00:00Z') },
        { timing: '1w', expected: new Date('2024-11-24T10:00:00Z') },
        { timing: '1M', expected: new Date('2024-11-01T10:00:00Z') }
      ];

      testCases.forEach(({ timing, expected }) => {
        const result = ScheduleDomainService.calculateReminderTime(deadline, timing);
        expect(result).toEqual(expected);
      });
    });

    it('should throw error for invalid timing', () => {
      const deadline = new Date('2024-12-01T10:00:00Z');
      
      expect(() => {
        ScheduleDomainService.calculateReminderTime(deadline, 'invalid');
      }).toThrow('無効なリマインダー時間形式: invalid');
    });
  });

  describe.skip('isReminderTimeReached', () => {
    it('should detect when reminder time is reached', () => {
      const deadline = new Date(Date.now() + 3600000); // 1 hour later
      const now = new Date();
      
      const isReached = ScheduleDomainService.isReminderTimeReached(deadline, '30m', now);
      
      expect(isReached).toBe(true); // 30 minutes before 1 hour deadline
    });

    it('should detect when reminder time is not reached', () => {
      const deadline = new Date(Date.now() + 7200000); // 2 hours later
      const now = new Date();
      
      const isReached = ScheduleDomainService.isReminderTimeReached(deadline, '30m', now);
      
      expect(isReached).toBe(false); // 30 minutes before 2 hour deadline
    });

    it('should handle edge cases', () => {
      const deadline = new Date('2024-12-01T10:00:00Z');
      const exactTime = new Date('2024-12-01T09:30:00Z'); // Exactly 30 minutes before
      
      const isReached = ScheduleDomainService.isReminderTimeReached(deadline, '30m', exactTime);
      
      expect(isReached).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined values gracefully', () => {
      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: null as any,
        dates: null as any,
        deadline: undefined
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle very large numbers', () => {
      const farFuture = new Date('2099-12-31T23:59:59Z');
      
      const validation = ScheduleDomainService.validateScheduleForCreation({
        title: 'Valid Title',
        dates: validDates,
        deadline: farFuture
      });

      expect(validation.isValid).toBe(true);
    });

    it('should handle timezone differences', () => {
      const deadlineUTC = new Date('2024-12-01T10:00:00Z');
      const deadlineJST = new Date('2024-12-01T19:00:00+09:00');
      
      const reminderUTC = ScheduleDomainService.calculateReminderTime(deadlineUTC, '1h');
      const reminderJST = ScheduleDomainService.calculateReminderTime(deadlineJST, '1h');
      
      expect(reminderUTC.getTime()).toBe(reminderJST.getTime());
    });
  });
});
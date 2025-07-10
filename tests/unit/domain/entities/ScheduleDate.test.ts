/**
 * ScheduleDate Domain Entity Unit Tests
 * 
 * スケジュール日程エンティティのユニットテスト
 */

import { describe, it, expect } from 'vitest';
import { ScheduleDate } from '../../../../src/domain/entities/ScheduleDate';

describe('ScheduleDate Domain Entity', () => {
  describe('ScheduleDate Creation', () => {
    it('should create a valid schedule date', () => {
      const scheduleDate = ScheduleDate.create('date1', '2024-12-01 10:00');
      
      expect(scheduleDate.id).toBe('date1');
      expect(scheduleDate.datetime).toBe('2024-12-01 10:00');
    });

    it('should throw error for empty id', () => {
      expect(() => {
        ScheduleDate.create('', '2024-12-01 10:00');
      }).toThrow('日程IDは必須です');
    });

    it('should throw error for empty datetime', () => {
      expect(() => {
        ScheduleDate.create('date1', '');
      }).toThrow('日程時刻は必須です');
    });

    it('should handle various datetime formats', () => {
      const validFormats = [
        '2024-12-01 10:00',
        '2024/12/01 10:00',
        '12/01 10:00',
        '12月1日 10:00',
        '2024-12-01T10:00:00Z',
        '明日 10:00',
        '来週月曜 15:00'
      ];

      validFormats.forEach(format => {
        const scheduleDate = ScheduleDate.create('date1', format);
        expect(scheduleDate.datetime).toBe(format);
      });
    });
  });

  describe('ScheduleDate Operations', () => {
    it('should convert to primitives', () => {
      const scheduleDate = ScheduleDate.create('date1', '2024-12-01 10:00');
      const primitives = scheduleDate.toPrimitives();
      
      expect(primitives.id).toBe('date1');
      expect(primitives.datetime).toBe('2024-12-01 10:00');
    });

    it('should create schedule date from primitives', () => {
      const primitives = {
        id: 'date1',
        datetime: '2024-12-01 10:00'
      };

      const scheduleDate = ScheduleDate.fromPrimitives(primitives);
      
      expect(scheduleDate.id).toBe('date1');
      expect(scheduleDate.datetime).toBe('2024-12-01 10:00');
    });

    it('should check equality', () => {
      const date1 = ScheduleDate.create('date1', '2024-12-01 10:00');
      const date2 = ScheduleDate.create('date1', '2024-12-01 10:00');
      const date3 = ScheduleDate.create('date2', '2024-12-01 10:00');
      
      expect(date1.equals(date2)).toBe(true);
      expect(date1.equals(date3)).toBe(false);
    });

    it('should update datetime', () => {
      const scheduleDate = ScheduleDate.create('date1', '2024-12-01 10:00');
      const updatedDate = scheduleDate.updateDatetime('2024-12-02 14:00');
      
      expect(updatedDate.datetime).toBe('2024-12-02 14:00');
      expect(updatedDate.id).toBe('date1');
      expect(scheduleDate.datetime).toBe('2024-12-01 10:00'); // Original unchanged
    });
  });

  describe('ScheduleDate Immutability', () => {
    it('should not modify original schedule date when updating', () => {
      const originalDate = ScheduleDate.create('date1', '2024-12-01 10:00');
      const updatedDate = originalDate.updateDatetime('2024-12-02 14:00');
      
      expect(originalDate.datetime).toBe('2024-12-01 10:00');
      expect(updatedDate.datetime).toBe('2024-12-02 14:00');
      expect(originalDate).not.toBe(updatedDate);
    });
  });
});
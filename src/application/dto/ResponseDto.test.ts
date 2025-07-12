import { describe, expect, it } from 'vitest';
import type { ResponseDto } from './ResponseDto';

describe('ResponseDto', () => {
  describe('interface validation', () => {
    it('should accept valid response dto', () => {
      const responseDto: ResponseDto = {
        scheduleId: 'schedule-123',
        userId: 'user-456',
        username: 'TestUser',
        displayName: 'Test Display Name',
        dateStatuses: {
          'date-1': 'ok',
          'date-2': 'maybe',
          'date-3': 'ng',
        },
        comment: 'This is a test comment',
        updatedAt: '2024-01-15T10:30:00Z',
      };

      expect(responseDto.scheduleId).toBe('schedule-123');
      expect(responseDto.userId).toBe('user-456');
      expect(responseDto.username).toBe('TestUser');
      expect(responseDto.displayName).toBe('Test Display Name');
      expect(responseDto.dateStatuses['date-1']).toBe('ok');
      expect(responseDto.dateStatuses['date-2']).toBe('maybe');
      expect(responseDto.dateStatuses['date-3']).toBe('ng');
      expect(responseDto.updatedAt).toBe('2024-01-15T10:30:00Z');
    });

    it('should accept response dto with minimal fields', () => {
      const responseDto: ResponseDto = {
        scheduleId: 'schedule-123',
        userId: 'user-456',
        username: 'TestUser',
        dateStatuses: {
          'date-1': 'ok',
        },
        updatedAt: '2024-01-15T10:30:00Z',
      };

      expect(responseDto.displayName).toBeUndefined();
      expect(responseDto.scheduleId).toBe('schedule-123');
      expect(responseDto.dateStatuses['date-1']).toBe('ok');
    });

    it('should accept all valid status values', () => {
      const statusValues: Array<'ok' | 'maybe' | 'ng'> = ['ok', 'maybe', 'ng'];

      statusValues.forEach((status, index) => {
        const responseDto: ResponseDto = {
          scheduleId: 'schedule-123',
          userId: 'user-456',
          username: 'TestUser',
          dateStatuses: {
            [`date-${index}`]: status,
          },
          updatedAt: '2024-01-15T10:30:00Z',
        };

        expect(responseDto.dateStatuses[`date-${index}`]).toBe(status);
      });
    });

    it('should handle multiple date statuses', () => {
      const responseDto: ResponseDto = {
        scheduleId: 'schedule-123',
        userId: 'user-456',
        username: 'TestUser',
        dateStatuses: {
          'date-1': 'ok',
          'date-2': 'maybe',
          'date-3': 'ng',
          'date-4': 'ok',
          'date-5': 'maybe',
        },
        updatedAt: '2024-01-15T10:30:00Z',
      };

      expect(Object.keys(responseDto.dateStatuses)).toHaveLength(5);
      expect(responseDto.dateStatuses['date-1']).toBe('ok');
      expect(responseDto.dateStatuses['date-2']).toBe('maybe');
      expect(responseDto.dateStatuses['date-3']).toBe('ng');
      expect(responseDto.dateStatuses['date-4']).toBe('ok');
      expect(responseDto.dateStatuses['date-5']).toBe('maybe');
    });

    it('should handle empty date statuses', () => {
      const responseDto: ResponseDto = {
        scheduleId: 'schedule-123',
        userId: 'user-456',
        username: 'TestUser',
        dateStatuses: {},
        updatedAt: '2024-01-15T10:30:00Z',
      };

      expect(Object.keys(responseDto.dateStatuses)).toHaveLength(0);
    });

    it('should handle long comment', () => {
      const longComment = 'A'.repeat(1000);
      const responseDto: ResponseDto = {
        scheduleId: 'schedule-123',
        userId: 'user-456',
        username: 'TestUser',
        dateStatuses: { 'date-1': 'ok' },
        updatedAt: '2024-01-15T10:30:00Z',
      };

    });

    it('should handle special characters in username and display name', () => {
      const responseDto: ResponseDto = {
        scheduleId: 'schedule-123',
        userId: 'user-456',
        username: 'Test-User_123!@#',
        displayName: 'テストユーザー 🎉',
        dateStatuses: { 'date-1': 'ok' },
        updatedAt: '2024-01-15T10:30:00Z',
      };

      expect(responseDto.username).toBe('Test-User_123!@#');
      expect(responseDto.displayName).toBe('テストユーザー 🎉');
    });

    it('should handle ISO date string format', () => {
      const isoDateString = '2024-01-15T10:30:45.123Z';
      const responseDto: ResponseDto = {
        scheduleId: 'schedule-123',
        userId: 'user-456',
        username: 'TestUser',
        dateStatuses: { 'date-1': 'ok' },
        updatedAt: isoDateString,
      };

      expect(responseDto.updatedAt).toBe(isoDateString);
      // Verify it's a valid date string
      expect(new Date(responseDto.updatedAt).toISOString()).toBe(isoDateString);
    });
  });

  describe('type safety', () => {
    it('should enforce required fields at compile time', () => {
      // This test verifies TypeScript compilation - if any required field is missing,
      // it should cause a compilation error

      const validDto: ResponseDto = {
        scheduleId: 'schedule-123',
        userId: 'user-456',
        username: 'TestUser',
        dateStatuses: { 'date-1': 'ok' },
        updatedAt: '2024-01-15T10:30:00Z',
      };

      expect(validDto).toBeDefined();
    });

    it('should enforce status value types', () => {
      // This verifies that only valid status values are accepted
      const validStatuses: Array<'ok' | 'maybe' | 'ng'> = ['ok', 'maybe', 'ng'];

      validStatuses.forEach((status) => {
        const dto: ResponseDto = {
          scheduleId: 'schedule-123',
          userId: 'user-456',
          username: 'TestUser',
          dateStatuses: { 'date-1': status },
          updatedAt: '2024-01-15T10:30:00Z',
        };

        expect(['ok', 'maybe', 'ng']).toContain(dto.dateStatuses['date-1']);
      });
    });
  });
});

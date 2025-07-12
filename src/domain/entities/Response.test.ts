import { beforeEach, describe, expect, it } from 'vitest';
import { Response } from './Response';
import { ResponseStatus, ResponseStatusValue } from './ResponseStatus';
import { User } from './User';

describe('Response', () => {
  let testUser: User;

  beforeEach(() => {
    testUser = User.create('user-123', 'TestUser');
  });

  describe('create', () => {
    it('should create a valid response', () => {
      const dateStatuses = new Map([
        ['date-1', ResponseStatus.create(ResponseStatusValue.OK)],
        ['date-2', ResponseStatus.create(ResponseStatusValue.MAYBE)],
      ]);

      const response = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses,
      });

      expect(response.id).toBe('response-123');
      expect(response.scheduleId).toBe('schedule-123');
      expect(response.user).toEqual(testUser);
      expect(response.dateStatuses).toEqual(dateStatuses);
      expect(response.createdAt).toBeInstanceOf(Date);
      expect(response.updatedAt).toBeInstanceOf(Date);
    });

    it('should create response without comment', () => {
      const response = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses: new Map(),
      });

    });

    it('should validate required fields', () => {
      expect(() =>
        Response.create({
          id: '',
          scheduleId: 'schedule-123',
          user: testUser,
          dateStatuses: new Map(),
        })
      ).toThrow('回答IDは必須です');

      expect(() =>
        Response.create({
          id: 'response-123',
          scheduleId: '',
          user: testUser,
          dateStatuses: new Map(),
        })
      ).toThrow('スケジュールIDは必須です');
    });


    it('should use provided timestamps', () => {
      const createdAt = new Date('2024-01-01');
      const updatedAt = new Date('2024-01-02');

      const response = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses: new Map(),
        createdAt,
        updatedAt,
      });

      expect(response.createdAt).toEqual(createdAt);
      expect(response.updatedAt).toEqual(updatedAt);
    });
  });

  describe('updateStatuses', () => {
    let response: Response;

    beforeEach(() => {
      const dateStatuses = new Map([
        ['date-1', ResponseStatus.create(ResponseStatusValue.OK)],
        ['date-2', ResponseStatus.create(ResponseStatusValue.MAYBE)],
      ]);

      response = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses,
      });
    });

    it('should update existing statuses', async () => {
      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
      const newStatuses = new Map([
        ['date-1', ResponseStatus.create(ResponseStatusValue.NG)],
        ['date-3', ResponseStatus.create(ResponseStatusValue.OK)],
      ]);

      const updated = response.updateStatuses(newStatuses);

      expect(updated.id).toBe(response.id);
      expect(updated.getStatusForDate('date-1')?.value).toBe(ResponseStatusValue.NG);
      expect(updated.getStatusForDate('date-2')).toBeUndefined();
      expect(updated.getStatusForDate('date-3')?.value).toBe(ResponseStatusValue.OK);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(response.updatedAt.getTime());
    });

    it('should clear all statuses when empty map provided', () => {
      const updated = response.updateStatuses(new Map());

      expect(updated.dateStatuses.size).toBe(0);
      expect(updated.getStatusForDate('date-1')).toBeUndefined();
    });
  });


  describe('getStatusForDate', () => {
    it('should return status for existing date', () => {
      const response = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses: new Map([['date-1', ResponseStatus.create(ResponseStatusValue.OK)]]),
      });

      expect(response.getStatusForDate('date-1')?.value).toBe(ResponseStatusValue.OK);
    });

    it('should return undefined for non-existing date', () => {
      const response = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses: new Map(),
      });

      expect(response.getStatusForDate('date-1')).toBeUndefined();
    });
  });

  describe('hasResponded', () => {
    it('should return true when has date statuses', () => {
      const response = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses: new Map([['date-1', ResponseStatus.create(ResponseStatusValue.OK)]]),
      });

      expect(response.hasResponded()).toBe(true);
    });

    it('should return false when no date statuses', () => {
      const response = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses: new Map(),
      });

      expect(response.hasResponded()).toBe(false);
    });
  });

  describe('toPrimitives', () => {
    it('should convert to primitives correctly', () => {
      const dateStatuses = new Map([
        ['date-1', ResponseStatus.create(ResponseStatusValue.OK)],
        ['date-2', ResponseStatus.create(ResponseStatusValue.MAYBE)],
      ]);

      const response = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses,
      });

      const primitives = response.toPrimitives();

      expect(primitives).toEqual({
        id: 'response-123',
        scheduleId: 'schedule-123',
        user: testUser.toPrimitives(),
        dateStatuses: {
          'date-1': 'ok',
          'date-2': 'maybe',
        },
        createdAt: response.createdAt,
        updatedAt: response.updatedAt,
      });
    });

    it('should exclude undefined comment', () => {
      const response = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses: new Map(),
      });

      const primitives = response.toPrimitives();

    });
  });

  describe('fromPrimitives', () => {
    it('should create from primitives', () => {
      const primitives = {
        id: 'response-123',
        scheduleId: 'schedule-123',
        user: {
          id: 'user-123',
          username: 'TestUser',
        },
        dateStatuses: {
          'date-1': 'ok' as const,
          'date-2': 'maybe' as const,
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      const response = Response.fromPrimitives(primitives);

      expect(response.id).toBe('response-123');
      expect(response.scheduleId).toBe('schedule-123');
      expect(response.user.id).toBe('user-123');
      expect(response.user.username).toBe('TestUser');
      expect(response.getStatusForDate('date-1')?.value).toBe(ResponseStatusValue.OK);
      expect(response.getStatusForDate('date-2')?.value).toBe(ResponseStatusValue.MAYBE);
      expect(response.createdAt).toEqual(primitives.createdAt);
      expect(response.updatedAt).toEqual(primitives.updatedAt);
    });

    it('should handle empty date statuses', () => {
      const primitives = {
        id: 'response-123',
        scheduleId: 'schedule-123',
        user: {
          id: 'user-123',
          username: 'TestUser',
        },
        dateStatuses: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = Response.fromPrimitives(primitives);

      expect(response.dateStatuses.size).toBe(0);
    });
  });

  describe('equals', () => {
    it('should return true for same response', () => {
      const response1 = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses: new Map(),
      });

      const response2 = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-456',
        user: User.create('user-456', 'OtherUser'),
        dateStatuses: new Map(),
      });

      expect(response1.equals(response2)).toBe(true);
    });

    it('should return false for different responses', () => {
      const response1 = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses: new Map(),
      });

      const response2 = Response.create({
        id: 'response-456',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses: new Map(),
      });

      expect(response1.equals(response2)).toBe(false);
    });
  });
});

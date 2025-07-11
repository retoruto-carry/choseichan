import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseDomainService } from './ResponseDomainService';
import { Response } from '../entities/Response';
import { User } from '../entities/User';
import { Schedule } from '../entities/Schedule';
import { ScheduleDate } from '../entities/ScheduleDate';
import { ResponseStatus, ResponseStatusValue } from '../entities/ResponseStatus';

describe('ResponseDomainService', () => {
  let service: ResponseDomainService;
  let testSchedule: Schedule;
  let testUser: User;

  beforeEach(() => {
    service = new ResponseDomainService();

    // Create test user
    testUser = User.create('user-123', 'TestUser');

    // Create test schedule with dates
    testSchedule = Schedule.create({
      id: 'schedule-123',
      guildId: 'guild-123',
      channelId: 'channel-123',
      title: 'Test Schedule',
      dates: [
        ScheduleDate.create('date-1', '2024/01/20 19:00'),
        ScheduleDate.create('date-2', '2024/01/21 19:00'),
        ScheduleDate.create('date-3', '2024/01/22 19:00')
      ],
      createdBy: testUser,
      authorId: 'user-123'
    });
  });

  describe('canRespond', () => {
    it('should allow response when schedule is open', () => {
      const result = service.canRespond(testSchedule, 'user-456');
      expect(result.canRespond).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should allow author to respond when schedule is closed', () => {
      const closedSchedule = testSchedule.close();
      const result = service.canRespond(closedSchedule, 'user-123');
      expect(result.canRespond).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny non-author response when schedule is closed', () => {
      const closedSchedule = testSchedule.close();
      const result = service.canRespond(closedSchedule, 'user-456');
      expect(result.canRespond).toBe(false);
      expect(result.reason).toBe('締め切られたスケジュールには作成者以外は回答できません');
    });

    it('should allow response when deadline has not passed', () => {
      const futureDeadline = new Date();
      futureDeadline.setDate(futureDeadline.getDate() + 1);
      const scheduleWithDeadline = testSchedule.updateDeadline(futureDeadline);
      
      const result = service.canRespond(scheduleWithDeadline, 'user-456');
      expect(result.canRespond).toBe(true);
    });

    it('should allow author to respond when deadline has passed', () => {
      const pastDeadline = new Date();
      pastDeadline.setDate(pastDeadline.getDate() - 1);
      const scheduleWithDeadline = testSchedule.updateDeadline(pastDeadline);
      
      const result = service.canRespond(scheduleWithDeadline, 'user-123');
      expect(result.canRespond).toBe(true);
    });

    it('should deny non-author response when deadline has passed', () => {
      const pastDeadline = new Date();
      pastDeadline.setDate(pastDeadline.getDate() - 1);
      const scheduleWithDeadline = testSchedule.updateDeadline(pastDeadline);
      
      const result = service.canRespond(scheduleWithDeadline, 'user-456');
      expect(result.canRespond).toBe(false);
      expect(result.reason).toBe('締切を過ぎたスケジュールには作成者以外は回答できません');
    });
  });

  describe('createResponse', () => {
    it('should create response with all dates', () => {
      const responseData = [
        { dateId: 'date-1', status: ResponseStatusValue.OK },
        { dateId: 'date-2', status: ResponseStatusValue.MAYBE },
        { dateId: 'date-3', status: ResponseStatusValue.NG }
      ];

      const response = service.createResponse(
        'resp-123',
        testSchedule,
        testUser,
        responseData,
        'Test comment'
      );

      expect(response.id).toBe('resp-123');
      expect(response.scheduleId).toBe('schedule-123');
      expect(response.user.id).toBe('user-123');
      expect(response.comment).toBe('Test comment');
      expect(response.dateStatuses.size).toBe(3);
      expect(response.getStatusForDate('date-1')).toBe(ResponseStatusValue.OK);
      expect(response.getStatusForDate('date-2')).toBe(ResponseStatusValue.MAYBE);
      expect(response.getStatusForDate('date-3')).toBe(ResponseStatusValue.NG);
    });

    it('should create response without comment', () => {
      const responseData = [
        { dateId: 'date-1', status: ResponseStatusValue.OK }
      ];

      const response = service.createResponse(
        'resp-123',
        testSchedule,
        testUser,
        responseData
      );

      expect(response.comment).toBeUndefined();
    });

    it('should ignore invalid date IDs', () => {
      const responseData = [
        { dateId: 'date-1', status: ResponseStatusValue.OK },
        { dateId: 'invalid-date', status: ResponseStatusValue.OK }, // Invalid
        { dateId: 'date-2', status: ResponseStatusValue.MAYBE }
      ];

      const response = service.createResponse(
        'resp-123',
        testSchedule,
        testUser,
        responseData
      );

      expect(response.dateStatuses.size).toBe(2);
      expect(response.getStatusForDate('date-1')).toBe(ResponseStatusValue.OK);
      expect(response.getStatusForDate('date-2')).toBe(ResponseStatusValue.MAYBE);
      expect(response.getStatusForDate('invalid-date')).toBeUndefined();
    });

    it('should handle empty response data', () => {
      const response = service.createResponse(
        'resp-123',
        testSchedule,
        testUser,
        []
      );

      expect(response.dateStatuses.size).toBe(0);
    });
  });

  describe('updateResponse', () => {
    let existingResponse: Response;

    beforeEach(() => {
      existingResponse = Response.create({
        id: 'resp-123',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses: new Map([
          ['date-1', ResponseStatus.create(ResponseStatusValue.OK)],
          ['date-2', ResponseStatus.create(ResponseStatusValue.MAYBE)]
        ]),
        comment: 'Original comment'
      });
    });

    it('should update response statuses', () => {
      const newData = [
        { dateId: 'date-1', status: ResponseStatusValue.NG }, // Changed
        { dateId: 'date-2', status: ResponseStatusValue.OK }, // Changed
        { dateId: 'date-3', status: ResponseStatusValue.MAYBE } // New
      ];

      const updatedResponse = service.updateResponse(
        existingResponse,
        testSchedule,
        newData,
        'Updated comment'
      );

      expect(updatedResponse.id).toBe('resp-123');
      expect(updatedResponse.getStatusForDate('date-1')).toBe(ResponseStatusValue.NG);
      expect(updatedResponse.getStatusForDate('date-2')).toBe(ResponseStatusValue.OK);
      expect(updatedResponse.getStatusForDate('date-3')).toBe(ResponseStatusValue.MAYBE);
      expect(updatedResponse.comment).toBe('Updated comment');
    });

    it('should clear statuses when empty data provided', () => {
      const updatedResponse = service.updateResponse(
        existingResponse,
        testSchedule,
        []
      );

      expect(updatedResponse.dateStatuses.size).toBe(0);
    });

    it('should preserve comment when not provided', () => {
      const newData = [
        { dateId: 'date-1', status: ResponseStatusValue.NG }
      ];

      const updatedResponse = service.updateResponse(
        existingResponse,
        testSchedule,
        newData
      );

      expect(updatedResponse.comment).toBe('Original comment');
    });

    it('should update comment when provided', () => {
      const updatedResponse = service.updateResponse(
        existingResponse,
        testSchedule,
        [],
        'New comment'
      );

      expect(updatedResponse.comment).toBe('New comment');
    });

    it('should ignore invalid date IDs in update', () => {
      const newData = [
        { dateId: 'date-1', status: ResponseStatusValue.OK },
        { dateId: 'invalid-date', status: ResponseStatusValue.OK }
      ];

      const updatedResponse = service.updateResponse(
        existingResponse,
        testSchedule,
        newData
      );

      expect(updatedResponse.dateStatuses.size).toBe(1);
      expect(updatedResponse.getStatusForDate('date-1')).toBe(ResponseStatusValue.OK);
      expect(updatedResponse.getStatusForDate('invalid-date')).toBeUndefined();
    });
  });

  describe('mergeResponses', () => {
    it('should merge multiple responses keeping latest', () => {
      const response1 = Response.create({
        id: 'resp-1',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses: new Map([
          ['date-1', ResponseStatus.create(ResponseStatusValue.OK)]
        ]),
        updatedAt: new Date('2024-01-01')
      });

      const response2 = Response.create({
        id: 'resp-2',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses: new Map([
          ['date-1', ResponseStatus.create(ResponseStatusValue.NG)],
          ['date-2', ResponseStatus.create(ResponseStatusValue.MAYBE)]
        ]),
        updatedAt: new Date('2024-01-02')
      });

      const response3 = Response.create({
        id: 'resp-3',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses: new Map([
          ['date-2', ResponseStatus.create(ResponseStatusValue.OK)]
        ]),
        comment: 'Latest comment',
        updatedAt: new Date('2024-01-03')
      });

      const merged = service.mergeResponses([response1, response2, response3]);

      expect(merged.id).toBe('resp-3'); // Latest response ID
      expect(merged.getStatusForDate('date-1')).toBe(ResponseStatusValue.NG); // From response2
      expect(merged.getStatusForDate('date-2')).toBe(ResponseStatusValue.OK); // From response3
      expect(merged.comment).toBe('Latest comment');
    });

    it('should handle single response', () => {
      const response = Response.create({
        id: 'resp-1',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses: new Map([
          ['date-1', ResponseStatus.create(ResponseStatusValue.OK)]
        ])
      });

      const merged = service.mergeResponses([response]);
      expect(merged).toEqual(response);
    });

    it('should handle empty array', () => {
      expect(() => service.mergeResponses([])).toThrow('少なくとも1つの回答が必要です');
    });

    it('should validate all responses are for same schedule and user', () => {
      const response1 = Response.create({
        id: 'resp-1',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses: new Map()
      });

      const response2 = Response.create({
        id: 'resp-2',
        scheduleId: 'schedule-456', // Different schedule
        user: testUser,
        dateStatuses: new Map()
      });

      expect(() => service.mergeResponses([response1, response2]))
        .toThrow('すべての回答は同じスケジュールのものである必要があります');
    });

    it('should validate all responses are from same user', () => {
      const otherUser = User.create('user-456', 'OtherUser');

      const response1 = Response.create({
        id: 'resp-1',
        scheduleId: 'schedule-123',
        user: testUser,
        dateStatuses: new Map()
      });

      const response2 = Response.create({
        id: 'resp-2',
        scheduleId: 'schedule-123',
        user: otherUser, // Different user
        dateStatuses: new Map()
      });

      expect(() => service.mergeResponses([response1, response2]))
        .toThrow('すべての回答は同じユーザーのものである必要があります');
    });
  });
});
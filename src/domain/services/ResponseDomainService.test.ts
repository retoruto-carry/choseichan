import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseDomainService, UserResponseData } from './ResponseDomainService';
import { Response } from '../entities/Response';
import { User } from '../entities/User';
import { Schedule } from '../entities/Schedule';
import { ScheduleDate } from '../entities/ScheduleDate';
import { ResponseStatus, ResponseStatusValue } from '../entities/ResponseStatus';

describe('ResponseDomainService', () => {
  let testSchedule: Schedule;
  let testUser: User;
  let testResponses: Response[];

  beforeEach(() => {
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

    // Create test responses
    const user1 = User.create('user-1', 'User1');
    const user2 = User.create('user-2', 'User2');
    const user3 = User.create('user-3', 'User3');

    testResponses = [
      Response.create({
        id: 'response-1',
        scheduleId: 'schedule-123',
        user: user1,
        dateStatuses: new Map([
          ['date-1', ResponseStatus.create(ResponseStatusValue.OK)],
          ['date-2', ResponseStatus.create(ResponseStatusValue.OK)],
          ['date-3', ResponseStatus.create(ResponseStatusValue.MAYBE)]
        ])
      }),
      Response.create({
        id: 'response-2',
        scheduleId: 'schedule-123',
        user: user2,
        dateStatuses: new Map([
          ['date-1', ResponseStatus.create(ResponseStatusValue.OK)],
          ['date-2', ResponseStatus.create(ResponseStatusValue.MAYBE)],
          ['date-3', ResponseStatus.create(ResponseStatusValue.NG)]
        ])
      }),
      Response.create({
        id: 'response-3',
        scheduleId: 'schedule-123',
        user: user3,
        dateStatuses: new Map([
          ['date-1', ResponseStatus.create(ResponseStatusValue.NG)],
          ['date-2', ResponseStatus.create(ResponseStatusValue.NG)],
          ['date-3', ResponseStatus.create(ResponseStatusValue.NG)]
        ])
      })
    ];
  });

  describe('validateResponse', () => {
    it('should validate response successfully', () => {
      const responseData: UserResponseData[] = [
        { dateId: 'date-1', status: ResponseStatus.create(ResponseStatusValue.OK) },
        { dateId: 'date-2', status: ResponseStatus.create(ResponseStatusValue.MAYBE) }
      ];

      const result = ResponseDomainService.validateResponse(testSchedule, responseData, 'テストコメント');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject response when schedule is closed', () => {
      const closedSchedule = testSchedule.close();
      const responseData: UserResponseData[] = [
        { dateId: 'date-1', status: ResponseStatus.create(ResponseStatusValue.OK) }
      ];

      const result = ResponseDomainService.validateResponse(closedSchedule, responseData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('この日程調整は締め切られています');
    });

    it('should reject response with invalid date IDs', () => {
      const responseData: UserResponseData[] = [
        { dateId: 'invalid-date', status: ResponseStatus.create(ResponseStatusValue.OK) }
      ];

      const result = ResponseDomainService.validateResponse(testSchedule, responseData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('無効な日程候補です');
    });

    it('should reject duplicate responses for same date', () => {
      const responseData: UserResponseData[] = [
        { dateId: 'date-1', status: ResponseStatus.create(ResponseStatusValue.OK) },
        { dateId: 'date-1', status: ResponseStatus.create(ResponseStatusValue.NG) }
      ];

      const result = ResponseDomainService.validateResponse(testSchedule, responseData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('同じ日程に対して複数の回答があります');
    });

    it('should reject comment over 500 characters', () => {
      const responseData: UserResponseData[] = [
        { dateId: 'date-1', status: ResponseStatus.create(ResponseStatusValue.OK) }
      ];
      const longComment = 'あ'.repeat(501);

      const result = ResponseDomainService.validateResponse(testSchedule, responseData, longComment);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('コメントは500文字以内で入力してください');
    });
  });

  describe('createOrUpdateResponse', () => {
    it('should create new response', () => {
      const responseData: UserResponseData[] = [
        { dateId: 'date-1', status: ResponseStatus.create(ResponseStatusValue.OK) },
        { dateId: 'date-2', status: ResponseStatus.create(ResponseStatusValue.MAYBE) }
      ];

      const response = ResponseDomainService.createOrUpdateResponse(
        'schedule-123',
        testUser,
        responseData,
        'テストコメント'
      );

      expect(response.scheduleId).toBe('schedule-123');
      expect(response.user.id).toBe('user-123');
      expect(response.getStatusForDate('date-1')?.value).toBe(ResponseStatusValue.OK);
      expect(response.getStatusForDate('date-2')?.value).toBe(ResponseStatusValue.MAYBE);
      expect(response.comment).toBe('テストコメント');
    });

    it('should update existing response', () => {
      const existingResponse = testResponses[0];
      const responseData: UserResponseData[] = [
        { dateId: 'date-1', status: ResponseStatus.create(ResponseStatusValue.NG) },
        { dateId: 'date-2', status: ResponseStatus.create(ResponseStatusValue.NG) }
      ];

      const updatedResponse = ResponseDomainService.createOrUpdateResponse(
        'schedule-123',
        testUser,
        responseData,
        '更新されたコメント',
        existingResponse
      );

      expect(updatedResponse.scheduleId).toBe('schedule-123');
      expect(updatedResponse.getStatusForDate('date-1')?.value).toBe(ResponseStatusValue.NG);
      expect(updatedResponse.getStatusForDate('date-2')?.value).toBe(ResponseStatusValue.NG);
      expect(updatedResponse.comment).toBe('更新されたコメント');
    });
  });

  describe('calculateResponseStatistics', () => {
    it('should calculate statistics correctly', () => {
      const dateIds = ['date-1', 'date-2', 'date-3'];
      const stats = ResponseDomainService.calculateResponseStatistics(testResponses, dateIds);

      expect(stats.totalUsers).toBe(3);
      
      // Check date-1 statistics
      expect(stats.responsesByDate['date-1'].yes).toBe(2);
      expect(stats.responsesByDate['date-1'].maybe).toBe(0);
      expect(stats.responsesByDate['date-1'].no).toBe(1);
      expect(stats.responsesByDate['date-1'].total).toBe(3);

      // Check overall participation
      expect(stats.overallParticipation.fullyAvailable).toBe(0); // No one said yes to all dates
      expect(stats.overallParticipation.partiallyAvailable).toBe(2); // Two users have some yes/maybe
      expect(stats.overallParticipation.unavailable).toBe(1); // One user said no to all
    });

    it('should handle empty responses', () => {
      const dateIds = ['date-1', 'date-2'];
      const stats = ResponseDomainService.calculateResponseStatistics([], dateIds);

      expect(stats.totalUsers).toBe(0);
      expect(stats.responsesByDate['date-1'].total).toBe(0);
      expect(stats.overallParticipation.fullyAvailable).toBe(0);
    });
  });

  describe('findOptimalDates', () => {
    it('should find optimal date with most yes votes', () => {
      const dateIds = ['date-1', 'date-2', 'date-3'];
      const result = ResponseDomainService.findOptimalDates(testResponses, dateIds);

      expect(result.optimalDateId).toBe('date-1'); // Has 2 yes votes
      expect(result.alternativeDateIds).toContain('date-2'); // Has 1 yes vote
      expect(result.scores['date-1']).toBeGreaterThan(result.scores['date-2']);
    });

    it('should respect minimum participants option', () => {
      const dateIds = ['date-1', 'date-2', 'date-3'];
      const result = ResponseDomainService.findOptimalDates(testResponses, dateIds, {
        minimumParticipants: 7 // Set higher than any score
      });

      expect(result.optimalDateId).toBeUndefined(); // No date has score >= 7
      expect(result.alternativeDateIds).toHaveLength(0);
    });

    it('should handle includeMaybe option', () => {
      const dateIds = ['date-1', 'date-2', 'date-3'];
      const resultWithMaybe = ResponseDomainService.findOptimalDates(testResponses, dateIds, {
        includeMaybe: true
      });
      const resultWithoutMaybe = ResponseDomainService.findOptimalDates(testResponses, dateIds, {
        includeMaybe: false
      });

      // date-3 has 1 maybe vote, so scores should differ
      expect(resultWithMaybe.scores['date-3']).toBeGreaterThan(resultWithoutMaybe.scores['date-3']);
    });
  });

  describe('hasUserResponded', () => {
    it('should return true when user has responded', () => {
      const result = ResponseDomainService.hasUserResponded(testResponses, 'user-1');
      expect(result).toBe(true);
    });

    it('should return false when user has not responded', () => {
      const result = ResponseDomainService.hasUserResponded(testResponses, 'user-999');
      expect(result).toBe(false);
    });
  });

  describe('getUserResponse', () => {
    it('should return user response when exists', () => {
      const response = ResponseDomainService.getUserResponse(testResponses, 'user-1');
      expect(response).toBeDefined();
      expect(response?.user.id).toBe('user-1');
    });

    it('should return undefined when user response does not exist', () => {
      const response = ResponseDomainService.getUserResponse(testResponses, 'user-999');
      expect(response).toBeUndefined();
    });
  });
});
import { describe, expect, it } from 'vitest';
import { Response } from '../../domain/entities/Response';
import { ResponseStatus } from '../../domain/entities/ResponseStatus';
import { Schedule, ScheduleStatus } from '../../domain/entities/Schedule';
import { ScheduleDate } from '../../domain/entities/ScheduleDate';
import { User } from '../../domain/entities/User';
import { DomainMappers } from './DomainMappers';

describe('DomainMappers', () => {
  describe('scheduleToResponse', () => {
    it('should map schedule entity to response DTO', () => {
      const schedule = Schedule.create({
        id: 'schedule-123',
        guildId: 'guild-456',
        channelId: 'channel-789',
        messageId: 'message-101',
        title: 'Test Schedule',
        description: 'Test Description',
        dates: [
          ScheduleDate.create('date-1', '2024-12-25 19:00'),
          ScheduleDate.create('date-2', '2024-12-26 20:00'),
        ],
        createdBy: User.create('user-123', 'TestUser', 'Test Display'),
        authorId: 'user-123',
        deadline: new Date('2024-12-20T23:59:59Z'),
        reminderTimings: ['1d', '8h'],
        reminderMentions: ['@everyone'],
        remindersSent: ['1d'],
        status: ScheduleStatus.OPEN,
        notificationSent: false,
        totalResponses: 5,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-02T15:30:00Z'),
      });

      const result = DomainMappers.scheduleToResponseDto(schedule);

      expect(result).toEqual({
        id: 'schedule-123',
        guildId: 'guild-456',
        channelId: 'channel-789',
        messageId: 'message-101',
        title: 'Test Schedule',
        description: 'Test Description',
        dates: [
          { id: 'date-1', datetime: '2024-12-25 19:00' },
          { id: 'date-2', datetime: '2024-12-26 20:00' },
        ],
        createdBy: {
          id: 'user-123',
          username: 'TestUser',
          displayName: 'Test Display',
        },
        authorId: 'user-123',
        deadline: '2024-12-20T23:59:59.000Z',
        reminderTimings: ['1d', '8h'],
        reminderMentions: ['@everyone'],
        remindersSent: ['1d'],
        status: 'open',
        notificationSent: false,
        totalResponses: 5,
        createdAt: '2024-01-01T10:00:00.000Z',
        updatedAt: '2024-01-02T15:30:00.000Z',
      });
    });

    it('should handle schedule without optional fields', () => {
      const schedule = Schedule.create({
        id: 'schedule-123',
        guildId: 'guild-456',
        channelId: 'channel-789',
        title: 'Minimal Schedule',
        dates: [ScheduleDate.create('date-1', '2024-12-25 19:00')],
        createdBy: User.create('user-123', 'TestUser'),
        authorId: 'user-123',
      });

      const result = DomainMappers.scheduleToResponseDto(schedule);

      expect(result.description).toBeUndefined();
      expect(result.messageId).toBeUndefined();
      expect(result.deadline).toBeUndefined();
      // デフォルト値が設定される
      expect(result.reminderTimings).toEqual(['3d', '1d', '8h']);
      expect(result.reminderMentions).toEqual(['@here']);
      expect(result.remindersSent).toBeUndefined();
      expect(result.createdBy.displayName).toBe('TestUser'); // Falls back to username
    });

    it('should map closed schedule status correctly', () => {
      const schedule = Schedule.create({
        id: 'schedule-123',
        guildId: 'guild-456',
        channelId: 'channel-789',
        title: 'Closed Schedule',
        dates: [ScheduleDate.create('date-1', '2024-12-25 19:00')],
        createdBy: User.create('user-123', 'TestUser'),
        authorId: 'user-123',
        status: ScheduleStatus.CLOSED,
      });

      const result = DomainMappers.scheduleToResponseDto(schedule);

      expect(result.status).toBe('closed');
    });
  });

  describe('responseToDto', () => {
    it('should map response entity to DTO', () => {
      const dateStatuses = new Map<string, ResponseStatus>();
      dateStatuses.set('date-1', ResponseStatus.fromString('ok'));
      dateStatuses.set('date-2', ResponseStatus.fromString('maybe'));
      dateStatuses.set('date-3', ResponseStatus.fromString('ng'));

      const response = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-456',
        user: User.create('user-789', 'RespondentUser', 'Respondent Display'),
        dateStatuses,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-02T15:30:00Z'),
      });

      const result = DomainMappers.responseToDto(response);

      expect(result).toEqual({
        scheduleId: 'schedule-456',
        userId: 'user-789',
        username: 'RespondentUser',
        displayName: 'Respondent Display',
        dateStatuses: {
          'date-1': 'ok',
          'date-2': 'maybe',
          'date-3': 'ng',
        },
        updatedAt: '2024-01-02T15:30:00.000Z',
      });
    });

    it('should handle response without comment and display name', () => {
      const dateStatuses = new Map<string, ResponseStatus>();
      dateStatuses.set('date-1', ResponseStatus.fromString('ok'));

      const response = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-456',
        user: User.create('user-789', 'RespondentUser'),
        dateStatuses,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-02T15:30:00Z'),
      });

      const result = DomainMappers.responseToDto(response);

      expect(result.displayName).toBeUndefined();
      expect(result.username).toBe('RespondentUser');
      expect(result.dateStatuses).toEqual({ 'date-1': 'ok' });
    });

    it('should handle empty date statuses', () => {
      const dateStatuses = new Map<string, ResponseStatus>();

      const response = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-456',
        user: User.create('user-789', 'RespondentUser'),
        dateStatuses,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-02T15:30:00Z'),
      });

      const result = DomainMappers.responseToDto(response);

      expect(result.dateStatuses).toEqual({});
    });

    it('should handle multiple date statuses with various values', () => {
      const dateStatuses = new Map<string, ResponseStatus>();
      dateStatuses.set('date-1', ResponseStatus.fromString('ok'));
      dateStatuses.set('date-2', ResponseStatus.fromString('ok'));
      dateStatuses.set('date-3', ResponseStatus.fromString('maybe'));
      dateStatuses.set('date-4', ResponseStatus.fromString('maybe'));
      dateStatuses.set('date-5', ResponseStatus.fromString('ng'));

      const response = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-456',
        user: User.create('user-789', 'RespondentUser'),
        dateStatuses,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-02T15:30:00Z'),
      });

      const result = DomainMappers.responseToDto(response);

      expect(result.dateStatuses).toEqual({
        'date-1': 'ok',
        'date-2': 'ok',
        'date-3': 'maybe',
        'date-4': 'maybe',
        'date-5': 'ng',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle very long titles and descriptions', () => {
      const longTitle = 'A'.repeat(500);
      const longDescription = 'B'.repeat(2000);

      const schedule = Schedule.create({
        id: 'schedule-123',
        guildId: 'guild-456',
        channelId: 'channel-789',
        title: longTitle,
        description: longDescription,
        dates: [ScheduleDate.create('date-1', '2024-12-25 19:00')],
        createdBy: User.create('user-123', 'TestUser'),
        authorId: 'user-123',
      });

      const result = DomainMappers.scheduleToResponseDto(schedule);

      expect(result.title).toBe(longTitle);
      expect(result.description).toBe(longDescription);
    });

    it('should handle special characters in usernames', () => {
      const dateStatuses = new Map<string, ResponseStatus>();
      dateStatuses.set('date-1', ResponseStatus.fromString('ok'));

      const response = Response.create({
        id: 'response-123',
        scheduleId: 'schedule-456',
        user: User.create('user-789', 'テストユーザー🎉', 'ディスプレイ名 #123'),
        dateStatuses,
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-02T15:30:00Z'),
      });

      const result = DomainMappers.responseToDto(response);

      expect(result.username).toBe('テストユーザー🎉');
      expect(result.displayName).toBe('ディスプレイ名 #123');
    });

    it('should handle many dates in schedule', () => {
      const dates = Array.from({ length: 20 }, (_, i) =>
        ScheduleDate.create(`date-${i}`, `2024-12-${(i % 30) + 1} 19:00`)
      );

      const schedule = Schedule.create({
        id: 'schedule-123',
        guildId: 'guild-456',
        channelId: 'channel-789',
        title: 'Schedule with Many Dates',
        dates,
        createdBy: User.create('user-123', 'TestUser'),
        authorId: 'user-123',
      });

      const result = DomainMappers.scheduleToResponseDto(schedule);

      expect(result.dates).toHaveLength(20);
      expect(result.dates[0]).toEqual({ id: 'date-0', datetime: '2024-12-1 19:00' });
      expect(result.dates[19]).toEqual({ id: 'date-19', datetime: '2024-12-20 19:00' });
    });
  });
});

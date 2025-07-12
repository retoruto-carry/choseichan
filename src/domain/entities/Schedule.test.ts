/**
 * Schedule Domain Entity Unit Tests
 *
 * ドメインエンティティのユニットテスト
 * ビジネスロジックと不変性の検証
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Schedule, ScheduleStatus } from './Schedule';
import { ScheduleDate } from './ScheduleDate';
import { User } from './User';

describe('Schedule Domain Entity', () => {
  let validUser: User;
  let validDates: ScheduleDate[];

  beforeEach(() => {
    validUser = User.create('user123', 'testuser');
    validDates = [
      ScheduleDate.create('date1', '2024-12-01 10:00'),
      ScheduleDate.create('date2', '2024-12-02 14:00'),
    ];
  });

  describe('Schedule Creation', () => {
    it('should create a valid schedule with required fields', () => {
      const schedule = Schedule.create({
        id: 'schedule1',
        guildId: 'guild123',
        channelId: 'channel123',
        title: 'Test Schedule',
        description: 'Test description',
        dates: validDates,
        createdBy: validUser,
        authorId: 'user123',
      });

      expect(schedule.id).toBe('schedule1');
      expect(schedule.guildId).toBe('guild123');
      expect(schedule.channelId).toBe('channel123');
      expect(schedule.title).toBe('Test Schedule');
      expect(schedule.description).toBe('Test description');
      expect(schedule.dates).toEqual(validDates);
      expect(schedule.createdBy).toEqual(validUser);
      expect(schedule.authorId).toBe('user123');
      expect(schedule.status).toBe(ScheduleStatus.OPEN);
      expect(schedule.notificationSent).toBe(false);
      expect(schedule.totalResponses).toBe(0);
      expect(schedule.createdAt).toBeInstanceOf(Date);
      expect(schedule.updatedAt).toBeInstanceOf(Date);
    });

    it('should create schedule with deadline', () => {
      const deadline = new Date('2024-12-15 23:59:59');

      const schedule = Schedule.create({
        id: 'schedule1',
        guildId: 'guild123',
        channelId: 'channel123',
        title: 'Test Schedule',
        dates: validDates,
        createdBy: validUser,
        authorId: 'user123',
        deadline,
      });

      expect(schedule.deadline).toEqual(deadline);
    });

    it('should create schedule with reminder settings', () => {
      const reminderTimings = ['1d', '8h', '30m'];
      const reminderMentions = ['@here', '@everyone'];

      const schedule = Schedule.create({
        id: 'schedule1',
        guildId: 'guild123',
        channelId: 'channel123',
        title: 'Test Schedule',
        dates: validDates,
        createdBy: validUser,
        authorId: 'user123',
        reminderTimings,
        reminderMentions,
      });

      expect(schedule.reminderTimings).toEqual(reminderTimings);
      expect(schedule.reminderMentions).toEqual(reminderMentions);
      expect(schedule.remindersSent).toBeUndefined();
    });

    it('should throw error for invalid title', () => {
      expect(() => {
        Schedule.create({
          id: 'schedule1',
          guildId: 'guild123',
          channelId: 'channel123',
          title: '', // Invalid empty title
          dates: validDates,
          createdBy: validUser,
          authorId: 'user123',
        });
      }).toThrow('Title cannot be empty');
    });

    it('should create schedule with long title', () => {
      const longTitle = 'a'.repeat(257); // Over 256 characters

      // Current implementation doesn't validate title length
      const schedule = Schedule.create({
        id: 'schedule1',
        guildId: 'guild123',
        channelId: 'channel123',
        title: longTitle,
        dates: validDates,
        createdBy: validUser,
        authorId: 'user123',
      });

      expect(schedule.title).toBe(longTitle);
    });

    it('should throw error for empty dates', () => {
      expect(() => {
        Schedule.create({
          id: 'schedule1',
          guildId: 'guild123',
          channelId: 'channel123',
          title: 'Test Schedule',
          dates: [], // Empty dates
          createdBy: validUser,
          authorId: 'user123',
        });
      }).toThrow('Schedule must have at least one date');
    });

    it('should create schedule with many dates', () => {
      const manyDates = Array.from({ length: 26 }, (_, i) =>
        ScheduleDate.create(`date${i}`, `2024-12-${(i % 30) + 1} 10:00`)
      );

      // Current implementation doesn't validate date count
      const schedule = Schedule.create({
        id: 'schedule1',
        guildId: 'guild123',
        channelId: 'channel123',
        title: 'Test Schedule',
        dates: manyDates,
        createdBy: validUser,
        authorId: 'user123',
      });

      expect(schedule.dates).toHaveLength(26);
    });

    it('should create schedule with past deadline', () => {
      const pastDeadline = new Date('2020-01-01');

      // Current implementation doesn't validate deadline
      const schedule = Schedule.create({
        id: 'schedule1',
        guildId: 'guild123',
        channelId: 'channel123',
        title: 'Test Schedule',
        dates: validDates,
        createdBy: validUser,
        authorId: 'user123',
        deadline: pastDeadline,
      });

      expect(schedule.deadline).toEqual(pastDeadline);
    });
  });

  describe('Schedule Operations', () => {
    let schedule: Schedule;

    beforeEach(() => {
      schedule = Schedule.create({
        id: 'schedule1',
        guildId: 'guild123',
        channelId: 'channel123',
        title: 'Test Schedule',
        dates: validDates,
        createdBy: validUser,
        authorId: 'user123',
      });
    });

    it('should close schedule', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10)); // Ensure time difference
      const closedSchedule = schedule.close();

      expect(closedSchedule.status).toBe(ScheduleStatus.CLOSED);
      expect(closedSchedule.updatedAt.getTime()).toBeGreaterThanOrEqual(
        schedule.updatedAt.getTime()
      );
      expect(closedSchedule.id).toBe(schedule.id); // Other fields unchanged
    });

    it('should reopen schedule', async () => {
      const closedSchedule = schedule.close();
      await new Promise((resolve) => setTimeout(resolve, 10)); // Ensure time difference
      const reopenedSchedule = closedSchedule.reopen();

      expect(reopenedSchedule.status).toBe(ScheduleStatus.OPEN);
      expect(reopenedSchedule.updatedAt.getTime()).toBeGreaterThanOrEqual(
        closedSchedule.updatedAt.getTime()
      );
    });

    it('should check if deadline is passed', () => {
      const futureDeadline = new Date(Date.now() + 86400000); // 24 hours later
      const pastDeadline = new Date(Date.now() - 86400000); // 24 hours ago

      const scheduleWithFutureDeadline = Schedule.create({
        id: 'schedule1',
        guildId: 'guild123',
        channelId: 'channel123',
        title: 'Test Schedule',
        dates: validDates,
        createdBy: validUser,
        authorId: 'user123',
        deadline: futureDeadline,
      });

      const scheduleWithPastDeadline = Schedule.create({
        id: 'schedule2',
        guildId: 'guild123',
        channelId: 'channel123',
        title: 'Test Schedule',
        dates: validDates,
        createdBy: validUser,
        authorId: 'user123',
        deadline: pastDeadline,
      });

      expect(scheduleWithFutureDeadline.isDeadlinePassed()).toBe(false);
      expect(scheduleWithPastDeadline.isDeadlinePassed()).toBe(true);
      expect(schedule.isDeadlinePassed()).toBe(false); // No deadline
    });

    it('should check if user can edit schedule', () => {
      expect(schedule.canBeEditedBy('user123')).toBe(true); // Author can edit
      expect(schedule.canBeEditedBy('otheruser')).toBe(false); // Other user cannot edit
    });

    it('should update schedule properties', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1)); // Ensure time difference

      const updatedTitle = schedule.updateTitle('Updated Title');
      const updatedDescription = updatedTitle.updateDescription('Updated description');
      const updatedMessage = updatedDescription.updateMessageId('msg123');

      expect(updatedMessage.title).toBe('Updated Title');
      expect(updatedMessage.description).toBe('Updated description');
      expect(updatedMessage.messageId).toBe('msg123');
      expect(updatedMessage.updatedAt.getTime()).toBeGreaterThan(schedule.updatedAt.getTime());
      expect(updatedMessage.id).toBe(schedule.id); // ID unchanged
    });

    it('should update total responses', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10)); // 時間差を確保
      const updatedSchedule = schedule.updateTotalResponses(5);

      expect(updatedSchedule.totalResponses).toBe(5);
      expect(updatedSchedule.updatedAt.getTime()).toBeGreaterThanOrEqual(schedule.updatedAt.getTime());
    });

    it('should add new date', () => {
      const newDate = ScheduleDate.create('date3', '2024-12-03 16:00');
      const scheduleWithNewDate = schedule.addDate(newDate);

      expect(scheduleWithNewDate.dates).toHaveLength(3);
      expect(scheduleWithNewDate.dates[2]).toEqual(newDate);
    });

    it('should not add duplicate date', () => {
      const duplicateDate = ScheduleDate.create('date1', '2024-12-01 10:00');

      expect(() => {
        schedule.addDate(duplicateDate);
      }).toThrow('Date already exists in schedule');
    });

    it('should convert to primitives', () => {
      const primitives = schedule.toPrimitives();

      expect(primitives.id).toBe(schedule.id);
      expect(primitives.title).toBe(schedule.title);
      expect(primitives.dates).toEqual(schedule.dates.map((d) => d.toPrimitives()));
      expect(primitives.createdBy).toEqual(schedule.createdBy.toPrimitives());
      expect(primitives.createdAt).toEqual(schedule.createdAt);
      expect(primitives.updatedAt).toEqual(schedule.updatedAt);
    });
  });

  describe('Schedule Immutability', () => {
    it('should not modify original schedule when updating', () => {
      const originalSchedule = Schedule.create({
        id: 'schedule1',
        guildId: 'guild123',
        channelId: 'channel123',
        title: 'Original Title',
        dates: validDates,
        createdBy: validUser,
        authorId: 'user123',
      });

      const updatedSchedule = originalSchedule.updateTitle('New Title');

      expect(originalSchedule.title).toBe('Original Title');
      expect(updatedSchedule.title).toBe('New Title');
      expect(originalSchedule).not.toBe(updatedSchedule);
    });

    it('should not modify original schedule when closing', () => {
      const originalSchedule = Schedule.create({
        id: 'schedule1',
        guildId: 'guild123',
        channelId: 'channel123',
        title: 'Test Schedule',
        dates: validDates,
        createdBy: validUser,
        authorId: 'user123',
      });

      const closedSchedule = originalSchedule.close();

      expect(originalSchedule.status).toBe(ScheduleStatus.OPEN);
      expect(closedSchedule.status).toBe(ScheduleStatus.CLOSED);
      expect(originalSchedule).not.toBe(closedSchedule);
    });
  });

  describe('Schedule fromPrimitives', () => {
    it('should create schedule from primitives', () => {
      const primitives = {
        id: 'schedule1',
        guildId: 'guild123',
        channelId: 'channel123',
        messageId: 'msg123',
        title: 'Test Schedule',
        description: 'Test description',
        dates: [
          { id: 'date1', datetime: '2024-12-01 10:00' },
          { id: 'date2', datetime: '2024-12-02 14:00' },
        ],
        createdBy: { id: 'user123', username: 'testuser' },
        authorId: 'user123',
        deadline: new Date('2024-12-15 23:59:59'),
        reminderTimings: ['1d', '8h'],
        reminderMentions: ['@here'],
        remindersSent: ['1d'],
        status: ScheduleStatus.OPEN,
        notificationSent: false,
        totalResponses: 0,
        createdAt: new Date('2024-11-01T10:00:00Z'),
        updatedAt: new Date('2024-11-01T10:00:00Z'),
      };

      const schedule = Schedule.fromPrimitives(primitives);

      expect(schedule.id).toBe('schedule1');
      expect(schedule.title).toBe('Test Schedule');
      expect(schedule.dates).toHaveLength(2);
      expect(schedule.createdBy.id).toBe('user123');
      expect(schedule.status).toBe(ScheduleStatus.OPEN);
    });
  });
});

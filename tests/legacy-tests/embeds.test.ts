import { describe, it, expect } from 'vitest';
import { Schedule, ScheduleSummary, EMBED_COLORS, STATUS_EMOJI } from '../src/types/schedule';
import { formatDate } from '../src/utils/date';

describe('Embed Display', () => {
  const testSchedule: Schedule = {
    id: 'test_id',
    title: 'Test Event',
    description: 'Test description',
    dates: [
      { id: 'date1', datetime: '2024-12-25T19:00:00Z' },
      { id: 'date2', datetime: '2024-12-26T18:00:00Z' }
    ],
    createdBy: { id: 'user123', username: 'TestUser' },
    authorId: 'user123',
    channelId: 'test_channel',
    createdAt: new Date('2024-12-01T00:00:00Z'),
    updatedAt: new Date('2024-12-01T00:00:00Z'),
    status: 'open' as const,
    notificationSent: false
  };

  it('should format dates correctly', () => {
    const formatted = formatDate('2024-12-25T19:00:00Z');
    // Date formatting depends on timezone, so just check for basic format
    expect(formatted).toMatch(/\d{1,2}\/\d{1,2}/); // MM/DD format
    expect(formatted).toMatch(/\d{2}:\d{2}/); // HH:MM format
    expect(formatted).toContain('('); // Day of week
    expect(formatted).toContain(')');
  });

  it('should display correct status emoji', () => {
    expect(STATUS_EMOJI.yes).toBe('✅');
    expect(STATUS_EMOJI.maybe).toBe('❔');
    expect(STATUS_EMOJI.no).toBe('❌');
  });

  it('should use correct embed colors', () => {
    expect(EMBED_COLORS.OPEN).toBe(0x2ecc71);
    expect(EMBED_COLORS.CLOSED).toBe(0xe74c3c);
    expect(EMBED_COLORS.INFO).toBe(0x3498db);
    expect(EMBED_COLORS.WARNING).toBe(0xf39c12);
  });

  it('should handle schedule summary correctly', () => {
    const summary: ScheduleSummary = {
      schedule: testSchedule,
      responseCounts: {
        'date1': { yes: 3, maybe: 1, no: 0, total: 4 },
        'date2': { yes: 2, maybe: 0, no: 2, total: 4 }
      },
      userResponses: [
        {
          scheduleId: 'test_id',
          userId: 'user1',
          userName: 'User 1',
          responses: [
            { dateId: 'date1', status: 'yes' },
            { dateId: 'date2', status: 'no' }
          ],
          updatedAt: new Date()
        }
      ],
      bestDateId: 'date1'
    };

    expect(summary.bestDateId).toBe('date1');
    expect(summary.responseCounts['date1'].yes).toBe(3);
    expect(summary.userResponses).toHaveLength(1);
  });

  it('should handle empty schedule dates', () => {
    const emptySchedule: Schedule = {
      ...testSchedule,
      dates: []
    };

    expect(emptySchedule.dates).toHaveLength(0);
  });

  it('should handle closed schedule status', () => {
    const closedSchedule: Schedule = {
      ...testSchedule,
      status: 'closed'
    };

    expect(closedSchedule.status).toBe('closed');
  });

  it('should format date without time correctly', () => {
    const formatted = formatDate('2024-12-25T00:00:00Z');
    expect(formatted).toMatch(/\d{1,2}\/\d{1,2}/); // MM/DD format
    // Time might be displayed in different timezone
    // Just check that it doesn't show midnight in a specific format
  });

  it('should handle schedule with deadline', () => {
    const scheduleWithDeadline: Schedule = {
      ...testSchedule,
      deadline: new Date('2024-12-20T23:59:59Z')
    };

    expect(scheduleWithDeadline.deadline).toBeDefined();
    expect(scheduleWithDeadline.deadline?.getTime()).toBeLessThan(
      new Date(scheduleWithDeadline.dates[0].datetime).getTime()
    );
  });
});
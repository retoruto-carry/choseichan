import { describe, it, expect, vi, beforeEach } from 'vitest';
import { D1ScheduleRepository } from './schedule-repository';
import { Schedule, ScheduleStatus } from '../../../domain/entities/Schedule';
import { ScheduleDate } from '../../../domain/entities/ScheduleDate';
import { User } from '../../../domain/entities/User';
import { RepositoryError, NotFoundError, ConflictError } from '../../../domain/repositories/interfaces';

// Mock D1Database
const createMockD1Database = () => {
  const mockResults = {
    results: [],
    meta: {}
  };
  
  const mockStatement = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue(mockResults),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ success: true })
  };
  
  return {
    prepare: vi.fn().mockReturnValue(mockStatement),
    batch: vi.fn().mockResolvedValue([]),
    _mockStatement: mockStatement,
    _mockResults: mockResults
  };
};

describe('D1ScheduleRepository', () => {
  let repository: D1ScheduleRepository;
  let mockDb: ReturnType<typeof createMockD1Database>;

  beforeEach(() => {
    mockDb = createMockD1Database();
    repository = new D1ScheduleRepository(mockDb as unknown as D1Database);
  });

  describe('save', () => {
    it('should insert a new schedule', async () => {
      const schedule = Schedule.create({
        id: 'test-id',
        guildId: 'guild-123',
        channelId: 'channel-123',
        title: 'Test Schedule',
        dates: [
          ScheduleDate.create('date-1', '2024-12-25 19:00'),
          ScheduleDate.create('date-2', '2024-12-26 19:00')
        ],
        createdBy: User.create('user-123', 'TestUser'),
        authorId: 'user-123',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
      });

      await repository.save(schedule);

      // Verify main schedule insert
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO schedules'));
      expect(mockDb._mockStatement.bind).toHaveBeenCalledWith(
        'test-id',
        'guild-123',
        'channel-123',
        null, // messageId
        'Test Schedule',
        null, // description
        'user-123',
        'TestUser',
        null, // displayName
        'user-123',
        null, // deadline
        null, // reminderTimings
        null, // reminderMentions
        null, // remindersSent
        'open',
        false,
        0,
        expect.any(Number), // createdAt
        expect.any(Number), // updatedAt
        expect.any(Number)  // expiresAt
      );

      // Verify date inserts via batch
      expect(mockDb.batch).toHaveBeenCalled();
      const batchCalls = mockDb.batch.mock.calls[0][0];
      expect(batchCalls).toHaveLength(2);
    });

    it('should update an existing schedule', async () => {
      const schedule = Schedule.create({
        id: 'existing-id',
        guildId: 'guild-123',
        channelId: 'channel-123',
        title: 'Updated Title',
        dates: [ScheduleDate.create('date-1', '2024-12-25 19:00')],
        createdBy: User.create('user-123', 'TestUser'),
        authorId: 'user-123'
      });

      await repository.save(schedule);

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO schedules'));
      expect(mockDb._mockStatement.run).toHaveBeenCalled();
    });

    it('should handle save errors', async () => {
      const schedule = Schedule.create({
        id: 'test-id',
        guildId: 'guild-123',
        channelId: 'channel-123',
        title: 'Test Schedule',
        dates: [ScheduleDate.create('date-1', '2024-12-25 19:00')],
        createdBy: User.create('user-123', 'TestUser'),
        authorId: 'user-123'
      });

      mockDb._mockStatement.run.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.save(schedule)).rejects.toThrow(RepositoryError);
    });
  });

  describe('findById', () => {
    it('should find a schedule by id', async () => {
      const mockScheduleRow = {
        id: 'test-id',
        guild_id: 'guild-123',
        channel_id: 'channel-123',
        message_id: null,
        title: 'Test Schedule',
        description: null,
        created_by_id: 'user-123',
        created_by_username: 'TestUser',
        created_by_display_name: null,
        author_id: 'user-123',
        deadline: null,
        reminder_timings: null,
        reminder_mentions: null,
        reminders_sent: null,
        status: 'open',
        notification_sent: 0,
        total_responses: 0,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000)
      };

      const mockDateRows = [
        { schedule_id: 'test-id', date_id: 'date-1', datetime: '2024-12-25 19:00' },
        { schedule_id: 'test-id', date_id: 'date-2', datetime: '2024-12-26 19:00' }
      ];

      mockDb._mockStatement.first.mockResolvedValueOnce(mockScheduleRow);
      mockDb._mockResults.results = mockDateRows;

      const result = await repository.findById('test-id', 'guild-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-id');
      expect(result?.title).toBe('Test Schedule');
      expect(result?.dates).toHaveLength(2);
    });

    it('should return null when schedule not found', async () => {
      mockDb._mockStatement.first.mockResolvedValueOnce(null);

      const result = await repository.findById('non-existent', 'guild-123');

      expect(result).toBeNull();
    });

    it('should handle find errors', async () => {
      mockDb._mockStatement.first.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.findById('test-id', 'guild-123')).rejects.toThrow(RepositoryError);
    });
  });

  describe('findByChannel', () => {
    it('should find schedules by channel', async () => {
      const mockScheduleRows = [
        {
          id: 'schedule-1',
          guild_id: 'guild-123',
          channel_id: 'channel-123',
          message_id: null,
          title: 'Schedule 1',
          description: null,
          created_by_id: 'user-123',
          created_by_username: 'TestUser',
          created_by_display_name: null,
          author_id: 'user-123',
          deadline: null,
          reminder_timings: null,
          reminder_mentions: null,
          reminders_sent: null,
          status: 'open',
          notification_sent: 0,
          total_responses: 0,
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000)
        }
      ];

      mockDb._mockResults.results = mockScheduleRows;

      const results = await repository.findByChannel('channel-123', 'guild-123');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('schedule-1');
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('WHERE channel_id = ?'));
    });

    it('should apply limit when specified', async () => {
      mockDb._mockResults.results = [];

      await repository.findByChannel('channel-123', 'guild-123', 5);

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('LIMIT 5'));
    });
  });

  describe('findByDeadlineRange', () => {
    it('should find schedules within deadline range', async () => {
      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-12-31');

      mockDb._mockResults.results = [];

      await repository.findByDeadlineRange(startTime, endTime, 'guild-123');

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('deadline BETWEEN ? AND ?'));
      expect(mockDb._mockStatement.bind).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'guild-123'
      );
    });

    it('should find schedules without guild filter', async () => {
      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-12-31');

      mockDb._mockResults.results = [];

      await repository.findByDeadlineRange(startTime, endTime);

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('deadline BETWEEN ? AND ?'));
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.not.stringContaining('guild_id = ?'));
    });
  });

  describe('delete', () => {
    it('should delete a schedule', async () => {
      await repository.delete('test-id', 'guild-123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM schedules')
      );
      expect(mockDb._mockStatement.bind).toHaveBeenCalledWith('test-id', 'guild-123');
    });

    it('should handle delete errors', async () => {
      mockDb._mockStatement.run.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.delete('test-id', 'guild-123')).rejects.toThrow(RepositoryError);
    });
  });

  describe('updateReminders', () => {
    it('should update reminder sent status', async () => {
      await repository.updateReminders('test-id', 'guild-123', ['1d', '8h']);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE schedules')
      );
      expect(mockDb._mockStatement.bind).toHaveBeenCalledWith('1d,8h', expect.any(Number), 'test-id', 'guild-123');
    });
  });

  describe('countByGuild', () => {
    it('should count schedules by guild', async () => {
      mockDb._mockStatement.first.mockResolvedValueOnce({ count: 42 });

      const result = await repository.countByGuild('guild-123');

      expect(result).toBe(42);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)')
      );
    });

    it('should count open schedules when status specified', async () => {
      mockDb._mockStatement.first.mockResolvedValueOnce({ count: 10 });

      const result = await repository.countByGuild('guild-123', 'open');

      expect(result).toBe(10);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT COUNT(*)')
      );
    });
  });
});
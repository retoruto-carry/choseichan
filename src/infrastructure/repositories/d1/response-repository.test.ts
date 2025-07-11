import { describe, it, expect, vi, beforeEach } from 'vitest';
import { D1ResponseRepository } from './response-repository';
import { IScheduleRepository, RepositoryError } from '../../../domain/repositories/interfaces';
import { DomainResponse, DomainSchedule } from '../../../domain/types/DomainTypes';
import { Schedule, ScheduleStatus } from '../../../domain/entities/Schedule';
import { ScheduleDate } from '../../../domain/entities/ScheduleDate';
import { User } from '../../../domain/entities/User';

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

// Mock Schedule Repository
const createMockScheduleRepository = (): IScheduleRepository => ({
  save: vi.fn(),
  findById: vi.fn(),
  findByChannel: vi.fn(),
  findByDeadlineRange: vi.fn(),
  delete: vi.fn(),
  findByMessageId: vi.fn(),
  countByGuild: vi.fn(),
  updateReminders: vi.fn()
});

describe('D1ResponseRepository', () => {
  let repository: D1ResponseRepository;
  let mockDb: ReturnType<typeof createMockD1Database>;
  let mockScheduleRepository: IScheduleRepository;

  const mockSchedule = Schedule.create({
    id: 'schedule-123',
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

  beforeEach(() => {
    mockDb = createMockD1Database();
    mockScheduleRepository = createMockScheduleRepository();
    repository = new D1ResponseRepository(
      mockDb as unknown as D1Database,
      mockScheduleRepository
    );
  });

  describe('save', () => {
    it('should save a new response', async () => {
      const response: DomainResponse = {
        scheduleId: 'schedule-123',
        userId: 'user-456',
        username: 'RespondentUser',
        dateStatuses: { 'date-1': 'ok', 'date-2': 'maybe' },
        comment: 'Looking forward to it!',
        updatedAt: new Date()
      };

      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      mockDb._mockStatement.first.mockResolvedValueOnce({ id: 1 });

      await repository.save(response, 'guild-123');

      // Verify response insert/update
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO responses'));
      expect(mockDb._mockStatement.bind).toHaveBeenCalledWith(
        'schedule-123',
        'guild-123',
        'user-456',
        'RespondentUser',
        null, // displayName
        'Looking forward to it!',
        expect.any(Number), // updatedAt
        expect.any(Number)  // expiresAt
      );

      // Verify date status inserts
      expect(mockDb.batch).toHaveBeenCalled();
    });

    it('should throw error when schedule not found', async () => {
      const response: DomainResponse = {
        scheduleId: 'non-existent',
        userId: 'user-456',
        username: 'User',
        dateStatuses: { 'date-1': 'ok' },
        updatedAt: new Date()
      };

      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(null);

      await expect(repository.save(response, 'guild-123')).rejects.toThrow(RepositoryError);
      await expect(repository.save(response, 'guild-123')).rejects.toThrow('Schedule not found');
    });

    it('should handle save errors', async () => {
      const response: DomainResponse = {
        scheduleId: 'schedule-123',
        userId: 'user-456',
        username: 'User',
        dateStatuses: { 'date-1': 'ok' },
        updatedAt: new Date()
      };

      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      mockDb._mockStatement.first.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.save(response, 'guild-123')).rejects.toThrow(RepositoryError);
    });
  });

  describe('findByUser', () => {
    it('should find response by user', async () => {
      const mockResponseRow = {
        id: 1,
        schedule_id: 'schedule-123',
        user_id: 'user-456',
        username: 'RespondentUser',
        display_name: null,
        comment: 'Test comment',
        updated_at: Math.floor(Date.now() / 1000)
      };

      const mockStatusRows = [
        { date_id: 'date-1', status: 'ok' },
        { date_id: 'date-2', status: 'maybe' }
      ];

      mockDb._mockStatement.first.mockResolvedValueOnce(mockResponseRow);
      mockDb._mockResults.results = mockStatusRows;

      const result = await repository.findByUser('schedule-123', 'user-456', 'guild-123');

      expect(result).toBeDefined();
      expect(result?.userId).toBe('user-456');
      expect(result?.username).toBe('RespondentUser');
      expect(result?.dateStatuses).toEqual({ 'date-1': 'ok', 'date-2': 'maybe' });
    });

    it('should return null when response not found', async () => {
      mockDb._mockStatement.first.mockResolvedValueOnce(null);

      const result = await repository.findByUser('schedule-123', 'user-456', 'guild-123');

      expect(result).toBeNull();
    });
  });

  describe('findByScheduleId', () => {
    it('should find all responses for a schedule', async () => {
      const mockResponseRows = [
        {
          id: 1,
          schedule_id: 'schedule-123',
          user_id: 'user-456',
          username: 'User1',
          display_name: null,
          comment: null,
          updated_at: Math.floor(Date.now() / 1000)
        },
        {
          id: 2,
          schedule_id: 'schedule-123',
          user_id: 'user-789',
          username: 'User2',
          display_name: 'Display User 2',
          comment: 'Cannot make it',
          updated_at: Math.floor(Date.now() / 1000)
        }
      ];

      mockDb._mockResults.results = mockResponseRows;

      // Mock status results for each response
      mockDb._mockStatement.all
        .mockResolvedValueOnce({ results: [{ date_id: 'date-1', status: 'ok' }] })
        .mockResolvedValueOnce({ results: [{ date_id: 'date-1', status: 'ng' }] });

      const results = await repository.findByScheduleId('schedule-123', 'guild-123');

      expect(results).toHaveLength(2);
      expect(results[0].username).toBe('User1');
      expect(results[1].username).toBe('User2');
    });

    it('should return empty array when no responses found', async () => {
      mockDb._mockResults.results = [];

      const results = await repository.findByScheduleId('schedule-123', 'guild-123');

      expect(results).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete a response', async () => {
      await repository.delete('schedule-123', 'user-456', 'guild-123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM responses')
      );
      expect(mockDb._mockStatement.bind).toHaveBeenCalledWith('schedule-123', 'user-456', 'guild-123');
    });

    it('should handle delete errors', async () => {
      mockDb._mockStatement.run.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.delete('schedule-123', 'user-456', 'guild-123'))
        .rejects.toThrow(RepositoryError);
    });
  });

  describe('deleteBySchedule', () => {
    it('should delete all responses for a schedule', async () => {
      await repository.deleteBySchedule('schedule-123', 'guild-123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM responses')
      );
      expect(mockDb._mockStatement.bind).toHaveBeenCalledWith('schedule-123', 'guild-123');
    });
  });

  describe('getScheduleSummary', () => {
    it('should get schedule summary with statistics', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);

      // Mock response counts
      const mockCountRows = [
        { date_id: 'date-1', status: 'ok', count: 3 },
        { date_id: 'date-1', status: 'maybe', count: 1 },
        { date_id: 'date-1', status: 'ng', count: 1 },
        { date_id: 'date-2', status: 'ok', count: 2 },
        { date_id: 'date-2', status: 'maybe', count: 2 },
        { date_id: 'date-2', status: 'ng', count: 1 }
      ];

      // Mock user responses
      const mockUserResponseRows = [
        { user_id: 'user-1', date_id: 'date-1', status: 'ok' },
        { user_id: 'user-1', date_id: 'date-2', status: 'ok' },
        { user_id: 'user-2', date_id: 'date-1', status: 'maybe' },
        { user_id: 'user-2', date_id: 'date-2', status: 'ng' }
      ];

      // Mock responses
      const mockResponseRows = [
        {
          id: 1,
          schedule_id: 'schedule-123',
          user_id: 'user-1',
          username: 'User1',
          display_name: null,
          comment: null,
          updated_at: Math.floor(Date.now() / 1000)
        },
        {
          id: 2,
          schedule_id: 'schedule-123',
          user_id: 'user-2',
          username: 'User2',
          display_name: null,
          comment: null,
          updated_at: Math.floor(Date.now() / 1000)
        }
      ];

      mockDb._mockStatement.all
        .mockResolvedValueOnce({ results: mockCountRows }) // counts
        .mockResolvedValueOnce({ results: mockUserResponseRows }) // user responses
        .mockResolvedValueOnce({ results: mockResponseRows }) // responses
        .mockResolvedValueOnce({ results: [{ date_id: 'date-1', status: 'ok' }, { date_id: 'date-2', status: 'ok' }] }) // user-1 statuses
        .mockResolvedValueOnce({ results: [{ date_id: 'date-1', status: 'maybe' }, { date_id: 'date-2', status: 'ng' }] }); // user-2 statuses

      mockDb._mockStatement.first.mockResolvedValueOnce({ total: 2 }); // total responses

      const result = await repository.getScheduleSummary('schedule-123', 'guild-123');

      expect(result).toBeDefined();
      expect(result?.schedule.id).toBe('schedule-123');
      expect(result?.totalResponseUsers).toBe(2);
      expect(result?.responseCounts['date-1']).toEqual({ ok: 3, maybe: 1, ng: 1 });
      expect(result?.statistics.overallParticipation.fullyAvailable).toBe(1);
      expect(result?.statistics.optimalDates.optimalDateId).toBe('date-1');
    });

    it('should return null when schedule not found', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(null);

      const result = await repository.getScheduleSummary('non-existent', 'guild-123');

      expect(result).toBeNull();
    });

    it('should handle summary errors', async () => {
      vi.mocked(mockScheduleRepository.findById).mockResolvedValueOnce(mockSchedule);
      mockDb._mockStatement.all.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.getScheduleSummary('schedule-123', 'guild-123'))
        .rejects.toThrow(RepositoryError);
    });
  });
});
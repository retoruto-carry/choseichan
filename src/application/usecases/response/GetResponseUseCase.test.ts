import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetResponseUseCase } from './GetResponseUseCase';
import { IResponseRepository } from '../../../domain/repositories/interfaces';
import { DomainResponse } from '../../../domain/types/DomainTypes';
import { ResponseDomainService } from '../../../domain/services/ResponseDomainService';

describe('GetResponseUseCase', () => {
  let useCase: GetResponseUseCase;
  let mockResponseRepository: IResponseRepository;

  const mockResponse: DomainResponse = {
    scheduleId: 'schedule-123',
    userId: 'user-456',
    username: 'TestUser',
    dateStatuses: {
      'date-1': 'ok',
      'date-2': 'maybe',
      'date-3': 'ng'
    },
    comment: 'Test comment',
    updatedAt: new Date('2024-01-02')
  };

  const mockResponses: DomainResponse[] = [
    mockResponse,
    {
      scheduleId: 'schedule-123',
      userId: 'user-789',
      username: 'OtherUser',
      dateStatuses: {
        'date-1': 'ok',
        'date-2': 'ok',
        'date-3': 'maybe'
      },
      updatedAt: new Date('2024-01-03')
    },
    {
      scheduleId: 'schedule-123',
      userId: 'user-999',
      username: 'ThirdUser',
      dateStatuses: {
        'date-1': 'ng',
        'date-2': 'maybe',
        'date-3': 'ok'
      },
      comment: 'Cannot make it on date 1',
      updatedAt: new Date('2024-01-04')
    }
  ];

  beforeEach(() => {
    mockResponseRepository = {
      save: vi.fn(),
      findByUser: vi.fn(),
      findByScheduleId: vi.fn(),
      delete: vi.fn(),
      deleteBySchedule: vi.fn(),
      getScheduleSummary: vi.fn()
    };

    useCase = new GetResponseUseCase(mockResponseRepository);
  });

  describe('execute', () => {
    it('should get user response successfully', async () => {
      vi.mocked(mockResponseRepository.findByUser).mockResolvedValueOnce(mockResponse);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        userId: 'user-456',
        guildId: 'guild-123'
      });

      expect(result.success).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response?.userId).toBe('user-456');
      expect(result.response?.username).toBe('TestUser');
      expect(result.response?.dateStatuses).toEqual({
        'date-1': 'ok',
        'date-2': 'maybe',
        'date-3': 'ng'
      });
      expect(result.response?.comment).toBe('Test comment');
      expect(result.response?.updatedAt).toBe('2024-01-02T00:00:00.000Z');

      expect(mockResponseRepository.findByUser).toHaveBeenCalledWith(
        'schedule-123',
        'user-456',
        'guild-123'
      );
    });

    it('should return error when response not found', async () => {
      vi.mocked(mockResponseRepository.findByUser).mockResolvedValueOnce(null);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        userId: 'user-456',
        guildId: 'guild-123'
      });

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['レスポンスが見つかりません']);
    });

    it('should validate required fields', async () => {
      const testCases = [
        {
          request: { scheduleId: '', userId: 'user-456', guildId: 'guild-123' },
          expectedError: 'スケジュールIDが必要です'
        },
        {
          request: { scheduleId: 'schedule-123', userId: '', guildId: 'guild-123' },
          expectedError: 'ユーザーIDが必要です'
        },
        {
          request: { scheduleId: 'schedule-123', userId: 'user-456', guildId: '' },
          expectedError: 'Guild IDが必要です'
        },
        {
          request: { scheduleId: 'schedule-123', userId: undefined as any, guildId: 'guild-123' },
          expectedError: 'ユーザーIDが必要です'
        }
      ];

      for (const { request, expectedError } of testCases) {
        const result = await useCase.execute(request);
        expect(result.success).toBe(false);
        expect(result.errors).toContain(expectedError);
      }
    });

    it('should handle responses with display name', async () => {
      const responseWithDisplayName = {
        ...mockResponse,
        displayName: 'Display Name'
      };

      vi.mocked(mockResponseRepository.findByUser).mockResolvedValueOnce(responseWithDisplayName);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        userId: 'user-456',
        guildId: 'guild-123'
      });

      expect(result.success).toBe(true);
      expect(result.response?.displayName).toBe('Display Name');
    });

    it('should handle responses without comment', async () => {
      const responseWithoutComment = {
        ...mockResponse,
        comment: undefined
      };

      vi.mocked(mockResponseRepository.findByUser).mockResolvedValueOnce(responseWithoutComment);

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        userId: 'user-456',
        guildId: 'guild-123'
      });

      expect(result.success).toBe(true);
      expect(result.response?.comment).toBeUndefined();
    });

    it('should handle repository errors', async () => {
      vi.mocked(mockResponseRepository.findByUser).mockRejectedValueOnce(
        new Error('Database error')
      );

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        userId: 'user-456',
        guildId: 'guild-123'
      });

      expect(result.success).toBe(false);
      expect(result.errors![0]).toContain('レスポンスの取得に失敗しました');
      expect(result.errors![0]).toContain('Database error');
    });

    it('should handle unexpected errors', async () => {
      vi.mocked(mockResponseRepository.findByUser).mockRejectedValueOnce(
        'Unexpected error'
      );

      const result = await useCase.execute({
        scheduleId: 'schedule-123',
        userId: 'user-456',
        guildId: 'guild-123'
      });

      expect(result.success).toBe(false);
      expect(result.errors![0]).toContain('レスポンスの取得に失敗しました');
      expect(result.errors![0]).toContain('Unknown error');
    });
  });

  describe('getAllResponses', () => {
    it('should get all responses with statistics', async () => {
      vi.mocked(mockResponseRepository.findByScheduleId).mockResolvedValueOnce(mockResponses);

      const result = await useCase.getAllResponses({
        scheduleId: 'schedule-123',
        guildId: 'guild-123'
      });

      expect(result.success).toBe(true);
      expect(result.responses).toHaveLength(3);
      expect(result.statistics).toBeDefined();
      
      // Verify statistics
      const stats = result.statistics!;
      expect(stats.totalUsers).toBe(3);
      
      // Check date-1 statistics
      expect(stats.responsesByDate['date-1']).toEqual({
        yes: 2,
        maybe: 0,
        no: 1,
        total: 3,
        percentage: {
          yes: 67,
          maybe: 0,
          no: 33
        }
      });

      // Check date-2 statistics
      expect(stats.responsesByDate['date-2']).toEqual({
        yes: 1,
        maybe: 2,
        no: 0,
        total: 3,
        percentage: {
          yes: 33,
          maybe: 67,
          no: 0
        }
      });

      // Check date-3 statistics
      expect(stats.responsesByDate['date-3']).toEqual({
        yes: 1,
        maybe: 1,
        no: 1,
        total: 3,
        percentage: {
          yes: 33,
          maybe: 33,
          no: 33
        }
      });

      // Verify overall participation
      expect(stats.overallParticipation).toBeDefined();
      expect(stats.overallParticipation.fullyAvailable).toBe(0); // No user is available for all dates
      expect(stats.overallParticipation.partiallyAvailable).toBe(3); // All users are partially available
      expect(stats.overallParticipation.unavailable).toBe(0);
      
      // Verify optimal dates
      expect(stats.optimalDates.optimalDateId).toBe('date-1'); // Has most "yes" votes
      expect(stats.optimalDates.alternativeDateIds).toContain('date-2');

      expect(mockResponseRepository.findByScheduleId).toHaveBeenCalledWith(
        'schedule-123',
        'guild-123'
      );
    });

    it('should handle empty responses', async () => {
      vi.mocked(mockResponseRepository.findByScheduleId).mockResolvedValueOnce([]);

      const result = await useCase.getAllResponses({
        scheduleId: 'schedule-123',
        guildId: 'guild-123'
      });

      expect(result.success).toBe(true);
      expect(result.responses).toHaveLength(0);
      expect(result.statistics).toBeUndefined();
    });

    it('should validate required fields', async () => {
      const testCases = [
        {
          request: { scheduleId: '', guildId: 'guild-123' },
          expectedError: 'スケジュールIDが必要です'
        },
        {
          request: { scheduleId: 'schedule-123', guildId: '' },
          expectedError: 'Guild IDが必要です'
        }
      ];

      for (const { request, expectedError } of testCases) {
        const result = await useCase.getAllResponses(request);
        expect(result.success).toBe(false);
        expect(result.errors).toContain(expectedError);
      }
    });

    it('should handle single response correctly', async () => {
      vi.mocked(mockResponseRepository.findByScheduleId).mockResolvedValueOnce([mockResponse]);

      const result = await useCase.getAllResponses({
        scheduleId: 'schedule-123',
        guildId: 'guild-123'
      });

      expect(result.success).toBe(true);
      expect(result.responses).toHaveLength(1);
      expect(result.statistics).toBeDefined();
      expect(result.statistics?.totalUsers).toBe(1);
    });

    it('should handle responses without comments', async () => {
      const responsesWithoutComments = mockResponses.map(r => ({
        ...r,
        comment: undefined
      }));

      vi.mocked(mockResponseRepository.findByScheduleId).mockResolvedValueOnce(responsesWithoutComments);

      const result = await useCase.getAllResponses({
        scheduleId: 'schedule-123',
        guildId: 'guild-123'
      });

      expect(result.success).toBe(true);
      expect(result.responses).toHaveLength(3);
      expect(result.responses?.every(r => r.comment === undefined)).toBe(true);
    });

    it('should handle repository errors', async () => {
      vi.mocked(mockResponseRepository.findByScheduleId).mockRejectedValueOnce(
        new Error('Database error')
      );

      const result = await useCase.getAllResponses({
        scheduleId: 'schedule-123',
        guildId: 'guild-123'
      });

      expect(result.success).toBe(false);
      expect(result.errors![0]).toContain('レスポンス一覧の取得に失敗しました');
      expect(result.errors![0]).toContain('Database error');
    });

    it('should handle all dates having no responses', async () => {
      const noResponses: DomainResponse[] = [
        {
          scheduleId: 'schedule-123',
          userId: 'user-456',
          username: 'TestUser',
          dateStatuses: {}, // No date statuses
          updatedAt: new Date('2024-01-02')
        }
      ];

      vi.mocked(mockResponseRepository.findByScheduleId).mockResolvedValueOnce(noResponses);

      const result = await useCase.getAllResponses({
        scheduleId: 'schedule-123',
        guildId: 'guild-123'
      });

      expect(result.success).toBe(true);
      expect(result.responses).toHaveLength(1);
      expect(result.statistics).toBeUndefined(); // No date IDs to calculate statistics
    });

    it('should calculate statistics with all same responses', async () => {
      const sameResponses: DomainResponse[] = [
        {
          scheduleId: 'schedule-123',
          userId: 'user-1',
          username: 'User1',
          dateStatuses: { 'date-1': 'ok' },
          updatedAt: new Date('2024-01-01')
        },
        {
          scheduleId: 'schedule-123',
          userId: 'user-2',
          username: 'User2',
          dateStatuses: { 'date-1': 'ok' },
          updatedAt: new Date('2024-01-02')
        }
      ];

      vi.mocked(mockResponseRepository.findByScheduleId).mockResolvedValueOnce(sameResponses);

      const result = await useCase.getAllResponses({
        scheduleId: 'schedule-123',
        guildId: 'guild-123'
      });

      expect(result.success).toBe(true);
      expect(result.statistics).toBeDefined();
      expect(result.statistics?.responsesByDate['date-1'].percentage.yes).toBe(100);
      expect(result.statistics?.responsesByDate['date-1'].percentage.maybe).toBe(0);
      expect(result.statistics?.responsesByDate['date-1'].percentage.no).toBe(0);
      expect(result.statistics?.optimalDates.optimalDateId).toBe('date-1');
    });
  });
});
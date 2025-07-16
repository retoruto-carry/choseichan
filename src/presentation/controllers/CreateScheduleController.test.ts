import { InteractionResponseFlags, InteractionResponseType } from 'discord-interactions';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateScheduleUseCase } from '../../application/usecases/schedule/CreateScheduleUseCase';
import type { GetScheduleSummaryUseCase } from '../../application/usecases/schedule/GetScheduleSummaryUseCase';
import type { DependencyContainer } from '../../di/DependencyContainer';
import { parseUserInputDate } from '../../domain/utils/date';
import { generateId } from '../../domain/utils/id';
import { CreateScheduleController } from './CreateScheduleController';

// Mock dependencies
vi.mock('../../domain/utils/id', () => ({
  generateId: vi.fn(),
}));

vi.mock('../../domain/utils/date', () => ({
  formatDate: vi.fn(),
  parseUserInputDate: vi.fn(),
}));

vi.mock('../utils/embeds', () => ({
  createScheduleEmbedWithTable: vi.fn().mockReturnValue({
    title: 'Test Schedule',
    description: 'Test Description',
  }),
  createSimpleScheduleComponents: vi.fn().mockReturnValue([{ type: 1, components: [] }]),
}));

vi.mock('../utils/components', () => ({
  createSimpleScheduleComponents: vi.fn().mockReturnValue([{ type: 1, components: [] }]),
}));

describe('CreateScheduleController', () => {
  let controller: CreateScheduleController;
  let mockContainer: DependencyContainer;
  let mockCreateScheduleUseCase: CreateScheduleUseCase;
  let mockGetScheduleSummaryUseCase: GetScheduleSummaryUseCase;
  let mockInteraction: any;
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateScheduleUseCase = {
      execute: vi.fn(),
    } as unknown as CreateScheduleUseCase;

    mockGetScheduleSummaryUseCase = {
      execute: vi.fn(),
    } as unknown as GetScheduleSummaryUseCase;

    mockContainer = {
      createScheduleUseCase: mockCreateScheduleUseCase,
      getScheduleSummaryUseCase: mockGetScheduleSummaryUseCase,
    } as unknown as DependencyContainer;

    controller = new CreateScheduleController(mockContainer);

    mockEnv = {
      DISCORD_TOKEN: 'test-token',
      DISCORD_APPLICATION_ID: 'test-app-id',
      ctx: { waitUntil: vi.fn() },
    };

    mockInteraction = {
      data: {
        components: [
          {
            components: [
              {
                custom_id: 'title',
                value: 'Test Schedule',
              },
            ],
          },
          {
            components: [
              {
                custom_id: 'description',
                value: 'Test Description',
              },
            ],
          },
          {
            components: [
              {
                custom_id: 'dates',
                value: '12/25 19:00',
              },
            ],
          },
          {
            components: [
              {
                custom_id: 'deadline',
                value: '12/20 23:59',
              },
            ],
          },
        ],
      },
      member: {
        user: {
          id: 'user-123',
          username: 'TestUser',
        },
      },
      guild_id: 'guild-123',
      channel_id: 'channel-123',
      token: 'interaction-token',
    };
  });

  describe('handle', () => {
    it('should create a schedule successfully', async () => {
      vi.mocked(generateId).mockReturnValue('date-1');
      vi.mocked(parseUserInputDate).mockReturnValue(new Date('2024-12-20T14:59:00.000Z'));

      vi.mocked(mockCreateScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
        schedule: {
          id: 'schedule-123',
          guildId: 'guild-123',
          channelId: 'channel-123',
          title: 'Test Schedule',
          dates: [{ id: 'date-1', datetime: '12/25 19:00' }],
          createdBy: { id: 'user-123', username: 'TestUser' },
          authorId: 'user-123',
          status: 'open',
          notificationSent: false,
          totalResponses: 0,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        } as any,
      });

      vi.mocked(mockGetScheduleSummaryUseCase.execute).mockResolvedValueOnce({
        success: true,
        summary: {
          schedule: {
            id: 'schedule-123',
            title: 'Test Schedule',
            description: 'Test Description',
            dates: [{ id: 'date-1', datetime: '12/25 19:00' }],
          } as any,
          statistics: {} as any,
          responses: [] as any,
        } as any,
      });

      const result = await controller.handleCreateScheduleModal(mockInteraction, mockEnv);

      expect(result.status).toBe(200);
      expect(mockCreateScheduleUseCase.execute).toHaveBeenCalled();
    });

    it('should handle creation failure', async () => {
      vi.mocked(generateId).mockReturnValue('date-1');
      vi.mocked(parseUserInputDate).mockReturnValue(new Date('2024-12-20T14:59:00.000Z'));

      vi.mocked(mockCreateScheduleUseCase.execute).mockResolvedValueOnce({
        success: false,
        errors: ['タイトルは必須です'],
      });

      const result = await controller.handleCreateScheduleModal(mockInteraction, mockEnv);

      expect(result.status).toBe(200);
      const responseData = JSON.parse(await result.text());
      expect(responseData.data.content).toContain('❌');
    });

    it('should handle unexpected errors', async () => {
      vi.mocked(generateId).mockImplementation(() => {
        throw new Error('ID generation failed');
      });

      const result = await controller.handleCreateScheduleModal(mockInteraction, mockEnv);

      expect(result.status).toBe(200);
      const responseData = JSON.parse(await result.text());
      expect(responseData).toEqual({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ スケジュール作成中にエラーが発生しました。',
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    });
  });
});

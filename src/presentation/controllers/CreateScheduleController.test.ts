import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateScheduleController } from './CreateScheduleController';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { CreateScheduleUseCase } from '../../application/usecases/schedule/CreateScheduleUseCase';
import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { generateId } from '../../utils/id';
import { formatDate, parseUserInputDate } from '../../utils/date';

// Mock dependencies
vi.mock('../../utils/id', () => ({
  generateId: vi.fn()
}));

vi.mock('../../utils/date', () => ({
  formatDate: vi.fn(),
  parseUserInputDate: vi.fn()
}));

vi.mock('../builders/CreateScheduleUIBuilder', () => ({
  CreateScheduleUIBuilder: vi.fn().mockImplementation(() => ({
    createScheduleComponents: vi.fn().mockReturnValue([{ type: 1, components: [] }]),
    createInitialEmbed: vi.fn().mockReturnValue({
      title: 'Test Schedule',
      description: 'Test Description'
    })
  }))
}));

describe('CreateScheduleController', () => {
  let controller: CreateScheduleController;
  let mockContainer: DependencyContainer;
  let mockCreateScheduleUseCase: CreateScheduleUseCase;
  let mockInteraction: any;
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockCreateScheduleUseCase = {
      execute: vi.fn()
    } as unknown as CreateScheduleUseCase;
    
    mockContainer = {
      createScheduleUseCase: mockCreateScheduleUseCase
    } as unknown as DependencyContainer;
    
    controller = new CreateScheduleController(mockContainer);
    
    mockEnv = {
      DISCORD_TOKEN: 'test-token',
      DISCORD_APPLICATION_ID: 'test-app-id',
      ctx: { waitUntil: vi.fn() }
    };
    
    mockInteraction = {
      data: {
        components: [
          {
            components: [{
              custom_id: 'title',
              value: 'Test Schedule'
            }]
          },
          {
            components: [{
              custom_id: 'description',
              value: 'Test Description'
            }]
          },
          {
            components: [{
              custom_id: 'dates',
              value: '12/25 19:00\n12/26 20:00'
            }]
          },
          {
            components: [{
              custom_id: 'deadline',
              value: '12/20 23:59'
            }]
          }
        ]
      },
      member: {
        user: {
          id: 'user-123',
          username: 'TestUser'
        }
      },
      guild_id: 'guild-123',
      channel_id: 'channel-123'
    };
  });

  describe('handle', () => {
    it('should create a schedule successfully', async () => {
      vi.mocked(generateId).mockReturnValue('date-1');
      vi.mocked(formatDate).mockReturnValue('2024-12-25 19:00');
      
      vi.mocked(mockCreateScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
        schedule: {
          id: 'schedule-123',
          title: 'Test Schedule',
          dates: [
            { id: 'date-1', datetime: '12/25 19:00' },
            { id: 'date-2', datetime: '12/26 20:00' }
          ]
        }
      });

      const result = await controller.handleCreateScheduleModal(mockInteraction, mockEnv);

      expect(result.status).toBe(200);
      const responseData = JSON.parse(await result.text());
      expect(responseData).toEqual({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [{
            title: 'Test Schedule',
            description: 'Test Description'
          }],
          components: [{ type: 1, components: [] }]
        }
      });

      expect(mockCreateScheduleUseCase.execute).toHaveBeenCalledWith({
        guildId: 'guild-123',
        channelId: 'channel-123',
        authorId: 'user-123',
        authorUsername: 'TestUser',
        title: 'Test Schedule',
        description: 'Test Description',
        dates: [
          { id: 'date-1', datetime: '12/25 19:00' },
          { id: 'date-2', datetime: '12/26 20:00' }
        ],
        deadline: '12/20 23:59'
      });
    });

    it('should handle optional fields', async () => {
      mockInteraction.data.components[1].components[0].value = ''; // No description
      mockInteraction.data.components[3].components[0].value = ''; // No deadline
      
      vi.mocked(generateId).mockReturnValue('date-1');
      
      vi.mocked(mockCreateScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
        schedule: {
          id: 'schedule-123',
          title: 'Test Schedule',
          dates: [{ id: 'date-1', datetime: '12/25 19:00' }]
        }
      });

      const result = await controller.handleCreateScheduleModal(mockInteraction, mockEnv);

      expect(result.status).toBe(200);
      const responseData = JSON.parse(await result.text());
      expect(responseData.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      
      const executeCall = vi.mocked(mockCreateScheduleUseCase.execute).mock.calls[0][0];
      expect(executeCall.description).toBeUndefined();
      expect(executeCall.deadline).toBeUndefined();
    });

    it('should parse multiple dates correctly', async () => {
      mockInteraction.data.components[2].components[0].value = '12/25 19:00\n12/26 20:00\n12/27 21:00';
      
      vi.mocked(generateId)
        .mockReturnValueOnce('date-1')
        .mockReturnValueOnce('date-2')
        .mockReturnValueOnce('date-3');
      
      vi.mocked(mockCreateScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
        schedule: {
          id: 'schedule-123',
          title: 'Test Schedule',
          dates: [
            { id: 'date-1', datetime: '12/25 19:00' },
            { id: 'date-2', datetime: '12/26 20:00' },
            { id: 'date-3', datetime: '12/27 21:00' }
          ]
        }
      });

      await controller.handleCreateScheduleModal(mockInteraction, mockEnv);

      const executeCall = vi.mocked(mockCreateScheduleUseCase.execute).mock.calls[0][0];
      expect(executeCall.dates).toHaveLength(3);
      expect(executeCall.dates[2]).toEqual({ id: 'date-3', datetime: '12/27 21:00' });
    });

    it('should handle creation failure', async () => {
      vi.mocked(generateId).mockReturnValue('date-1');
      
      vi.mocked(mockCreateScheduleUseCase.execute).mockResolvedValueOnce({
        success: false,
        errors: ['タイトルは必須です']
      });

      const result = await controller.handleCreateScheduleModal(mockInteraction, mockEnv);

      expect(result.status).toBe(200);
      const responseData = JSON.parse(await result.text());
      expect(responseData).toEqual({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ 日程調整の作成に失敗しました:\nタイトルは必須です',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      });
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
          flags: InteractionResponseFlags.EPHEMERAL
        }
      });
    });

    it('should filter empty date lines', async () => {
      mockInteraction.data.components[2].components[0].value = '12/25 19:00\n\n12/26 20:00\n  \n';
      
      vi.mocked(generateId).mockReturnValue('date-1');
      vi.mocked(generateId)
        .mockReturnValueOnce('date-1')
        .mockReturnValueOnce('date-2');
      
      vi.mocked(mockCreateScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
        schedule: {
          id: 'schedule-123',
          title: 'Test Schedule',
          dates: [
            { id: 'date-1', datetime: '12/25 19:00' },
            { id: 'date-2', datetime: '12/26 20:00' }
          ]
        }
      });

      await controller.handleCreateScheduleModal(mockInteraction, mockEnv);

      const executeCall = vi.mocked(mockCreateScheduleUseCase.execute).mock.calls[0][0];
      expect(executeCall.dates).toHaveLength(2);
    });
  });

  describe('parseModalData', () => {
    it('should extract form data from interaction', async () => {
      vi.mocked(generateId).mockReturnValue('date-1');
      
      vi.mocked(mockCreateScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
        schedule: {
          id: 'schedule-123',
          title: 'Test Schedule',
          dates: [{ id: 'date-1', datetime: '12/25 19:00' }]
        }
      });

      await controller.handleCreateScheduleModal(mockInteraction, mockEnv);

      // Verify that the modal data was correctly parsed
      expect(mockCreateScheduleUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Schedule',
          description: 'Test Description'
        })
      );
    });
  });
});
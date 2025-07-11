import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VoteController } from './VoteController';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { VoteUIBuilder } from '../builders/VoteUIBuilder';
import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ButtonInteraction, ModalInteraction, Env } from '../../types/discord';
import { ScheduleResponse, ResponseDto } from '../../application/dto/ScheduleDto';

describe('VoteController', () => {
  let controller: VoteController;
  let mockContainer: DependencyContainer;
  let mockUIBuilder: VoteUIBuilder;
  let mockEnv: Env;

  const mockSchedule: ScheduleResponse = {
    id: 'schedule-123',
    guildId: 'guild-123',
    channelId: 'channel-123',
    messageId: 'msg-123',
    title: 'Test Schedule',
    dates: [
      { id: 'date-1', datetime: '2024/01/20 19:00' },
      { id: 'date-2', datetime: '2024/01/21 19:00' }
    ],
    createdBy: {
      id: 'user-123',
      username: 'TestUser'
    },
    authorId: 'user-123',
    status: 'open',
    notificationSent: false,
    totalResponses: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  };

  const mockResponse: ResponseDto = {
    scheduleId: 'schedule-123',
    userId: 'user-456',
    username: 'Responder',
    dateStatuses: {
      'date-1': 'ok',
      'date-2': 'maybe'
    },
    updatedAt: '2024-01-02T00:00:00Z'
  };

  beforeEach(() => {
    // Mock environment
    mockEnv = {
      DISCORD_PUBLIC_KEY: 'test_key',
      DISCORD_APPLICATION_ID: 'test_app',
      DISCORD_TOKEN: 'test_token',
      DB: {} as D1Database,
      ctx: {
        waitUntil: vi.fn()
      } as any
    };

    // Mock DependencyContainer
    mockContainer = {
      getScheduleUseCase: {
        execute: vi.fn().mockResolvedValue({ success: false })
      },
      updateScheduleUseCase: {
        execute: vi.fn().mockResolvedValue({ success: true })
      },
      getResponseUseCase: {
        execute: vi.fn().mockResolvedValue({ success: false })
      },
      submitResponseUseCase: {
        execute: vi.fn().mockResolvedValue({ success: false })
      },
      closeScheduleUseCase: {
        execute: vi.fn().mockResolvedValue({ success: false })
      },
      reopenScheduleUseCase: {
        execute: vi.fn().mockResolvedValue({ success: false })
      },
      getScheduleSummaryUseCase: {
        execute: vi.fn().mockResolvedValue({ success: false })
      },
      infrastructureServices: {
        repositoryFactory: {
          getScheduleRepository: vi.fn(),
          getResponseRepository: vi.fn()
        }
      }
    } as any;

    // Mock UIBuilder
    mockUIBuilder = {
      createVoteModal: vi.fn()
    } as any;

    controller = new VoteController(mockContainer, mockUIBuilder);
  });

  describe('handleRespondButton', () => {
    const mockInteraction: ButtonInteraction = {
      id: 'interaction-123',
      type: 3 as any,
      data: {
        custom_id: 'respond:schedule-123',
        component_type: 2
      },
      guild_id: 'guild-123',
      member: {
        user: {
          id: 'user-456',
          username: 'Responder',
          discriminator: '0000'
        },
        roles: []
      },
      token: 'interaction_token',
      message: {
        id: 'msg-123',
        embeds: []
      }
    };

    it('should show vote modal for valid schedule', async () => {
      // Setup mocks
      vi.mocked(mockContainer.getScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
        schedule: mockSchedule
      });

      vi.mocked(mockContainer.getResponseUseCase.execute).mockResolvedValueOnce({
        success: true,
        response: mockResponse
      });

      const mockModal = {
        custom_id: 'vote:schedule-123',
        title: 'Vote Modal',
        components: []
      };
      vi.mocked(mockUIBuilder.createVoteModal).mockReturnValueOnce(mockModal);

      // Execute
      const response = await controller.handleRespondButton(
        mockInteraction,
        ['schedule-123'],
        mockEnv
      );

      // Verify
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.type).toBe(InteractionResponseType.MODAL);
      expect(data.data).toEqual(mockModal);

      expect(mockContainer.getScheduleUseCase.execute).toHaveBeenCalledWith('schedule-123', 'guild-123');
      expect(mockContainer.getResponseUseCase.execute).toHaveBeenCalledWith({
        scheduleId: 'schedule-123',
        userId: 'user-456',
        guildId: 'guild-123'
      });
      expect(mockUIBuilder.createVoteModal).toHaveBeenCalledWith(
        mockSchedule,
        expect.arrayContaining([
          { dateId: 'date-1', status: 'ok' },
          { dateId: 'date-2', status: 'maybe' }
        ])
      );
    });

    it('should save message ID if not already saved', async () => {
      const scheduleWithoutMessageId = { ...mockSchedule, messageId: undefined };
      
      vi.mocked(mockContainer.getScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
        schedule: scheduleWithoutMessageId
      });

      vi.mocked(mockContainer.updateScheduleUseCase.execute).mockResolvedValueOnce({
        success: true
      });

      vi.mocked(mockContainer.getResponseUseCase.execute).mockResolvedValueOnce({
        success: false
      });

      vi.mocked(mockUIBuilder.createVoteModal).mockReturnValueOnce({
        custom_id: 'vote:schedule-123',
        title: 'Vote Modal',
        components: []
      });

      await controller.handleRespondButton(mockInteraction, ['schedule-123'], mockEnv);

      expect(mockContainer.updateScheduleUseCase.execute).toHaveBeenCalledWith({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        editorUserId: 'user-456',
        messageId: 'msg-123'
      });
    });

    it('should return error when schedule not found', async () => {
      vi.mocked(mockContainer.getScheduleUseCase.execute).mockResolvedValueOnce({
        success: false
      });

      const response = await controller.handleRespondButton(
        mockInteraction,
        ['schedule-123'],
        mockEnv
      );

      const data = await response.json();
      expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(data.data.content).toContain('日程調整が見つかりません');
      expect(data.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    });

    it('should return error when schedule is closed', async () => {
      const closedSchedule = { ...mockSchedule, status: 'closed' as const };
      
      vi.mocked(mockContainer.getScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
        schedule: closedSchedule
      });

      const response = await controller.handleRespondButton(
        mockInteraction,
        ['schedule-123'],
        mockEnv
      );

      const data = await response.json();
      expect(data.data.content).toContain('この日程調整は締め切られています');
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(mockContainer.getScheduleUseCase.execute).mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await controller.handleRespondButton(
        mockInteraction,
        ['schedule-123'],
        mockEnv
      );

      const data = await response.json();
      expect(data.data.content).toContain('エラーが発生しました');
    });
  });

  describe('handleVoteModal', () => {
    const mockModalInteraction: ModalInteraction = {
      id: 'interaction-456',
      type: 5 as any,
      data: {
        custom_id: 'vote:schedule-123',
        components: [
          {
            type: 1,
            components: [{
              type: 4,
              custom_id: 'vote_date-1',
              value: 'o'
            }]
          },
          {
            type: 1,
            components: [{
              type: 4,
              custom_id: 'vote_date-2',
              value: '△'
            }]
          },
          {
            type: 1,
            components: [{
              type: 4,
              custom_id: 'comment',
              value: 'Test comment'
            }]
          }
        ]
      },
      guild_id: 'guild-123',
      member: {
        user: {
          id: 'user-456',
          username: 'Responder',
          discriminator: '0000'
        },
        roles: []
      },
      token: 'interaction_token'
    };

    it('should submit vote successfully', async () => {
      vi.mocked(mockContainer.getScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
        schedule: mockSchedule
      });

      vi.mocked(mockContainer.submitResponseUseCase.execute).mockResolvedValueOnce({
        success: true
      });

      const response = await controller.handleVoteModal(
        mockModalInteraction,
        ['schedule-123'],
        mockEnv
      );

      const data = await response.json();
      expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(data.data.content).toContain('✅ Responder さんの回答を受け付けました');
      expect(data.data.content).toContain('○ 2024/01/20 19:00');
      expect(data.data.content).toContain('△ 2024/01/21 19:00');
      expect(data.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);

      expect(mockContainer.submitResponseUseCase.execute).toHaveBeenCalledWith({
        scheduleId: 'schedule-123',
        userId: 'user-456',
        username: 'Responder',
        responses: [
          { dateId: 'date-1', status: 'ok' },
          { dateId: 'date-2', status: 'maybe' }
        ],
        comment: 'Test comment',
        guildId: 'guild-123'
      });
    });

    it('should parse various vote formats', async () => {
      const testCases = [
        { input: 'o', expected: 'ok' },
        { input: 'O', expected: 'ok' },
        { input: '○', expected: 'ok' },
        { input: '◯', expected: 'ok' },
        { input: '△', expected: 'maybe' },
        { input: '▲', expected: 'maybe' },
        { input: 'x', expected: 'ng' },
        { input: '', expected: 'ng' },
        { input: 'invalid', expected: 'ng' }
      ];

      for (const testCase of testCases) {
        const interaction = {
          ...mockModalInteraction,
          data: {
            ...mockModalInteraction.data,
            components: [
              {
                type: 1,
                components: [{
                  type: 4,
                  custom_id: 'vote_date-1',
                  value: testCase.input
                }]
              },
              {
                type: 1,
                components: [{
                  type: 4,
                  custom_id: 'comment',
                  value: ''
                }]
              }
            ]
          }
        };

        vi.mocked(mockContainer.getScheduleUseCase.execute).mockResolvedValueOnce({
          success: true,
          schedule: { ...mockSchedule, dates: [mockSchedule.dates[0]] }
        });

        vi.mocked(mockContainer.submitResponseUseCase.execute).mockResolvedValueOnce({
          success: true
        });

        await controller.handleVoteModal(interaction, ['schedule-123'], mockEnv);

        const call = vi.mocked(mockContainer.submitResponseUseCase.execute).mock.lastCall;
        expect(call[0].responses[0].status).toBe(testCase.expected);
      }
    });

    it('should update main message in background', async () => {
      vi.mocked(mockContainer.getScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
        schedule: mockSchedule
      });

      vi.mocked(mockContainer.submitResponseUseCase.execute).mockResolvedValueOnce({
        success: true
      });

      await controller.handleVoteModal(mockModalInteraction, ['schedule-123'], mockEnv);

      expect(mockEnv.ctx?.waitUntil).toHaveBeenCalled();
    });

    it('should allow author to vote on closed schedule', async () => {
      const closedSchedule = { ...mockSchedule, status: 'closed' as const };
      const authorInteraction = {
        ...mockModalInteraction,
        member: {
          user: {
            id: 'user-123', // Author ID
            username: 'TestUser',
            discriminator: '0000'
          },
          roles: []
        }
      };

      vi.mocked(mockContainer.getScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
        schedule: closedSchedule
      });

      vi.mocked(mockContainer.submitResponseUseCase.execute).mockResolvedValueOnce({
        success: true
      });

      const response = await controller.handleVoteModal(
        authorInteraction,
        ['schedule-123'],
        mockEnv
      );

      const data = await response.json();
      expect(data.data.content).toContain('✅ TestUser さんの回答を受け付けました');
    });

    it('should return error when submit fails', async () => {
      vi.mocked(mockContainer.getScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
        schedule: mockSchedule
      });

      vi.mocked(mockContainer.submitResponseUseCase.execute).mockResolvedValueOnce({
        success: false
      });

      const response = await controller.handleVoteModal(
        mockModalInteraction,
        ['schedule-123'],
        mockEnv
      );

      const data = await response.json();
      expect(data.data.content).toContain('回答の保存に失敗しました');
    });
  });

  describe('handleCloseButton', () => {
    const mockInteraction: ButtonInteraction = {
      id: 'interaction-789',
      type: 3 as any,
      data: {
        custom_id: 'close:schedule-123',
        component_type: 2
      },
      guild_id: 'guild-123',
      member: {
        user: {
          id: 'user-123',
          username: 'TestUser',
          discriminator: '0000'
        },
        roles: []
      },
      token: 'interaction_token'
    };

    it('should close schedule successfully', async () => {
      vi.mocked(mockContainer.getScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
        schedule: mockSchedule
      });

      vi.mocked(mockContainer.closeScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
        schedule: { ...mockSchedule, status: 'closed' }
      });

      const response = await controller.handleCloseButton(
        mockInteraction,
        ['schedule-123'],
        mockEnv
      );

      const data = await response.json();
      expect(data.type).toBe(InteractionResponseType.DEFERRED_UPDATE_MESSAGE);

      expect(mockContainer.closeScheduleUseCase.execute).toHaveBeenCalledWith({
        scheduleId: 'schedule-123',
        guildId: 'guild-123',
        closedByUserId: 'user-123'
      });
    });

    it('should return error when user is not authorized', async () => {
      const unauthorizedInteraction = {
        ...mockInteraction,
        member: {
          user: {
            id: 'user-456', // Not the author
            username: 'OtherUser',
            discriminator: '0000'
          },
          roles: []
        }
      };

      vi.mocked(mockContainer.getScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
        schedule: mockSchedule
      });

      const response = await controller.handleCloseButton(
        unauthorizedInteraction,
        ['schedule-123'],
        mockEnv
      );

      const data = await response.json();
      expect(data.data.content).toContain('この日程調整を締め切る権限がありません');
    });

    it('should return error when schedule is already closed', async () => {
      const closedSchedule = { ...mockSchedule, status: 'closed' as const };
      
      vi.mocked(mockContainer.getScheduleUseCase.execute).mockResolvedValueOnce({
        success: true,
        schedule: closedSchedule
      });

      const response = await controller.handleCloseButton(
        mockInteraction,
        ['schedule-123'],
        mockEnv
      );

      const data = await response.json();
      expect(data.data.content).toContain('この日程調整は既に締め切られています');
    });
  });
});
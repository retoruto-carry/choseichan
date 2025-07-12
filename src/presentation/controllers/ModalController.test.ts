import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { ModalController } from './ModalController';

describe('ModalController', () => {
  let controller: ModalController;
  let mockContainer: DependencyContainer;
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a complete mock container with all required properties
    mockContainer = {
      infrastructureServices: {
        repositoryFactory: {
          getScheduleRepository: vi.fn(),
          getResponseRepository: vi.fn(),
        },
        discordApiService: {
          sendWebhookMessage: vi.fn(),
          updateMessage: vi.fn(),
          deleteMessage: vi.fn(),
          getGuildMember: vi.fn(),
          createInteractionResponse: vi.fn(),
        },
      },
      applicationServices: {
        createScheduleUseCase: {
          execute: vi.fn().mockResolvedValue({
            success: true,
            schedule: { id: 'schedule-123' },
          }),
        },
        updateScheduleUseCase: { execute: vi.fn() },
        closeScheduleUseCase: { execute: vi.fn() },
        reopenScheduleUseCase: { execute: vi.fn() },
        deleteScheduleUseCase: { execute: vi.fn() },
        getScheduleUseCase: { execute: vi.fn() },
        findSchedulesUseCase: { execute: vi.fn() },
        getScheduleSummaryUseCase: { execute: vi.fn() },
        deadlineReminderUseCase: { execute: vi.fn() },
        processReminderUseCase: { execute: vi.fn() },
        processDeadlineRemindersUseCase: null,
        submitResponseUseCase: { execute: vi.fn() },
        updateResponseUseCase: { execute: vi.fn() },
        getResponseUseCase: { execute: vi.fn() },
      },
      get createScheduleUseCase() {
        return (this as any).applicationServices.createScheduleUseCase;
      },
      get updateScheduleUseCase() {
        return (this as any).applicationServices.updateScheduleUseCase;
      },
      get submitResponseUseCase() {
        return (this as any).applicationServices.submitResponseUseCase;
      },
    } as unknown as DependencyContainer;

    mockEnv = {
      DISCORD_APPLICATION_ID: 'test-app-id',
      DISCORD_PUBLIC_KEY: 'test-public-key',
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        }),
        batch: vi.fn().mockResolvedValue([]),
      },
    };

    controller = new ModalController(mockContainer);
  });

  describe('handleModalSubmit', () => {
    it('should handle create_schedule modal', async () => {
      const mockInteraction = {
        id: 'interaction-123',
        type: 5, // MODAL_SUBMIT
        token: 'interaction-token',
        data: {
          custom_id: 'modal:create_schedule',
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
                  value: '2024-12-25 10:00',
                },
              ],
            },
          ],
        },
        member: {
          user: {
            id: 'user-123',
            username: 'testuser',
          },
        },
        guild_id: 'guild-456',
        channel_id: 'channel-789',
      };

      const result = await controller.handleModalSubmit(mockInteraction as any, mockEnv);

      expect(result).toBeInstanceOf(Response);
    });

    it('should handle edit modal', async () => {
      const mockInteraction = {
        id: 'interaction-123',
        type: 5, // MODAL_SUBMIT
        token: 'interaction-token',
        data: {
          custom_id: 'edit:schedule-123',
          components: [
            {
              components: [
                {
                  custom_id: 'title',
                  value: 'Updated Title',
                },
              ],
            },
          ],
        },
        member: {
          user: {
            id: 'user-123',
            username: 'testuser',
          },
        },
        guild_id: 'guild-456',
        channel_id: 'channel-789',
      };

      const result = await controller.handleModalSubmit(mockInteraction as any, mockEnv);

      expect(result).toBeInstanceOf(Response);
    });

    it('should handle add_date modal', async () => {
      const mockInteraction = {
        id: 'interaction-123',
        type: 5, // MODAL_SUBMIT
        token: 'interaction-token',
        data: {
          custom_id: 'add_date:schedule-123',
          components: [
            {
              components: [
                {
                  custom_id: 'dates',
                  value: '2024-12-25 19:00',
                },
              ],
            },
          ],
        },
        member: {
          user: {
            id: 'user-123',
            username: 'testuser',
          },
        },
        guild_id: 'guild-456',
        channel_id: 'channel-789',
      };

      const result = await controller.handleModalSubmit(mockInteraction as any, mockEnv);

      expect(result).toBeInstanceOf(Response);
    });

    it('should handle add_reminder modal', async () => {
      const mockInteraction = {
        id: 'interaction-123',
        type: 5, // MODAL_SUBMIT
        token: 'interaction-token',
        data: {
          custom_id: 'add_reminder:schedule-123',
          components: [
            {
              components: [
                {
                  custom_id: 'timing',
                  value: '1d',
                },
              ],
            },
          ],
        },
        member: {
          user: {
            id: 'user-123',
            username: 'testuser',
          },
        },
        guild_id: 'guild-456',
        channel_id: 'channel-789',
      };

      const result = await controller.handleModalSubmit(mockInteraction as any, mockEnv);

      expect(result).toBeInstanceOf(Response);
    });

    it('should return error for unknown modal type', async () => {
      const mockInteraction = {
        id: 'interaction-123',
        type: 5, // MODAL_SUBMIT
        token: 'interaction-token',
        data: {
          custom_id: 'unknown:modal-type',
          components: [],
        },
        member: {
          user: {
            id: 'user-123',
            username: 'testuser',
          },
        },
        guild_id: 'guild-456',
        channel_id: 'channel-789',
      };

      const result = await controller.handleModalSubmit(mockInteraction as any, mockEnv);

      expect(result).toBeInstanceOf(Response);
      const response = (await result.json()) as any;
      expect(response.data.content).toContain('不明なモーダルです。');
    });

    it('should handle errors gracefully', async () => {
      const mockInteraction = {
        id: 'interaction-123',
        type: 5, // MODAL_SUBMIT
        token: 'interaction-token',
        data: {
          custom_id: 'modal:create_schedule',
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
                  value: '2024-12-25 10:00',
                },
              ],
            },
          ],
        },
        member: {
          user: {
            id: 'user-123',
            username: 'testuser',
          },
        },
        guild_id: 'guild-456',
        channel_id: 'channel-789',
      };

      // Mock error in create schedule
      (mockContainer as any).getScheduleService = vi.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await controller.handleModalSubmit(mockInteraction as any, mockEnv);

      expect(result).toBeInstanceOf(Response);
      const response = (await result.json()) as any;
      expect(response.data.content).toContain('スケジュール情報の取得に失敗しました');
    });

    it('should handle modal with parameters', async () => {
      const mockInteraction = {
        id: 'interaction-123',
        type: 5, // MODAL_SUBMIT
        token: 'interaction-token',
        data: {
          custom_id: 'modal:edit_info:schedule-123',
          components: [
            {
              components: [
                {
                  custom_id: 'title',
                  value: 'Updated Title',
                },
              ],
            },
          ],
        },
        member: {
          user: {
            id: 'user-123',
            username: 'testuser',
          },
        },
        guild_id: 'guild-456',
        channel_id: 'channel-789',
      };

      const result = await controller.handleModalSubmit(mockInteraction as any, mockEnv);

      expect(result).toBeInstanceOf(Response);
    });

    it('should identify modal type correctly from complex custom_id', async () => {
      const mockInteraction = {
        id: 'interaction-123',
        type: 5, // MODAL_SUBMIT
        token: 'interaction-token',
        data: {
          custom_id: 'modal:add_dates:schedule-123:extra-param',
          components: [
            {
              components: [
                {
                  custom_id: 'dates',
                  value: '2024-12-25 19:00',
                },
              ],
            },
          ],
        },
        member: {
          user: {
            id: 'user-123',
            username: 'testuser',
          },
        },
        guild_id: 'guild-456',
        channel_id: 'channel-789',
      };

      const result = await controller.handleModalSubmit(mockInteraction as any, mockEnv);

      expect(result).toBeInstanceOf(Response);
    });
  });
});

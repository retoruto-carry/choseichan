import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModalController } from './ModalController';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { ModalUIBuilder } from '../builders/ModalUIBuilder';
import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';

describe('ModalController', () => {
  let controller: ModalController;
  let mockContainer: DependencyContainer;
  let mockUIBuilder: ModalUIBuilder;
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockContainer = {
      getScheduleService: vi.fn(),
      getResponseService: vi.fn(),
      getNotificationService: vi.fn()
    } as unknown as DependencyContainer;
    
    mockUIBuilder = {
      createModal: vi.fn(),
      buildForm: vi.fn()
    } as unknown as ModalUIBuilder;
    
    mockEnv = {
      DISCORD_APPLICATION_ID: 'test-app-id',
      DISCORD_PUBLIC_KEY: 'test-public-key',
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ success: true })
          })
        }),
        batch: vi.fn().mockResolvedValue([])
      }
    };
    
    controller = new ModalController(mockContainer, mockUIBuilder);
  });

  describe('handleModalSubmit', () => {
    it('should handle create_schedule modal', async () => {
      const mockInteraction = {
        data: {
          custom_id: 'modal:create_schedule',
          components: [
            {
              components: [
                {
                  custom_id: 'title',
                  value: 'Test Schedule'
                }
              ]
            }
          ]
        },
        member: {
          user: {
            id: 'user-123',
            username: 'testuser'
          }
        },
        guild_id: 'guild-456',
        channel_id: 'channel-789'
      };

      // Mock the create schedule use case
      const mockCreateScheduleUseCase = {
        execute: vi.fn().mockResolvedValue({ id: 'schedule-123' })
      };
      
      mockContainer.getScheduleService = vi.fn().mockReturnValue({
        createSchedule: mockCreateScheduleUseCase
      });

      const result = await controller.handleModalSubmit(mockInteraction, mockEnv);

      expect(result).toBeInstanceOf(Response);
    });

    it('should handle comment modal', async () => {
      const mockInteraction = {
        data: {
          custom_id: 'comment:schedule-123',
          components: [
            {
              components: [
                {
                  custom_id: 'comment',
                  value: 'Test comment'
                }
              ]
            }
          ]
        },
        member: {
          user: {
            id: 'user-123',
            username: 'testuser'
          }
        },
        guild_id: 'guild-456',
        channel_id: 'channel-789'
      };

      const result = await controller.handleModalSubmit(mockInteraction, mockEnv);

      expect(result).toBeInstanceOf(Response);
    });

    it('should handle edit modal', async () => {
      const mockInteraction = {
        data: {
          custom_id: 'edit:schedule-123',
          components: [
            {
              components: [
                {
                  custom_id: 'title',
                  value: 'Updated Title'
                }
              ]
            }
          ]
        },
        member: {
          user: {
            id: 'user-123',
            username: 'testuser'
          }
        },
        guild_id: 'guild-456',
        channel_id: 'channel-789'
      };

      const result = await controller.handleModalSubmit(mockInteraction, mockEnv);

      expect(result).toBeInstanceOf(Response);
    });

    it('should handle add_date modal', async () => {
      const mockInteraction = {
        data: {
          custom_id: 'add_date:schedule-123',
          components: [
            {
              components: [
                {
                  custom_id: 'dates',
                  value: '2024-12-25 19:00'
                }
              ]
            }
          ]
        },
        member: {
          user: {
            id: 'user-123',
            username: 'testuser'
          }
        },
        guild_id: 'guild-456',
        channel_id: 'channel-789'
      };

      const result = await controller.handleModalSubmit(mockInteraction, mockEnv);

      expect(result).toBeInstanceOf(Response);
    });

    it('should handle add_reminder modal', async () => {
      const mockInteraction = {
        data: {
          custom_id: 'add_reminder:schedule-123',
          components: [
            {
              components: [
                {
                  custom_id: 'timing',
                  value: '1d'
                }
              ]
            }
          ]
        },
        member: {
          user: {
            id: 'user-123',
            username: 'testuser'
          }
        },
        guild_id: 'guild-456',
        channel_id: 'channel-789'
      };

      const result = await controller.handleModalSubmit(mockInteraction, mockEnv);

      expect(result).toBeInstanceOf(Response);
    });

    it('should return error for unknown modal type', async () => {
      const mockInteraction = {
        data: {
          custom_id: 'unknown:modal-type',
          components: []
        },
        member: {
          user: {
            id: 'user-123',
            username: 'testuser'
          }
        },
        guild_id: 'guild-456',
        channel_id: 'channel-789'
      };

      const result = await controller.handleModalSubmit(mockInteraction, mockEnv);

      expect(result).toBeInstanceOf(Response);
      const response = await result.json();
      expect(response.data.content).toContain('不明なモーダルです。');
    });

    it('should handle errors gracefully', async () => {
      const mockInteraction = {
        data: {
          custom_id: 'modal:create_schedule',
          components: [
            {
              components: [
                {
                  custom_id: 'title',
                  value: 'Test Schedule'
                }
              ]
            }
          ]
        },
        member: {
          user: {
            id: 'user-123',
            username: 'testuser'
          }
        },
        guild_id: 'guild-456',
        channel_id: 'channel-789'
      };

      // Mock error in create schedule
      mockContainer.getScheduleService = vi.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await controller.handleModalSubmit(mockInteraction, mockEnv);

      expect(result).toBeInstanceOf(Response);
      const response = await result.json();
      expect(response.data.content).toContain('エラーが発生しました');
    });

    it('should handle modal with parameters', async () => {
      const mockInteraction = {
        data: {
          custom_id: 'modal:edit_info:schedule-123',
          components: [
            {
              components: [
                {
                  custom_id: 'title',
                  value: 'Updated Title'
                }
              ]
            }
          ]
        },
        member: {
          user: {
            id: 'user-123',
            username: 'testuser'
          }
        },
        guild_id: 'guild-456',
        channel_id: 'channel-789'
      };

      const result = await controller.handleModalSubmit(mockInteraction, mockEnv);

      expect(result).toBeInstanceOf(Response);
    });

    it('should identify modal type correctly from complex custom_id', async () => {
      const mockInteraction = {
        data: {
          custom_id: 'modal:add_dates:schedule-123:extra-param',
          components: [
            {
              components: [
                {
                  custom_id: 'dates',
                  value: '2024-12-25 19:00'
                }
              ]
            }
          ]
        },
        member: {
          user: {
            id: 'user-123',
            username: 'testuser'
          }
        },
        guild_id: 'guild-456',
        channel_id: 'channel-789'
      };

      const result = await controller.handleModalSubmit(mockInteraction, mockEnv);

      expect(result).toBeInstanceOf(Response);
    });
  });
});
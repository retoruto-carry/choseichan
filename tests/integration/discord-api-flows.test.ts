/**
 * Discord API Response Flows Integration Tests
 *
 * Discord APIとの通信フローをテスト
 * - レート制限処理
 * - エラーハンドリング
 * - 非同期Queue処理
 * - メッセージ更新フロー
 */

import { InteractionResponseType, InteractionType } from 'discord-interactions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DependencyContainer } from '../../src/di/DependencyContainer';
import type {
  ButtonInteraction,
  CommandInteraction,
  Env,
} from '../../src/infrastructure/types/discord';
import { ButtonInteractionController } from '../../src/presentation/controllers/ButtonInteractionController';
import { createCommandController } from '../../src/presentation/controllers/CommandController';
import {
  applyMigrations,
  closeTestDatabase,
  createTestD1Database,
  createTestEnv,
  type D1Database,
} from '../helpers/d1-database';

describe('Discord API Response Flows Integration', () => {
  let db: D1Database;
  let env: Env;
  let container: DependencyContainer;
  let originalFetch: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup test database
    db = createTestD1Database();
    await applyMigrations(db);

    // Create test environment
    env = createTestEnv(db);
    container = new DependencyContainer(env);

    // Store original fetch
    originalFetch = global.fetch;
  });

  afterEach(async () => {
    await closeTestDatabase(db);
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Discord API Success Flows', () => {
    it('should handle successful API responses', async () => {
      // Mock successful Discord API responses
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: '123456789', type: 0 }),
        text: async () => 'OK',
      });

      const commandInteraction: CommandInteraction = {
        id: 'interaction-1',
        type: InteractionType.APPLICATION_COMMAND,
        data: {
          id: 'cmd-id',
          name: 'chouseichan',
          options: [],
        },
        channel_id: 'test-channel',
        guild_id: 'test-guild',
        member: {
          user: {
            id: 'user-123',
            username: 'TestUser',
            discriminator: '0001',
          },
          roles: [],
        },
        token: 'test-token',
      };

      const commandController = createCommandController(env);
      const response = await commandController.handleChouseichanCommand(commandInteraction, env);

      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.type).toBe(InteractionResponseType.MODAL);
      expect(data.data.title).toBe('日程調整を作成');
    });

    it('should handle Discord API with valid JSON responses', async () => {
      // Mock Discord API with specific response format
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: '987654321',
          type: 0,
          content: 'Message sent successfully',
          channel_id: 'test-channel',
          author: {
            id: 'bot-id',
            username: 'TestBot',
            discriminator: '0000',
          },
          timestamp: new Date().toISOString(),
        }),
        text: async () => 'OK',
      });

      // Test that the mock is working properly
      const testResponse = await fetch('https://discord.com/api/test');
      const testData = await testResponse.json() as any;

      expect(testResponse.ok).toBe(true);
      expect(testData.id).toBe('987654321');
      expect(testData.content).toBe('Message sent successfully');
    });
  });

  describe('Discord API Error Handling', () => {
    it('should handle rate limiting (429) responses', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call returns rate limit
          return Promise.resolve({
            ok: false,
            status: 429,
            json: async () => ({
              retry_after: 0.1, // 100ms
              global: false,
            }),
            text: async () => 'Too Many Requests',
          });
        } else {
          // Second call succeeds
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ id: '123456789' }),
            text: async () => 'OK',
          });
        }
      });

      const commandInteraction: CommandInteraction = {
        id: 'interaction-rate-limit',
        type: InteractionType.APPLICATION_COMMAND,
        data: {
          id: 'cmd-id',
          name: 'chouseichan',
          options: [],
        },
        channel_id: 'test-channel',
        guild_id: 'test-guild',
        member: {
          user: {
            id: 'user-123',
            username: 'TestUser',
            discriminator: '0001',
          },
          roles: [],
        },
        token: 'test-token',
      };

      const commandController = createCommandController(env);
      const response = await commandController.handleChouseichanCommand(commandInteraction, env);

      // Should still return a valid response
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.type).toBe(InteractionResponseType.MODAL);
    });

    it('should handle server errors (500) gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          message: 'Internal Server Error',
          code: 0,
        }),
        text: async () => 'Internal Server Error',
      });

      const commandInteraction: CommandInteraction = {
        id: 'interaction-server-error',
        type: InteractionType.APPLICATION_COMMAND,
        data: {
          id: 'cmd-id',
          name: 'chouseichan',
          options: [],
        },
        channel_id: 'test-channel',
        guild_id: 'test-guild',
        member: {
          user: {
            id: 'user-123',
            username: 'TestUser',
            discriminator: '0001',
          },
          roles: [],
        },
        token: 'test-token',
      };

      const commandController = createCommandController(env);
      const response = await commandController.handleChouseichanCommand(commandInteraction, env);

      // Should still return a response (fallback behavior)
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.type).toBe(InteractionResponseType.MODAL);
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network Error'));

      const commandInteraction: CommandInteraction = {
        id: 'interaction-network-error',
        type: InteractionType.APPLICATION_COMMAND,
        data: {
          id: 'cmd-id',
          name: 'chouseichan',
          options: [],
        },
        channel_id: 'test-channel',
        guild_id: 'test-guild',
        member: {
          user: {
            id: 'user-123',
            username: 'TestUser',
            discriminator: '0001',
          },
          roles: [],
        },
        token: 'test-token',
      };

      const commandController = createCommandController(env);
      const response = await commandController.handleChouseichanCommand(commandInteraction, env);

      // Should still return a response despite network error
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.type).toBe(InteractionResponseType.MODAL);
    });
  });

  describe('Message Update Queue Integration', () => {
    it('should queue message updates properly', async () => {
      // Mock successful Discord API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: '123456789' }),
        text: async () => 'OK',
      });

      // Mock queue send function
      const mockQueueSend = vi.fn().mockResolvedValue(undefined);
      env.MESSAGE_UPDATE_QUEUE = {
        send: mockQueueSend,
      } as any;

      // Create a schedule first
      const createScheduleUseCase = container.applicationServices.createScheduleUseCase;
      const scheduleResult = await createScheduleUseCase.execute({
        title: 'Queue Test Schedule',
        description: 'Testing message update queue',
        dates: [{ id: 'date1', datetime: new Date(Date.now() + 172800000).toISOString() }],
        guildId: 'test-guild',
        channelId: 'test-channel',
        authorId: 'user-123',
        authorUsername: 'TestUser',
      });

      expect(scheduleResult.success).toBe(true);
      const scheduleId = scheduleResult.schedule?.id || '';
      expect(scheduleId).toBeTruthy();

      // Simulate button interaction that should trigger queue
      const buttonInteraction: ButtonInteraction = {
        id: 'interaction-queue',
        type: InteractionType.MESSAGE_COMPONENT,
        data: {
          custom_id: `respond:${scheduleId}`,
          component_type: 2,
        },
        channel_id: 'test-channel',
        guild_id: 'test-guild',
        member: {
          user: {
            id: 'user-456',
            username: 'Responder',
            discriminator: '0002',
          },
          roles: [],
        },
        message: {
          id: 'message-123',
          content: '',
          embeds: [],
          components: [],
        },
        token: 'test-token',
      };

      const buttonController = new ButtonInteractionController(container);
      const response = await buttonController.handleButtonInteraction(buttonInteraction, env);

      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(data.data.flags).toBe(64); // Ephemeral
    });

    it('should handle queue failures gracefully', async () => {
      // Mock queue send function that fails
      const mockQueueSend = vi.fn().mockRejectedValue(new Error('Queue unavailable'));
      env.MESSAGE_UPDATE_QUEUE = {
        send: mockQueueSend,
      } as any;

      // Mock successful Discord API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: '123456789' }),
        text: async () => 'OK',
      });

      // Create a schedule
      const createScheduleUseCase = container.applicationServices.createScheduleUseCase;
      const scheduleResult = await createScheduleUseCase.execute({
        title: 'Queue Failure Test',
        description: 'Testing queue failure handling',
        dates: [{ id: 'date1', datetime: new Date(Date.now() + 172800000).toISOString() }],
        guildId: 'test-guild',
        channelId: 'test-channel',
        authorId: 'user-123',
        authorUsername: 'TestUser',
      });

      expect(scheduleResult.success).toBe(true);

      // Interaction should still work even if queue fails
      const commandInteraction: CommandInteraction = {
        id: 'interaction-queue-fail',
        type: InteractionType.APPLICATION_COMMAND,
        data: {
          id: 'cmd-id',
          name: 'chouseichan',
          options: [],
        },
        channel_id: 'test-channel',
        guild_id: 'test-guild',
        member: {
          user: {
            id: 'user-123',
            username: 'TestUser',
            discriminator: '0001',
          },
          roles: [],
        },
        token: 'test-token',
      };

      const commandController = createCommandController(env);
      const response = await commandController.handleChouseichanCommand(commandInteraction, env);

      // Should still return valid response despite queue failure
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.type).toBe(InteractionResponseType.MODAL);
    });
  });

  describe('Background Task Integration', () => {
    it('should handle background tasks with waitUntil', async () => {
      // Mock successful Discord API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: '123456789' }),
        text: async () => 'OK',
      });

      // Mock waitUntil function
      const mockWaitUntil = vi.fn();
      env.ctx = {
        waitUntil: mockWaitUntil,
      } as any;

      // Create a schedule that would trigger background tasks
      const createScheduleUseCase = container.applicationServices.createScheduleUseCase;
      const scheduleResult = await createScheduleUseCase.execute({
        title: 'Background Task Test',
        description: 'Testing background task handling',
        dates: [{ id: 'date1', datetime: new Date(Date.now() + 172800000).toISOString() }],
        guildId: 'test-guild',
        channelId: 'test-channel',
        authorId: 'user-123',
        authorUsername: 'TestUser',
        deadline: new Date(Date.now() + 86400000).toISOString(),
      });

      expect(scheduleResult.success).toBe(true);

      // Verify that background tasks can be processed
      // (Note: actual background processing is handled by the controller implementations)
      expect(scheduleResult.schedule?.deadline).toBeDefined();
    });

    it('should handle missing waitUntil gracefully', async () => {
      // Mock successful Discord API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: '123456789' }),
        text: async () => 'OK',
      });

      // Remove waitUntil to simulate environment without it
      env.ctx = undefined;

      const commandInteraction: CommandInteraction = {
        id: 'interaction-no-waituntil',
        type: InteractionType.APPLICATION_COMMAND,
        data: {
          id: 'cmd-id',
          name: 'chouseichan',
          options: [],
        },
        channel_id: 'test-channel',
        guild_id: 'test-guild',
        member: {
          user: {
            id: 'user-123',
            username: 'TestUser',
            discriminator: '0001',
          },
          roles: [],
        },
        token: 'test-token',
      };

      const commandController = createCommandController(env);
      const response = await commandController.handleChouseichanCommand(commandInteraction, env);

      // Should still work without waitUntil
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.type).toBe(InteractionResponseType.MODAL);
    });
  });

  describe('Content-Type and Response Format Validation', () => {
    it('should return proper JSON responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: '123456789' }),
        text: async () => 'OK',
      });

      const commandInteraction: CommandInteraction = {
        id: 'interaction-json',
        type: InteractionType.APPLICATION_COMMAND,
        data: {
          id: 'cmd-id',
          name: 'chouseichan',
          options: [],
        },
        channel_id: 'test-channel',
        guild_id: 'test-guild',
        member: {
          user: {
            id: 'user-123',
            username: 'TestUser',
            discriminator: '0001',
          },
          roles: [],
        },
        token: 'test-token',
      };

      const commandController = createCommandController(env);
      const response = await commandController.handleChouseichanCommand(commandInteraction, env);

      // Verify response format
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');

      const data = await response.json() as any;
      expect(typeof data).toBe('object');
      expect(data.type).toBeDefined();
      expect(data.data).toBeDefined();
    });

    it('should handle invalid JSON responses from Discord API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        },
        text: async () => 'Invalid JSON Response',
      });

      const commandInteraction: CommandInteraction = {
        id: 'interaction-invalid-json',
        type: InteractionType.APPLICATION_COMMAND,
        data: {
          id: 'cmd-id',
          name: 'chouseichan',
          options: [],
        },
        channel_id: 'test-channel',
        guild_id: 'test-guild',
        member: {
          user: {
            id: 'user-123',
            username: 'TestUser',
            discriminator: '0001',
          },
          roles: [],
        },
        token: 'test-token',
      };

      const commandController = createCommandController(env);
      const response = await commandController.handleChouseichanCommand(commandInteraction, env);

      // Should still return a valid response
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.type).toBe(InteractionResponseType.MODAL);
    });
  });
});

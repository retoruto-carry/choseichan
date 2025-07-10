import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { handleButtonInteraction } from '../src/handlers/buttons';
import { ButtonInteraction, Env } from '../src/types/discord';
import { Schedule } from '../src/types/schedule';
import { generateId } from '../src/utils/id';
import { createTestD1Database, closeTestDatabase, applyMigrations, createTestEnv } from './helpers/d1-database';
import type { D1Database } from './helpers/d1-database';
import { expectInteractionResponse } from './helpers/interaction-schemas';
import { createTestSchedule, createTestStorage } from './helpers/test-utils';

// Mock the discord utils
vi.mock('../src/utils/discord', () => ({
  updateOriginalMessage: vi.fn(async () => {})
}));

describe('Button Interactions', () => {
  let db: D1Database;
  let env: Env;
  let testSchedule: Schedule;
  
  beforeEach(async () => {
    db = createTestD1Database();
    await applyMigrations(db);
    env = createTestEnv(db);

    // Create test schedule using helper
    testSchedule = createTestSchedule({
      id: 'test_schedule_id',
      channelId: 'test_channel',
      guildId: 'test-guild'
    });
    
    // Use helper to create storage and save the schedule
    const storage = await createTestStorage(env);
    await storage.saveSchedule(testSchedule);
  });
  
  afterEach(() => {
    closeTestDatabase(db);
  });

  it('should handle respond button click and show voting interface', async () => {
    const interaction: ButtonInteraction = {
      id: 'test_id',
      type: 3,
      data: {
        custom_id: 'respond:test_schedule_id',
        component_type: 2
      },
      channel_id: 'test_channel',
      guild_id: 'test-guild',
      member: {
        user: {
          id: 'user456',
          username: 'ResponseUser',
          discriminator: '0001'
        },
        roles: []
      },
      token: 'test_token',
      message: {
        id: 'msg_id',
        embeds: []
      }
    };

    const response = await handleButtonInteraction(interaction, env);
    const data = expectInteractionResponse(await response.json());
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data?.content).toContain('Test Event');
    expect(data.data?.content).toContain('回答を選択してください');
    expect(data.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    expect(data.data?.components).toBeDefined();
    expect(data.data?.embeds).toBeUndefined();
  });

  it('should handle details button click', async () => {
    const interaction: ButtonInteraction = {
      id: 'test_id',
      type: 3,
      data: {
        custom_id: 'details:test_schedule_id',
        component_type: 2
      },
      channel_id: 'test_channel',
      guild_id: 'test-guild',
      member: {
        user: {
          id: 'user456',
          username: 'ResponseUser',
          discriminator: '0001'
        },
        roles: []
      },
      token: 'test_token',
      message: {
        id: 'msg_id',
        embeds: []
      }
    };

    const response = await handleButtonInteraction(interaction, env);
    const data = expectInteractionResponse(await response.json());
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(data.data?.embeds).toHaveLength(1);
    expect(data.data?.embeds?.[0].title).toContain('Test Event - 詳細');
    expect(data.data?.components).toBeDefined();
  });

  it('should handle close button by owner', async () => {
    const interaction: ButtonInteraction = {
      id: 'test_id',
      type: 3,
      data: {
        custom_id: 'close:test_schedule_id',
        component_type: 2
      },
      channel_id: 'test_channel',
      guild_id: 'test-guild',
      member: {
        user: {
          id: 'user123', // Owner
          username: 'TestUser',
          discriminator: '0001'
        },
        roles: []
      },
      token: 'test_token',
      message: {
        id: 'msg_id',
        embeds: []
      }
    };

    const response = await handleButtonInteraction(interaction, env);
    const data = expectInteractionResponse(await response.json());
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data?.content).toContain('締め切りました');
    expect(data.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
  });

  it('should handle edit button click for owner', async () => {
    const interaction: ButtonInteraction = {
      id: 'test_id',
      type: 3,
      data: {
        custom_id: 'edit:test_schedule_id',
        component_type: 2
      },
      channel_id: 'test_channel',
      guild_id: 'test-guild',
      member: {
        user: {
          id: 'user123', // Owner
          username: 'TestUser',
          discriminator: '0001'
        },
        roles: []
      },
      token: 'test_token'
    };

    const response = await handleButtonInteraction(interaction, env);
    const data = expectInteractionResponse(await response.json());
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data?.content).toContain('編集する項目を選択してください');
    expect(data.data?.components).toHaveLength(2);
    expect(data.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
  });

  it('should reject edit button by non-owner', async () => {
    const interaction: ButtonInteraction = {
      id: 'test_id',
      type: 3,
      data: {
        custom_id: 'edit:test_schedule_id',
        component_type: 2
      },
      channel_id: 'test_channel',
      guild_id: 'test-guild',
      member: {
        user: {
          id: 'user456', // Not owner
          username: 'OtherUser',
          discriminator: '0001'
        },
        roles: []
      },
      token: 'test_token'
    };

    const response = await handleButtonInteraction(interaction, env);
    const data = expectInteractionResponse(await response.json());
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data?.content).toContain('編集できるのは作成者のみです');
    expect(data.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
  });

  it('should handle status button click', async () => {
    const interaction: ButtonInteraction = {
      id: 'test_id',
      type: 3,
      data: {
        custom_id: 'status:test_schedule_id',
        component_type: 2
      },
      channel_id: 'test_channel',
      guild_id: 'test-guild',
      member: {
        user: {
          id: 'user456',
          username: 'StatusUser',
          discriminator: '0001'
        },
        roles: []
      },
      token: 'test_token'
    };

    const response = await handleButtonInteraction(interaction, env);
    const data = expectInteractionResponse(await response.json());
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(data.data?.embeds).toHaveLength(1);
    expect(data.data?.embeds?.[0].title).toContain('Test Event');
  });

  it('should reject close button by non-owner', async () => {
    const interaction: ButtonInteraction = {
      id: 'test_id',
      type: 3,
      data: {
        custom_id: 'close:test_schedule_id',
        component_type: 2
      },
      channel_id: 'test_channel',
      guild_id: 'test-guild',
      member: {
        user: {
          id: 'user456', // Not owner
          username: 'OtherUser',
          discriminator: '0001'
        },
        roles: []
      },
      token: 'test_token',
      message: {
        id: 'msg_id',
        embeds: []
      }
    };

    const response = await handleButtonInteraction(interaction, env);
    const data = expectInteractionResponse(await response.json());
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data?.content).toContain('作成者のみです');
    expect(data.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
  });

  it('should handle select menu interaction', async () => {
    const interaction: ButtonInteraction = {
      id: 'test_id',
      type: 3,
      data: {
        custom_id: 'dateselect:test_schedule_id:date1',
        component_type: 3, // Select menu
        values: ['yes']
      },
      channel_id: 'test_channel',
      guild_id: 'test-guild',
      member: {
        user: {
          id: 'user456',
          username: 'SelectUser',
          discriminator: '0001'
        },
        roles: []
      },
      token: 'test_token',
      message: {
        id: 'msg_id',
        embeds: [],
        message_reference: {
          message_id: 'original_msg_id'
        }
      }
    };

    const response = await handleButtonInteraction(interaction, env);
    const data = expectInteractionResponse(await response.json());
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(6); // DEFERRED_UPDATE_MESSAGE
    expect(data.data).toBeUndefined();
    
    // Check that response was saved using StorageService
    const { StorageServiceV2 } = await import('../src/services/storage-v2');
    const storage = new StorageServiceV2(env);
    
    const savedResponse = await storage.getResponse('test_schedule_id', 'user456', 'test-guild');
    expect(savedResponse).toBeTruthy();
    expect(savedResponse?.responses).toHaveLength(1);
    expect(savedResponse?.responses[0].dateId).toBe('date1');
    expect(savedResponse?.responses[0].status).toBe('yes');
  });


  it('should handle date select menu with invalid schedule', async () => {
    const mockExecutionContext = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    } as unknown as ExecutionContext;
    
    const envWithContext = { ...env, ctx: mockExecutionContext };
    
    const interaction: ButtonInteraction = {
      id: 'test_id',
      type: 3,
      data: {
        custom_id: 'dateselect:invalid_schedule_id:date1',
        component_type: 3,
        values: ['yes']
      },
      channel_id: 'test_channel',
      guild_id: 'test-guild',
      member: {
        user: {
          id: 'user456',
          username: 'TestUser',
          discriminator: '0001'
        },
        roles: []
      },
      token: 'test_token'
    };

    const response = await handleButtonInteraction(interaction, envWithContext);
    const data = expectInteractionResponse(await response.json());
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.DEFERRED_UPDATE_MESSAGE);
    expect(data.data).toBeUndefined();
  });
});
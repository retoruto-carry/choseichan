import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InteractionType, InteractionResponseType } from 'discord-interactions';
import { handleChoseichanCommand } from '../src/handlers/commands';
import { CommandInteraction, Env } from '../src/types/discord';

// Mock KVNamespace
const createMockKVNamespace = () => {
  const storage = new Map();
  return {
    get: vi.fn(async (key: string) => storage.get(key) || null),
    put: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    list: vi.fn(async (options: { prefix: string }) => {
      const keys = Array.from(storage.keys())
        .filter(k => k.startsWith(options.prefix))
        .map(name => ({ name, metadata: {} }));
      return { keys };
    })
  } as unknown as KVNamespace;
};

describe('Choseichan Commands', () => {
  let env: Env;
  
  beforeEach(() => {
    env = {
      DISCORD_PUBLIC_KEY: 'test_public_key',
      DISCORD_APPLICATION_ID: 'test_app_id',
      DISCORD_TOKEN: 'test_token',
      SCHEDULES: createMockKVNamespace(),
      RESPONSES: createMockKVNamespace()
    };
  });

  it('should show modal for schedule creation', async () => {
    const interaction: CommandInteraction = {
      id: 'test_id',
      type: InteractionType.APPLICATION_COMMAND,
      data: {
        id: 'cmd_id',
        name: 'choseichan',
        options: [{
          name: 'create',
          type: 1
        }]
      },
      channel_id: 'test_channel',
      guild_id: 'test-guild',
      member: {
        user: {
          id: 'user123',
          username: 'TestUser',
          discriminator: '0001'
        },
        roles: []
      },
      token: 'test_token'
    };

    const response = await handleChoseichanCommand(interaction, env);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.MODAL);
    expect(data.data.title).toBe('日程調整を作成');
    expect(data.data.components).toHaveLength(4);
    expect(data.data.custom_id).toBe('modal:create_schedule');
  });


  it('should list schedules in channel', async () => {
    const interaction: CommandInteraction = {
      id: 'test_id',
      type: InteractionType.APPLICATION_COMMAND,
      data: {
        id: 'cmd_id',
        name: 'choseichan',
        options: [{
          name: 'list',
          type: 1
        }]
      },
      channel_id: 'test_channel',
      guild_id: 'test-guild',
      member: {
        user: {
          id: 'user123',
          username: 'TestUser',
          discriminator: '0001'
        },
        roles: []
      },
      token: 'test_token'
    };

    const response = await handleChoseichanCommand(interaction, env);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data.flags).toBe(64);
  });
});
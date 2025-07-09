import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InteractionType, InteractionResponseType } from 'discord-interactions';
import { handleScheduleCommand } from '../src/handlers/commands';
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

describe('Schedule Commands', () => {
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

  it('should create a schedule with valid dates', async () => {
    const interaction: CommandInteraction = {
      id: 'test_id',
      type: InteractionType.APPLICATION_COMMAND,
      data: {
        id: 'cmd_id',
        name: 'schedule',
        options: [{
          name: 'create',
          type: 1,
          options: [
            { name: 'title', type: 3, value: 'Test Event' },
            { name: 'date1', type: 3, value: '12/25 19:00' },
            { name: 'date2', type: 3, value: '12/26 18:00' }
          ]
        }]
      },
      channel_id: 'test_channel',
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

    const response = await handleScheduleCommand(interaction, env);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data.embeds).toHaveLength(1);
    expect(data.data.embeds[0].title).toContain('Test Event');
    expect(data.data.components).toBeDefined();
  });

  it('should handle missing dates', async () => {
    const interaction: CommandInteraction = {
      id: 'test_id',
      type: InteractionType.APPLICATION_COMMAND,
      data: {
        id: 'cmd_id',
        name: 'schedule',
        options: [{
          name: 'create',
          type: 1,
          options: [
            { name: 'title', type: 3, value: 'Test Event' }
          ]
        }]
      },
      channel_id: 'test_channel',
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

    const response = await handleScheduleCommand(interaction, env);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.data.content).toContain('少なくとも1つの日程を指定してください');
    expect(data.data.flags).toBe(64); // Ephemeral
  });

  it('should list schedules in channel', async () => {
    const interaction: CommandInteraction = {
      id: 'test_id',
      type: InteractionType.APPLICATION_COMMAND,
      data: {
        id: 'cmd_id',
        name: 'schedule',
        options: [{
          name: 'list',
          type: 1
        }]
      },
      channel_id: 'test_channel',
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

    const response = await handleScheduleCommand(interaction, env);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data.flags).toBe(64);
  });

  it('should handle status command with invalid ID', async () => {
    const interaction: CommandInteraction = {
      id: 'test_id',
      type: InteractionType.APPLICATION_COMMAND,
      data: {
        id: 'cmd_id',
        name: 'schedule',
        options: [{
          name: 'status',
          type: 1,
          options: [
            { name: 'id', type: 3, value: 'invalid_id' }
          ]
        }]
      },
      channel_id: 'test_channel',
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

    const response = await handleScheduleCommand(interaction, env);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.data.content).toContain('指定された日程調整が見つかりません');
    expect(data.data.flags).toBe(64);
  });
});
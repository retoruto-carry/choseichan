import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { handleButtonInteraction } from '../src/handlers/buttons';
import { ButtonInteraction, Env } from '../src/types/discord';
import { Schedule } from '../src/types/schedule';
import { generateId } from '../src/utils/id';

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

describe('Button Interactions', () => {
  let env: Env;
  let testSchedule: Schedule;
  
  beforeEach(async () => {
    env = {
      DISCORD_PUBLIC_KEY: 'test_public_key',
      DISCORD_APPLICATION_ID: 'test_app_id',
      DISCORD_TOKEN: 'test_token',
      SCHEDULES: createMockKVNamespace(),
      RESPONSES: createMockKVNamespace()
    };

    // Create test schedule
    testSchedule = {
      id: 'test_schedule_id',
      title: 'Test Event',
      dates: [
        { id: 'date1', datetime: '2024-12-25T19:00:00Z' },
        { id: 'date2', datetime: '2024-12-26T18:00:00Z' }
      ],
      createdBy: { id: 'user123', username: 'TestUser' },
      channelId: 'test_channel',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false
    };
    
    await env.SCHEDULES.put(
      `schedule:${testSchedule.id}`,
      JSON.stringify(testSchedule)
    );
  });

  it('should handle response button click and show voting interface', async () => {
    const interaction: ButtonInteraction = {
      id: 'test_id',
      type: 3,
      data: {
        custom_id: 'response:test_schedule_id',
        component_type: 2
      },
      channel_id: 'test_channel',
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
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data.content).toContain('Test Event');
    expect(data.data.content).toContain('回答を選択してください');
    expect(data.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    expect(data.data.components).toBeDefined();
    expect(data.data.embeds).toHaveLength(1);
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
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data.embeds).toHaveLength(1);
    expect(data.data.embeds[0].title).toContain('Test Event');
    expect(data.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
  });

  it('should reject response button for closed schedule', async () => {
    // Close the schedule
    testSchedule.status = 'closed';
    await env.SCHEDULES.put(
      `schedule:${testSchedule.id}`,
      JSON.stringify(testSchedule)
    );

    const interaction: ButtonInteraction = {
      id: 'test_id',
      type: 3,
      data: {
        custom_id: 'response:test_schedule_id:date1',
        component_type: 2
      },
      channel_id: 'test_channel',
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
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data.content).toContain('この日程調整は締め切られています');
    expect(data.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
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
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(data.data.embeds).toHaveLength(1);
    expect(data.data.components).toHaveLength(1); // Reopen button is shown
  });

  it('should handle vote button click', async () => {
    const interaction: ButtonInteraction = {
      id: 'test_id',
      type: 3,
      data: {
        custom_id: 'vote:test_schedule_id:date1:yes',
        component_type: 2
      },
      channel_id: 'test_channel',
      member: {
        user: {
          id: 'user456',
          username: 'VoteUser',
          discriminator: '0001'
        },
        roles: []
      },
      token: 'test_token'
    };

    const response = await handleButtonInteraction(interaction, env);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data.content).toContain('更新しました');
    expect(data.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    
    // Check that response was saved
    const savedResponse = await env.RESPONSES.get('response:test_schedule_id:user456');
    expect(savedResponse).toBeTruthy();
    const parsed = JSON.parse(savedResponse);
    expect(parsed.responses).toHaveLength(1);
    expect(parsed.responses[0].dateId).toBe('date1');
    expect(parsed.responses[0].status).toBe('yes');
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
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data.content).toContain('編集する項目を選択してください');
    expect(data.data.components).toHaveLength(2);
    expect(data.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
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
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data.content).toContain('編集できるのは作成者のみです');
    expect(data.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
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
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data.embeds).toHaveLength(1);
    expect(data.data.embeds[0].title).toContain('Test Event');
    expect(data.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
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
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data.content).toContain('作成者のみです');
    expect(data.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
  });
});
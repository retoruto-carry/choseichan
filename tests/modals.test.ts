import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { handleModalSubmit } from '../src/handlers/modals';
import { Env } from '../src/types/discord';

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

describe('Modal Submit Interactions', () => {
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

  describe('Create Schedule Modal', () => {
    it('should create schedule from modal submission', async () => {
      const interaction = {
        id: 'test_id',
        type: 5, // MODAL_SUBMIT
        data: {
          custom_id: 'modal:create_schedule',
          components: [
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'title',
                value: '忘年会'
              }]
            },
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'description',
                value: '今年の忘年会です'
              }]
            },
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'dates',
                value: '12/25 19:00\n12/26 18:00\n12/27 19:00'
              }]
            },
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'deadline',
                value: '12/20 23:59'
              }]
            }
          ]
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

      const response = await handleModalSubmit(interaction, env);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(data.data.embeds).toHaveLength(1);
      expect(data.data.embeds[0].title).toContain('忘年会');
      expect(data.data.embeds[0].description).toContain('回答がありません'); // 表形式では初期状態で表示される
      expect(data.data.components).toBeDefined();
      
      // Check schedule was saved
      const schedules = await env.SCHEDULES.list({ prefix: 'schedule:' });
      expect(schedules.keys.length).toBe(1);
    });

    it('should handle invalid dates in modal submission', async () => {
      const interaction = {
        id: 'test_id',
        type: 5,
        data: {
          custom_id: 'modal:create_schedule',
          components: [
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'title',
                value: 'Test Event'
              }]
            },
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'description',
                value: ''
              }]
            },
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'dates',
                value: 'invalid date\nanother invalid'
              }]
            },
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'deadline',
                value: ''
              }]
            }
          ]
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

      const response = await handleModalSubmit(interaction, env);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(data.data.content).toContain('有効な日程が入力されていません');
      expect(data.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    });
  });

  describe('Edit Schedule Modal', () => {
    beforeEach(async () => {
      // Create a test schedule
      const schedule = {
        id: 'test_schedule_id',
        title: 'Original Title',
        description: 'Original Description',
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
        `schedule:${schedule.id}`,
        JSON.stringify(schedule)
      );
    });

    it('should update schedule info from modal', async () => {
      const interaction = {
        id: 'test_id',
        type: 5,
        data: {
          custom_id: 'modal:edit_info:test_schedule_id',
          components: [
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'title',
                value: '新年会'
              }]
            },
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'description',
                value: '新年会の日程調整です'
              }]
            }
          ]
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

      const response = await handleModalSubmit(interaction, env);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(data.data.content).toContain('更新しました');
      expect(data.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
      
      // Check schedule was updated
      const updatedSchedule = await env.SCHEDULES.get('schedule:test_schedule_id');
      const parsed = JSON.parse(updatedSchedule);
      expect(parsed.title).toBe('新年会');
      expect(parsed.description).toBe('新年会の日程調整です');
    });

    it('should add dates from modal', async () => {
      const interaction = {
        id: 'test_id',
        type: 5,
        data: {
          custom_id: 'modal:add_dates:test_schedule_id',
          components: [
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'dates',
                value: '12/28 19:00\n12/29 18:00'
              }]
            }
          ]
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

      const response = await handleModalSubmit(interaction, env);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(data.data.content).toContain('2件の日程を追加しました');
      expect(data.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
      
      // Check dates were added
      const updatedSchedule = await env.SCHEDULES.get('schedule:test_schedule_id');
      const parsed = JSON.parse(updatedSchedule);
      expect(parsed.dates).toHaveLength(4); // Original 2 + new 2
    });
  });
});
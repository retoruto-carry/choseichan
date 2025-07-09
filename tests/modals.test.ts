import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { handleModalSubmit } from '../src/handlers/modals/index';
import { Env } from '../src/types/discord';

// Mock the discord utils
vi.mock('../src/utils/discord', () => ({
  updateOriginalMessage: vi.fn(async () => {})
}));

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

      const response = await handleModalSubmit(interaction, env);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(data.data).toBeDefined();
      expect(data.data.embeds).toHaveLength(1);
      expect(data.data.embeds[0].title).toContain('忘年会');
      expect(data.data.embeds[0].description).toContain('今年の忘年会です');
      expect(data.data.components).toBeDefined();
      
      // Check schedule was saved
      const schedules = await env.SCHEDULES.list({ prefix: 'guild:test-guild:schedule:' });
      expect(schedules.keys.length).toBe(1);
    });

    it('should handle empty dates in modal submission', async () => {
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
                value: ''  // Empty dates
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

      const response = await handleModalSubmit(interaction, env);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(data.data.content).toContain('日程候補を入力してください');
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
        guildId: 'test-guild',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'open',
        notificationSent: false
      };
      
      await env.SCHEDULES.put(
        `guild:test-guild:schedule:${schedule.id}`,
        JSON.stringify(schedule)
      );
    });

    it('should update schedule info from modal', async () => {
      const interaction = {
        id: 'test_id',
        type: 5,
        data: {
          custom_id: 'modal:edit_info:test_schedule_id:test_message_id',
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

      const response = await handleModalSubmit(interaction, env);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(data.data.content).toContain('更新しました');
      expect(data.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
      
      // Check schedule was updated
      const updatedSchedule = await env.SCHEDULES.get('guild:test-guild:schedule:test_schedule_id');
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

      const response = await handleModalSubmit(interaction, env);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(data.data.embeds).toBeDefined();
      expect(data.data.embeds[0].title).toContain('日程を追加しました');
      expect(data.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
      
      // Check dates were added
      const updatedSchedule = await env.SCHEDULES.get('guild:test-guild:schedule:test_schedule_id');
      const parsed = JSON.parse(updatedSchedule);
      expect(parsed.dates).toHaveLength(4); // Original 2 + new 2
    });
  });

  describe('Edit Deadline Modal', () => {
    beforeEach(async () => {
      // Create a test schedule with deadline and reminders
      const schedule = {
        id: 'test_schedule_deadline',
        title: 'Deadline Test Event',
        description: 'Testing deadline changes',
        dates: [
          { id: 'date1', datetime: '2024-12-25 19:00' },
          { id: 'date2', datetime: '2024-12-26 18:00' }
        ],
        createdBy: { id: 'user123', username: 'TestUser' },
        authorId: 'user123',
        channelId: 'test_channel',
        guildId: 'test-guild',
        deadline: new Date('2024-12-20T23:59:00Z'),
        reminderSent: true,
        remindersSent: ['3d', '1d'],
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'open',
        notificationSent: false
      };
      
      await env.SCHEDULES.put(
        `guild:test-guild:schedule:${schedule.id}`,
        JSON.stringify(schedule)
      );
    });

    it('should reset reminders when deadline is changed', async () => {
      const interaction = {
        id: 'test_id',
        type: 5,
        data: {
          custom_id: 'modal:edit_deadline:test_schedule_deadline:test_message_id',
          components: [
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'deadline',
                value: '12/24 23:59' // New deadline
              }]
            }
          ]
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

      const response = await handleModalSubmit(interaction, env);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(data.data.content).toContain('締切日を');
      expect(data.data.content).toContain('更新しました');
      
      // Check reminders were reset
      const updatedSchedule = await env.SCHEDULES.get('guild:test-guild:schedule:test_schedule_deadline');
      const parsed = JSON.parse(updatedSchedule);
      expect(parsed.reminderSent).toBe(false);
      expect(parsed.remindersSent).toEqual([]);
    });

    it('should reset reminders when deadline is removed', async () => {
      const interaction = {
        id: 'test_id',
        type: 5,
        data: {
          custom_id: 'modal:edit_deadline:test_schedule_deadline:test_message_id',
          components: [
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'deadline',
                value: '' // Remove deadline
              }]
            }
          ]
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

      const response = await handleModalSubmit(interaction, env);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.data.content).toContain('締切日を削除しました');
      
      // Check reminders were reset
      const updatedSchedule = await env.SCHEDULES.get('guild:test-guild:schedule:test_schedule_deadline');
      const parsed = JSON.parse(updatedSchedule);
      expect(parsed.deadline).toBeUndefined();
      expect(parsed.reminderSent).toBe(false);
      expect(parsed.remindersSent).toEqual([]);
    });

    it('should reset reminders when adding deadline to schedule without one', async () => {
      // Create schedule without deadline
      const scheduleWithoutDeadline = {
        id: 'test_schedule_no_deadline',
        title: 'No Deadline Event',
        dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
        createdBy: { id: 'user123', username: 'TestUser' },
        authorId: 'user123',
        channelId: 'test_channel',
        guildId: 'test-guild',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'open',
        notificationSent: false
      };
      
      await env.SCHEDULES.put(
        `guild:test-guild:schedule:${scheduleWithoutDeadline.id}`,
        JSON.stringify(scheduleWithoutDeadline)
      );

      const interaction = {
        id: 'test_id',
        type: 5,
        data: {
          custom_id: 'modal:edit_deadline:test_schedule_no_deadline:test_message_id',
          components: [
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'deadline',
                value: '12/20 23:59' // Add deadline
              }]
            }
          ]
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

      const response = await handleModalSubmit(interaction, env);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.data.content).toContain('締切日を');
      expect(data.data.content).toContain('更新しました');
      
      // Check reminders were initialized
      const updatedSchedule = await env.SCHEDULES.get('guild:test-guild:schedule:test_schedule_no_deadline');
      const parsed = JSON.parse(updatedSchedule);
      expect(parsed.deadline).toBeDefined();
      expect(parsed.reminderSent).toBe(false);
      expect(parsed.remindersSent).toEqual([]);
    });
  });
});
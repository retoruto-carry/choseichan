import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { handleModalSubmit } from '../src/handlers/modals/index';
import { Env } from '../src/types/discord';
import { createTestD1Database, closeTestDatabase, applyMigrations, createTestEnv } from './helpers/d1-database';
import type { D1Database } from './helpers/d1-database';
import { expectInteractionResponse } from './helpers/interaction-schemas';
import { createTestSchedule, createTestStorage } from './helpers/test-utils';

// Mock the discord utils
vi.mock('../src/utils/discord', () => ({
  updateOriginalMessage: vi.fn(async () => {})
}));

describe('Modal Submit Interactions', () => {
  let db: D1Database;
  let env: Env;
  
  beforeEach(async () => {
    db = createTestD1Database();
    await applyMigrations(db);
    env = createTestEnv(db);
  });
  
  afterEach(() => {
    closeTestDatabase(db);
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
      const data = expectInteractionResponse(await response.json());
      
      expect(response.status).toBe(200);
      expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(data.data).toBeDefined();
      if (!data.data) throw new Error('data.data is undefined');
      expect(data.data.embeds).toHaveLength(1);
      expect(data.data.embeds?.[0].title).toContain('忘年会');
      expect(data.data.embeds?.[0].description).toContain('今年の忘年会です');
      expect(data.data.components).toBeDefined();
      
      // Check schedule was saved by verifying it can be retrieved
      const { StorageServiceV2 } = await import('../src/services/storage-v2');
      const storage = new StorageServiceV2(env);
      
      // Extract schedule ID from the response components
      const buttonRow = data.data?.components?.[0];
      const buttons = buttonRow?.components || [];
      const respondButton = buttons.find(btn => btn.custom_id?.startsWith('respond:'));
      const scheduleId = respondButton?.custom_id?.split(':')[1];
      
      expect(scheduleId).toBeDefined();
      const savedSchedule = await storage.getSchedule(scheduleId!, 'test-guild');
      expect(savedSchedule).toBeTruthy();
      expect(savedSchedule?.title).toBe('忘年会');
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
      const data = expectInteractionResponse(await response.json());
      
      expect(response.status).toBe(200);
      expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(data.data?.content).toContain('日程候補を入力してください');
      expect(data.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    });
  });

  describe('Edit Schedule Modal', () => {
    let editDb: D1Database;
    let editEnv: Env;
    
    beforeEach(async () => {
      // Create fresh environment for this test suite
      editDb = createTestD1Database();
      await applyMigrations(editDb);
      editEnv = createTestEnv(editDb);
      
      // Create a test schedule using helper
      const schedule = createTestSchedule({
        id: 'test_schedule_id',
        title: 'Original Title',
        description: 'Original Description',
        dates: [
          { id: 'date1', datetime: '2024-12-25T19:00:00Z' },
          { id: 'date2', datetime: '2024-12-26T18:00:00Z' }
        ]
      });
      
      // Use helper to create storage and save the schedule
      const storage = await createTestStorage(editEnv);
      await storage.saveSchedule(schedule);
    });
    
    afterEach(() => {
      closeTestDatabase(editDb);
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
        guild_id: 'test-guild',
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

      const response = await handleModalSubmit(interaction, editEnv);
      const data = expectInteractionResponse(await response.json());
      
      expect(response.status).toBe(200);
      expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(data.data?.content).toContain('更新しました');
      expect(data.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
      
      // Check schedule was updated using StorageService
      const { StorageServiceV2 } = await import('../src/services/storage-v2');
      const storage = new StorageServiceV2(editEnv);
      const updatedSchedule = await storage.getSchedule('test_schedule_id', 'test-guild');
      expect(updatedSchedule).toBeTruthy();
      expect(updatedSchedule?.title).toBe('新年会');
      expect(updatedSchedule?.description).toBe('新年会の日程調整です');
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

      const response = await handleModalSubmit(interaction, editEnv);
      const data = expectInteractionResponse(await response.json());
      
      expect(response.status).toBe(200);
      expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(data.data?.embeds).toBeDefined();
      expect(data.data?.embeds?.[0].title).toContain('日程を追加しました');
      expect(data.data?.flags).toBe(InteractionResponseFlags.EPHEMERAL);
      
      // Check dates were added using StorageService
      const { StorageServiceV2 } = await import('../src/services/storage-v2');
      const storage = new StorageServiceV2(editEnv);
      const updatedSchedule = await storage.getSchedule('test_schedule_id', 'test-guild');
      expect(updatedSchedule).toBeTruthy();
      expect(updatedSchedule?.dates).toHaveLength(4); // Original 2 + new 2
    });
  });

  describe('Edit Deadline Modal', () => {
    let deadlineDb: D1Database;
    let deadlineEnv: Env;
    
    beforeEach(async () => {
      // Create fresh environment for this test suite
      deadlineDb = createTestD1Database();
      await applyMigrations(deadlineDb);
      deadlineEnv = createTestEnv(deadlineDb);
      
      // Create a test schedule with deadline and reminders using helper
      const schedule = createTestSchedule({
        id: 'test_schedule_deadline',
        title: 'Deadline Test Event',
        description: 'Testing deadline changes',
        dates: [
          { id: 'date1', datetime: '2024-12-25 19:00' },
          { id: 'date2', datetime: '2024-12-26 18:00' }
        ],
        deadline: new Date('2024-12-20T23:59:00Z'),
        remindersSent: ['3d', '1d']
      });
      
      // Use helper to create storage and save the schedule
      const storage = await createTestStorage(deadlineEnv);
      await storage.saveSchedule(schedule);
    });
    
    afterEach(() => {
      closeTestDatabase(deadlineDb);
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

      const response = await handleModalSubmit(interaction, deadlineEnv);
      const data = expectInteractionResponse(await response.json());
      
      expect(response.status).toBe(200);
      expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(data.data?.content).toContain('締切日を');
      expect(data.data?.content).toContain('更新しました');
      
      // Check reminders were reset using StorageService
      const { StorageServiceV2: CheckStorage1 } = await import('../src/services/storage-v2');
      const checkStorage1 = new CheckStorage1(deadlineEnv);
      const updatedSchedule = await checkStorage1.getSchedule('test_schedule_deadline', 'test-guild');
      expect(updatedSchedule).toBeTruthy();
      // remindersSent should be reset to empty array
      expect(updatedSchedule?.remindersSent).toEqual([]);
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

      const response = await handleModalSubmit(interaction, deadlineEnv);
      const data = expectInteractionResponse(await response.json());
      
      expect(response.status).toBe(200);
      expect(data.data?.content).toContain('締切日を削除しました');
      
      // Check reminders were reset using StorageService
      const { StorageServiceV2: CheckStorage2 } = await import('../src/services/storage-v2');
      const storage2 = new CheckStorage2(deadlineEnv);
      const updatedSchedule = await storage2.getSchedule('test_schedule_deadline', 'test-guild');
      expect(updatedSchedule).toBeTruthy();
      expect(updatedSchedule?.deadline).toBeUndefined();
      // remindersSent should be reset to empty array
      expect(updatedSchedule?.remindersSent).toEqual([]);
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
        status: 'open' as const,
        notificationSent: false,
        totalResponses: 0
      };
      
      // Use StorageService to save the schedule
      const { StorageServiceV2: SaveStorage3 } = await import('../src/services/storage-v2');
      const storage3 = new SaveStorage3(deadlineEnv);
      await storage3.saveSchedule(scheduleWithoutDeadline);

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

      const response = await handleModalSubmit(interaction, deadlineEnv);
      const data = expectInteractionResponse(await response.json());
      
      expect(response.status).toBe(200);
      expect(data.data?.content).toContain('締切日を');
      expect(data.data?.content).toContain('更新しました');
      
      // Check reminders were initialized using StorageService
      const updatedSchedule = await storage3.getSchedule('test_schedule_no_deadline', 'test-guild');
      expect(updatedSchedule).toBeTruthy();
      expect(updatedSchedule?.deadline).toBeDefined();
      // remindersSent should be reset to empty array
      expect(updatedSchedule?.remindersSent).toEqual([]);
    });
  });
});
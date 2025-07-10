import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createScheduleManagementController } from '../src/presentation/controllers/ScheduleManagementController';
import { ButtonInteraction, Env } from '../src/types/discord';
import { StorageServiceV2 } from '../src/services/storage-v2';
import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { createTestD1Database, closeTestDatabase, applyMigrations, createTestEnv } from './helpers/d1-database';
import type { D1Database } from './helpers/d1-database';

// Mock the discord utils
vi.mock('../src/utils/discord', () => ({
  deleteMessage: vi.fn().mockResolvedValue(undefined)
}));


describe('Delete Schedule with Message', () => {
  let db: D1Database;
  let mockEnv: Env;
  let storage: StorageServiceV2;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Setup D1 database
    db = createTestD1Database();
    await applyMigrations(db);
    
    const waitUntilPromises: Promise<any>[] = [];
    mockEnv = {
      ...createTestEnv(db),
      ctx: {
        waitUntil: vi.fn((promise: Promise<any>) => {
          waitUntilPromises.push(promise);
        }),
        passThroughOnException: vi.fn()
      } as unknown as ExecutionContext
    };
    // Store the promises array separately for test assertions
    (mockEnv as any)._waitUntilPromises = waitUntilPromises;
    
    storage = new StorageServiceV2(mockEnv);
  });

  afterEach(() => {
    closeTestDatabase(db);
  });

  it('should delete both schedule and Discord message', async () => {
    const scheduleId = 'test-schedule';
    const messageId = 'test-message-123';
    const guildId = 'test-guild';
    
    const schedule = {
      id: scheduleId,
      title: 'Test Schedule',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: guildId,
      messageId: messageId, // This is the key - the main message ID
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open' as const,
      notificationSent: false,
      totalResponses: 0
    };
    
    // Save schedule
    await storage.saveSchedule(schedule);
    
    const interaction: ButtonInteraction = {
      id: 'test-interaction',
      type: 3,
      data: {
        custom_id: 'delete:test-schedule',
        component_type: 2
      },
      guild_id: guildId,
      channel_id: 'channel123',
      member: {
        user: {
          id: 'user123', // Same as creator
          username: 'TestUser',
          discriminator: '0001'
        },
        roles: []
      },
      token: 'test-token'
    };
    
    const { deleteMessage } = await import('../src/utils/discord');
    
    const response = await createScheduleManagementController(mockEnv).handleDeleteButton(interaction, [scheduleId], mockEnv);
    const data = await response.json() as any;
    
    // Verify response
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(data.data.content).toContain('削除しました');
    
    // Wait for all waitUntil promises to complete
    const testEnv = mockEnv as any;
    await Promise.all(testEnv._waitUntilPromises || []);
    
    // Now verify deleteMessage was called
    expect(deleteMessage).toHaveBeenCalledWith(
      'test-app-id',
      'test-token',
      'test-message-123'
    );
    
    // Verify schedule was deleted from storage
    const deletedSchedule = await storage.getSchedule(scheduleId, guildId);
    expect(deletedSchedule).toBeNull();
  });

  it('should continue deletion even if Discord message deletion fails', async () => {
    const scheduleId = 'test-schedule-2';
    const messageId = 'test-message-456';
    const guildId = 'test-guild';
    
    const schedule = {
      id: scheduleId,
      title: 'Test Schedule 2',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: guildId,
      messageId: messageId,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open' as const,
      notificationSent: false,
      totalResponses: 0
    };
    
    // Save schedule
    await storage.saveSchedule(schedule);
    
    // Mock deleteMessage to throw an error
    const { deleteMessage } = await import('../src/utils/discord');
    (deleteMessage as any).mockRejectedValueOnce(new Error('Message not found'));
    
    const interaction: ButtonInteraction = {
      id: 'test-interaction-2',
      type: 3,
      data: {
        custom_id: 'delete:test-schedule-2',
        component_type: 2
      },
      guild_id: guildId,
      channel_id: 'channel123',
      member: {
        user: {
          id: 'user123',
          username: 'TestUser',
          discriminator: '0001'
        },
        roles: []
      },
      token: 'test-token'
    };
    
    const response = await createScheduleManagementController(mockEnv).handleDeleteButton(interaction, [scheduleId], mockEnv);
    const data = await response.json() as any;
    
    // Verify response is still successful
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(data.data.content).toContain('削除しました');
    
    // Wait for all waitUntil promises to complete
    const testEnv2 = mockEnv as any;
    await Promise.all(testEnv2._waitUntilPromises || []);
    
    // Verify schedule was still deleted from storage
    const deletedSchedule = await storage.getSchedule(scheduleId, guildId);
    expect(deletedSchedule).toBeNull();
  });

  it('should not delete if user is not the creator', async () => {
    const scheduleId = 'test-schedule-3';
    const guildId = 'test-guild';
    
    const schedule = {
      id: scheduleId,
      title: 'Test Schedule 3',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: guildId,
      messageId: 'test-message-789',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open' as const,
      notificationSent: false,
      totalResponses: 0
    };
    
    // Save schedule
    await storage.saveSchedule(schedule);
    
    const interaction: ButtonInteraction = {
      id: 'test-interaction-3',
      type: 3,
      data: {
        custom_id: 'delete:test-schedule-3',
        component_type: 2
      },
      guild_id: guildId,
      channel_id: 'channel123',
      member: {
        user: {
          id: 'user456', // Different user
          username: 'OtherUser',
          discriminator: '0002'
        },
        roles: []
      },
      token: 'test-token'
    };
    
    const { deleteMessage } = await import('../src/utils/discord');
    
    const response = await createScheduleManagementController(mockEnv).handleDeleteButton(interaction, [scheduleId], mockEnv);
    const data = await response.json() as any;
    
    // Verify error response
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data.content).toContain('作成者のみ');
    expect(data.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    
    // Verify nothing was deleted
    expect(deleteMessage).not.toHaveBeenCalled();
    
    // Schedule should still exist
    const existingSchedule = await storage.getSchedule(scheduleId, guildId);
    expect(existingSchedule).not.toBeNull();
    expect(existingSchedule?.id).toBe(scheduleId);
  });
});
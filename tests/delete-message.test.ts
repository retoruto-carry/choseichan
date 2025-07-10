import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDeleteButton } from '../src/handlers/schedule-handlers';
import { ButtonInteraction, Env } from '../src/types/discord';
import { StorageServiceV2 } from '../src/services/storage-v2';
import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';

// Mock the discord utils
vi.mock('../src/utils/discord', () => ({
  deleteMessage: vi.fn()
}));

describe('Delete Schedule with Message', () => {
  let mockKV: any;
  let mockEnv: Env;
  let storage: StorageServiceV2;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn().mockResolvedValue({ keys: [] })
    };
    
    mockEnv = {
      DISCORD_PUBLIC_KEY: 'test-public-key',
      DISCORD_APPLICATION_ID: 'test-app-id',
      DISCORD_TOKEN: 'test-token',
      SCHEDULES: mockKV,
      RESPONSES: mockKV,
      ctx: {
        waitUntil: vi.fn((promise: Promise<any>) => {
          // Execute the promise immediately in tests
          promise.catch(() => {}); // Catch to avoid unhandled rejection
          return promise;
        })
      }
    } as Env;
    
    storage = new StorageServiceV2(mockKV, mockKV, mockEnv);
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
      status: 'open',
      notificationSent: false,
      totalResponses: 0
    };
    
    // Mock schedule retrieval (called twice - once in handler, once in deleteSchedule)
    mockKV.get.mockResolvedValue(JSON.stringify(schedule));
    
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
    
    const response = await handleDeleteButton(interaction, storage, [scheduleId], mockEnv);
    const data = await response.json();
    
    // Verify response
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(data.data.content).toContain('削除しました');
    
    // Wait for waitUntil to execute
    await vi.waitFor(() => {
      expect(deleteMessage).toHaveBeenCalledWith(
        'test-app-id',
        'test-token',
        'test-message-123'
      );
    });
    
    // Verify schedule was deleted from storage (multiple delete calls)
    expect(mockKV.delete).toHaveBeenCalledWith(`guild:${guildId}:schedule:${scheduleId}`);
    expect(mockKV.delete).toHaveBeenCalledWith(`guild:${guildId}:channel:${schedule.channelId}:${scheduleId}`);
    // Note: deadline index delete is also called since the schedule has a deadline
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
      status: 'open',
      notificationSent: false,
      totalResponses: 0
    };
    
    // Mock schedule retrieval (called twice - once in handler, once in deleteSchedule)
    mockKV.get.mockResolvedValue(JSON.stringify(schedule));
    
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
    
    const response = await handleDeleteButton(interaction, storage, [scheduleId], mockEnv);
    const data = await response.json();
    
    // Verify response is still successful
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.UPDATE_MESSAGE);
    expect(data.data.content).toContain('削除しました');
    
    // Wait for async operations to complete
    await vi.waitFor(() => {
      expect(mockKV.delete).toHaveBeenCalled();
    });
    
    // Verify schedule was still deleted from storage
    expect(mockKV.delete).toHaveBeenCalledWith(`guild:${guildId}:schedule:${scheduleId}`);
    expect(mockKV.delete).toHaveBeenCalledWith(`guild:${guildId}:channel:${schedule.channelId}:${scheduleId}`);
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
      status: 'open',
      notificationSent: false,
      totalResponses: 0
    };
    
    // Mock schedule retrieval (called twice - once in handler, once in deleteSchedule)
    mockKV.get.mockResolvedValue(JSON.stringify(schedule));
    
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
    
    const response = await handleDeleteButton(interaction, storage, [scheduleId], mockEnv);
    const data = await response.json();
    
    // Verify error response
    expect(response.status).toBe(200);
    expect(data.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(data.data.content).toContain('作成者のみ');
    expect(data.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    
    // Verify nothing was deleted
    expect(deleteMessage).not.toHaveBeenCalled();
    expect(mockKV.delete).not.toHaveBeenCalled();
  });
});
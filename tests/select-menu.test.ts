import { vi, describe, it, expect, beforeEach } from 'vitest';
import { InteractionType, InteractionResponseType } from 'discord-interactions';

// Mock discord utils before any imports that use it
vi.mock('../src/utils/discord', () => ({
  updateOriginalMessage: vi.fn()
}));

// Mock the storage service module
vi.mock('../src/services/storage-v2', () => ({
  StorageServiceV2: vi.fn()
}));

import { createButtonInteractionController } from '../src/presentation/controllers/ButtonInteractionController';
import { StorageServiceV2 } from '../src/services/storage-v2';
import { Schedule, ResponseStatus } from '../src/types/schedule';
import { ButtonInteraction, Env } from '../src/types/discord';
import { updateOriginalMessage } from '../src/utils/discord';

const mockUpdateOriginalMessage = updateOriginalMessage as any;

describe('Select Menu Interactions', () => {
  let mockEnv: Env;
  let mockStorage: any;
  let mockSchedule: Schedule;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockEnv = {
      DISCORD_PUBLIC_KEY: 'mock-public-key',
      DISCORD_APPLICATION_ID: 'mock-app-id',
      DISCORD_TOKEN: 'mock-token',
      DB: {} as any
    };

    mockSchedule = {
      id: 'schedule-123',
      title: 'Test Schedule',
      dates: [
        { id: 'date-1', datetime: '2024-01-20 19:00' },
        { id: 'date-2', datetime: '2024-01-21 20:00' }
      ],
      createdBy: { id: 'user-123', username: 'TestUser' },
      authorId: 'user-123',
      channelId: 'channel-123',
      guildId: 'test-guild',
      messageId: 'message-456', // Pre-saved message ID
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open' as const,
      notificationSent: false
    };

    // Create a mock storage instance
    mockStorage = {
      getSchedule: vi.fn(),
      saveSchedule: vi.fn(),
      getResponse: vi.fn(),
      saveResponse: vi.fn(),
      getScheduleSummary: vi.fn(),
      listSchedulesByChannel: vi.fn(),
      listResponsesBySchedule: vi.fn(),
      deleteSchedule: vi.fn(),
      deleteResponse: vi.fn(),
      updateSchedule: vi.fn()
    };

    // Set default mock implementations
    mockStorage.getSchedule.mockResolvedValue(mockSchedule);
    mockStorage.getResponse.mockResolvedValue(null);
    mockStorage.getScheduleSummary.mockResolvedValue({
      schedule: mockSchedule,
      responseCounts: {
        'date-1': { yes: 0, maybe: 0, no: 0, total: 0 },
        'date-2': { yes: 0, maybe: 0, no: 0, total: 0 }
      },
      userResponses: []
    });

    // Make StorageServiceV2 return our mock
    (StorageServiceV2 as any).mockImplementation(() => mockStorage);
  });

  it('should save message ID when respond button is clicked', async () => {
    const scheduleWithoutMessageId = { ...mockSchedule, messageId: undefined };
    mockStorage.getSchedule.mockResolvedValue(scheduleWithoutMessageId);

    const interaction: ButtonInteraction = {
      id: 'interaction-1',
      type: InteractionType.MESSAGE_COMPONENT,
      data: {
        custom_id: 'respond:schedule-123',
        component_type: 2
      },
      member: {
        user: { id: 'user-456', username: 'ResponderUser', discriminator: '0' },
        roles: []
      },
      token: 'mock-token',
      message: {
        id: 'message-456',
        embeds: []
      }
    };

    const response = await createButtonInteractionController(mockEnv).handleButtonInteraction(interaction, mockEnv);
    const responseData = await response.json() as any;

    // Should save the schedule with message ID
    expect(mockStorage.saveSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'schedule-123',
        messageId: 'message-456'
      })
    );

    // Should return ephemeral response with select menus
    expect(responseData.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(responseData.data.flags).toBe(64); // Ephemeral
    expect(responseData.data.components).toHaveLength(3); // 2 dates + 1 notice
    expect(responseData.data.components[0].components[0].type).toBe(3); // Select menu
    expect(responseData.data.components[2].components[0].type).toBe(2); // Notice button
  });

  it('should update main message when select menu is used', async () => {
    const interaction: ButtonInteraction = {
      id: 'interaction-2',
      type: InteractionType.MESSAGE_COMPONENT,
      data: {
        custom_id: 'dateselect:schedule-123:date-1',
        component_type: 3, // Select menu
        values: ['yes']
      },
      channel_id: 'channel-123',
      guild_id: 'test-guild',
      member: {
        user: { id: 'user-456', username: 'SelectUser', discriminator: '0' },
        roles: []
      },
      token: 'mock-token',
      message: {
        id: 'ephemeral-message-789', // This is the ephemeral message, not the main one
        embeds: []
      }
    };

    const response = await createButtonInteractionController(mockEnv).handleButtonInteraction(interaction, mockEnv);
    const responseData = await response.json() as any;

    // Should save the response
    expect(mockStorage.saveResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: 'schedule-123',
        userId: 'user-456',
        responses: [{ dateId: 'date-1', status: 'yes' }]
      }),
      'test-guild'
    );

    // Should NOT update the main message immediately due to KV consistency issues
    expect(mockUpdateOriginalMessage).not.toHaveBeenCalled();

    // Should return deferred update
    expect(responseData.type).toBe(6); // DEFERRED_UPDATE_MESSAGE
  });

  it('should handle select menu when no message ID is stored', async () => {
    const scheduleWithoutMessageId = { ...mockSchedule, messageId: undefined };
    mockStorage.getSchedule.mockResolvedValue(scheduleWithoutMessageId);

    const interaction: ButtonInteraction = {
      id: 'interaction-3',
      type: InteractionType.MESSAGE_COMPONENT,
      data: {
        custom_id: 'dateselect:schedule-123:date-1',
        component_type: 3,
        values: ['maybe']
      },
      channel_id: 'channel-123',
      guild_id: 'test-guild',
      member: {
        user: { id: 'user-789', username: 'NoMessageIdUser', discriminator: '0' },
        roles: []
      },
      token: 'mock-token',
      message: {
        id: 'ephemeral-message-999',
        embeds: []
      }
    };

    const response = await createButtonInteractionController(mockEnv).handleButtonInteraction(interaction, mockEnv);
    const responseData = await response.json() as any;

    // Should still save the response
    expect(mockStorage.saveResponse).toHaveBeenCalled();

    // Should not attempt to update the main message
    expect(mockUpdateOriginalMessage).not.toHaveBeenCalled();

    // Should still return deferred update
    expect(responseData.type).toBe(6);
  });
});
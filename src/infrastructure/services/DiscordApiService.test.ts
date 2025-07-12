import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscordApiService } from './DiscordApiService';

// Mock fetch globally
global.fetch = vi.fn();

describe('DiscordApiService', () => {
  let service: DiscordApiService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DiscordApiService();
  });

  describe('sendWebhookMessage', () => {
    it('should send a webhook message', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ id: 'message-123' }),
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as Response);

      const messageData = {
        content: 'Hello, world!',
        embeds: [
          {
            title: 'Test Embed',
            description: 'Test Description',
            color: 0x00ff00,
          },
        ],
      };

      await service.sendWebhookMessage('https://discord.com/api/webhooks/123/token', messageData);

      expect(global.fetch).toHaveBeenCalledWith('https://discord.com/api/webhooks/123/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });
    });
  });

  describe('updateMessage', () => {
    it('should update an existing message', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ id: 'message-123' }),
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as Response);

      const messageData = {
        content: 'Updated content',
        embeds: [],
      };

      await service.updateMessage('channel-123', 'message-123', messageData, 'bot-token');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/channels/channel-123/messages/message-123',
        {
          method: 'PATCH',
          headers: {
            Authorization: 'Bot bot-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messageData),
        }
      );
    });
  });

  describe('deleteMessage', () => {
    it('should delete a message', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as Response);

      await service.deleteMessage('channel-123', 'message-123', 'bot-token');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/channels/channel-123/messages/message-123',
        {
          method: 'DELETE',
          headers: {
            Authorization: 'Bot bot-token',
          },
        }
      );
    });
  });

  describe('getGuildMember', () => {
    it('should get guild member information', async () => {
      const mockMember = {
        user: {
          id: 'user-123',
          username: 'TestUser',
          discriminator: '0001',
        },
        nick: 'TestNick',
        roles: ['role-1', 'role-2'],
      };

      const mockResponse = {
        ok: true,
        json: async () => mockMember,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as Response);

      const result = await service.getGuildMember('guild-123', 'user-123', 'bot-token');

      expect(result).toEqual(mockMember);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/guilds/guild-123/members/user-123',
        {
          headers: {
            Authorization: 'Bot bot-token',
          },
        }
      );
    });

    it('should throw error when member not found', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as Response);

      await expect(service.getGuildMember('guild-123', 'user-123', 'bot-token')).rejects.toThrow(
        'Failed to fetch guild member: 404'
      );
    });
  });

  describe('createInteractionResponse', () => {
    it('should create interaction response with correct format', () => {
      const messageData = {
        content: 'Test response',
        embeds: [
          {
            title: 'Test Embed',
            description: 'Test Description',
          },
        ],
      };

      const result = service.createInteractionResponse(messageData);

      expect(result).toEqual({
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: messageData,
      });
    });

    it('should handle empty message data', () => {
      const messageData = {};

      const result = service.createInteractionResponse(messageData);

      expect(result).toEqual({
        type: 4,
        data: {},
      });
    });
  });
});

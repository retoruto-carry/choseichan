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

      await service.updateMessage({
        channelId: 'channel-123',
        messageId: 'message-123',
        message: messageData,
        botToken: 'bot-token',
      });

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

      await service.deleteMessage({
        channelId: 'channel-123',
        messageId: 'message-123',
        botToken: 'bot-token',
      });

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

      const result = await service.getGuildMember({
        guildId: 'guild-123',
        userId: 'user-123',
        botToken: 'bot-token',
      });

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

      await expect(
        service.getGuildMember({
          guildId: 'guild-123',
          userId: 'user-123',
          botToken: 'bot-token',
        })
      ).rejects.toThrow('Failed to fetch guild member: 404');
    });
  });

  describe('sendMessage', () => {
    it('should send a message to a channel', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ id: 'message-456' }),
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as Response);

      const result = await service.sendMessage({
        channelId: 'channel-123',
        message: { content: 'Hello, world!' },
        botToken: 'bot-token',
      });

      expect(result).toEqual({ id: 'message-456' });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/channels/channel-123/messages',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bot bot-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Hello, world!' }),
        }
      );
    });

    it('should throw error when sending message fails', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as Response);

      await expect(
        service.sendMessage({
          channelId: 'channel-123',
          message: { content: 'Hello, world!' },
          botToken: 'bot-token',
        })
      ).rejects.toThrow('Failed to send message: 400');
    });
  });

  describe('sendNotification', () => {
    it('should send a notification to a channel', async () => {
      const mockResponse = {
        ok: true,
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as Response);

      await service.sendNotification({
        channelId: 'channel-123',
        content: 'Test notification',
        botToken: 'bot-token',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/channels/channel-123/messages',
        {
          method: 'POST',
          headers: {
            Authorization: 'Bot bot-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: 'Test notification' }),
        }
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

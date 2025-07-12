import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getOriginalMessage, updateOriginalMessage } from './discord';

// Mock global fetch
global.fetch = vi.fn();

describe('Discord Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('updateOriginalMessage', () => {
    it('should make PATCH request to correct URL', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
      };
      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const applicationId = 'app123';
      const token = 'token456';
      const messageId = 'msg789';
      const data = { content: 'Updated message' };

      await updateOriginalMessage(applicationId, token, data, messageId);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/${messageId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      );
    });

    it('should throw error on non-ok response', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValueOnce('Not Found'),
      };
      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(updateOriginalMessage('app123', 'token456', {}, 'msg789')).rejects.toThrow(
        'Failed to update message: 404 - Not Found'
      );
    });

    it('should handle complex data structures', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
      };
      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const complexData = {
        content: 'Test',
        embeds: [
          {
            title: 'Test Embed',
            description: 'Test Description',
            fields: [{ name: 'Field 1', value: 'Value 1', inline: true }],
          },
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 1,
                label: 'Button',
                custom_id: 'test_button',
              },
            ],
          },
        ],
      };

      await updateOriginalMessage('app123', 'token456', complexData, 'msg789');

      const [[, requestInit]] = (global.fetch as any).mock.calls;
      expect(JSON.parse(requestInit.body)).toEqual(complexData);
    });
  });

  describe('getOriginalMessage', () => {
    it('should make GET request to correct URL', async () => {
      const mockData = { id: 'msg123', content: 'Test message' };
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce(mockData),
      };
      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const applicationId = 'app123';
      const token = 'token456';

      const result = await getOriginalMessage(applicationId, token);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      expect(result).toEqual(mockData);
    });

    it('should throw error on non-ok response', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
      };
      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(getOriginalMessage('app123', 'token456')).rejects.toThrow(
        'Failed to get message: 403'
      );
    });

    it('should return parsed JSON data', async () => {
      const expectedData = {
        id: 'msg123',
        content: 'Test content',
        embeds: [
          {
            title: 'Test Embed',
            description: 'Test Description',
          },
        ],
        components: [],
        author: {
          id: 'user123',
          username: 'TestUser',
        },
      };

      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValueOnce(expectedData),
      };
      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await getOriginalMessage('app123', 'token456');

      expect(result).toEqual(expectedData);
      expect(mockResponse.json).toHaveBeenCalledOnce();
    });
  });
});

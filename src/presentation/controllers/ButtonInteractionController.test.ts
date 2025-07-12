import { InteractionResponseFlags, InteractionResponseType } from 'discord-interactions';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { parseButtonId } from '../../utils/id';
import { ButtonInteractionController } from './ButtonInteractionController';

// Mock dependencies
vi.mock('../../utils/id', () => ({
  parseButtonId: vi.fn(),
}));

describe('ButtonInteractionController', () => {
  let controller: ButtonInteractionController;
  let mockContainer: DependencyContainer;
  let mockInteraction: any;
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContainer = {} as DependencyContainer;
    controller = new ButtonInteractionController(mockContainer);

    mockEnv = {
      DISCORD_TOKEN: 'test-token',
      DISCORD_APPLICATION_ID: 'test-app-id',
    };

    mockInteraction = {
      data: {
        custom_id: 'test_action:param1:param2',
      },
      member: {
        user: { id: 'user-123' },
      },
      guild_id: 'guild-123',
      channel_id: 'channel-123',
    };
  });

  describe('handle', () => {
    it('should handle parse error', async () => {
      vi.mocked(parseButtonId).mockReturnValue(null as any);

      const result = await controller.handleButtonInteraction(mockInteraction, mockEnv);

      expect(result.status).toBe(200);
      const responseData = JSON.parse(await result.text());
      expect(responseData).toEqual({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'ボタンIDの解析に失敗しました',
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(parseButtonId).mockImplementation(() => {
        throw new Error('Parse error');
      });

      const result = await controller.handleButtonInteraction(mockInteraction, mockEnv);

      expect(result.status).toBe(200);
      const responseData = JSON.parse(await result.text());
      expect(responseData).toEqual({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'ボタンの処理中にエラーが発生しました。',
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    });

    it('should handle unknown action', async () => {
      vi.mocked(parseButtonId).mockReturnValue({
        action: 'unknown_action',
        params: [],
      });

      const result = await controller.handleButtonInteraction(mockInteraction, mockEnv);

      expect(result.status).toBe(200);
      const responseData = JSON.parse(await result.text());
      expect(responseData).toEqual({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '不明なボタンです。',
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    });
  });
});

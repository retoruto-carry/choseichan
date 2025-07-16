import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DISCORD_API_CONSTANTS } from '../../infrastructure/constants/DiscordConstants';
import type { Env } from '../../infrastructure/types/discord';
import type { DiscordComponent } from '../../infrastructure/types/discord-api';
import { sendFollowupMessage } from './discord-webhook';

// Loggerをモック
vi.mock('../../infrastructure/logging/Logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// グローバルfetchをモック
global.fetch = vi.fn();

describe('discord-webhook', () => {
  const mockEnv: Env = {
    DISCORD_TOKEN: 'test-token',
    DISCORD_APPLICATION_ID: 'test-app-id',
    DISCORD_PUBLIC_KEY: 'test-public-key',
    DB: {} as any,
    MESSAGE_UPDATE_QUEUE: {} as any,
    DEADLINE_REMINDER_QUEUE: {} as any,
  };

  const applicationId = 'app123';
  const interactionToken = 'token456';
  const content = 'フォローアップメッセージ';
  const components: DiscordComponent[] = [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 1,
          label: 'ボタン',
          custom_id: 'test_button',
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sendFollowupMessage', () => {
    it('正しいURLとパラメータでfetchを呼び出す', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => 'Success',
      } as Response);

      await sendFollowupMessage(applicationId, interactionToken, content, components, mockEnv);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${mockEnv.DISCORD_TOKEN}`,
          },
          body: JSON.stringify({
            content,
            components,
            flags: DISCORD_API_CONSTANTS.FLAGS.EPHEMERAL,
          }),
        }
      );
    });

    it('APIエラーの場合でも例外をスローしない', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      } as Response);

      // 例外をスローしないことを確認
      await expect(
        sendFollowupMessage(applicationId, interactionToken, content, components, mockEnv)
      ).resolves.not.toThrow();

      // APIが呼ばれたことを確認
      expect(global.fetch).toHaveBeenCalled();
    });

    it('ネットワークエラーの場合でも例外をスローしない', async () => {
      const networkError = new Error('Network error');
      vi.mocked(global.fetch).mockRejectedValueOnce(networkError);

      // 例外をスローしないことを確認
      await expect(
        sendFollowupMessage(applicationId, interactionToken, content, components, mockEnv)
      ).resolves.not.toThrow();
    });

    it('空のコンポーネント配列でも正しく動作する', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => 'Success',
      } as Response);

      await sendFollowupMessage(applicationId, interactionToken, content, [], mockEnv);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.components).toEqual([]);
    });

    it('エラーが発生しても例外をスローしない', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Fatal error'));

      // 例外がスローされないことを確認
      await expect(
        sendFollowupMessage(applicationId, interactionToken, content, components, mockEnv)
      ).resolves.toBeUndefined();
    });

    it('フラグは常にEPHEMERAL', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        text: async () => 'Success',
      } as Response);

      await sendFollowupMessage(applicationId, interactionToken, content, components, mockEnv);

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.flags).toBe(DISCORD_API_CONSTANTS.FLAGS.EPHEMERAL);
    });
  });
});

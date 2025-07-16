import { InteractionResponseFlags, InteractionResponseType } from 'discord-interactions';
import { describe, expect, it } from 'vitest';
import type { DiscordComponent, DiscordEmbed } from '../../infrastructure/types/discord-api';
import {
  createDeferredUpdateResponse,
  createEphemeralResponse,
  createErrorResponse,
  createSuccessResponse,
} from './responses';

describe('responses', () => {
  describe('createEphemeralResponse', () => {
    it('基本的なephemeralレスポンスを作成できる', async () => {
      const response = createEphemeralResponse('テストメッセージ');
      const body = JSON.parse(await response.text());

      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(body).toEqual({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'テストメッセージ',
          embeds: undefined,
          components: undefined,
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    });

    it('embeds付きのephemeralレスポンスを作成できる', async () => {
      const embeds: DiscordEmbed[] = [
        {
          title: 'テストEmbed',
          description: 'テスト説明',
          color: 0x00ff00,
        },
      ];
      const response = createEphemeralResponse('メッセージ', embeds);
      const body = JSON.parse(await response.text());

      expect(body.data.embeds).toEqual(embeds);
    });

    it('components付きのephemeralレスポンスを作成できる', async () => {
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
      const response = createEphemeralResponse('メッセージ', undefined, components);
      const body = JSON.parse(await response.text());

      expect(body.data.components).toEqual(components);
    });

    it('すべての要素を含むephemeralレスポンスを作成できる', async () => {
      const embeds: DiscordEmbed[] = [{ title: 'テスト' }];
      const components: DiscordComponent[] = [{ type: 1, components: [] }];
      const response = createEphemeralResponse('メッセージ', embeds, components);
      const body = JSON.parse(await response.text());

      expect(body.data).toEqual({
        content: 'メッセージ',
        embeds,
        components,
        flags: InteractionResponseFlags.EPHEMERAL,
      });
    });
  });

  describe('createErrorResponse', () => {
    it('エラーレスポンスを作成できる', async () => {
      const response = createErrorResponse('エラーが発生しました');
      const body = JSON.parse(await response.text());

      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(body).toEqual({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '❌ エラーが発生しました',
          embeds: undefined,
          components: undefined,
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      });
    });

    it('エラーレスポンスは常にephemeral', async () => {
      const response = createErrorResponse('テストエラー');
      const body = JSON.parse(await response.text());

      expect(body.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    });
  });

  describe('createSuccessResponse', () => {
    it('成功レスポンスを作成できる（非ephemeral）', async () => {
      const response = createSuccessResponse('操作が完了しました');
      const body = JSON.parse(await response.text());

      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(body).toEqual({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '✅ 操作が完了しました',
          flags: undefined,
        },
      });
    });

    it('ephemeralな成功レスポンスを作成できる', async () => {
      const response = createSuccessResponse('操作が完了しました', true);
      const body = JSON.parse(await response.text());

      expect(body.data.flags).toBe(InteractionResponseFlags.EPHEMERAL);
    });

    it('デフォルトは非ephemeral', async () => {
      const response = createSuccessResponse('テスト成功');
      const body = JSON.parse(await response.text());

      expect(body.data.flags).toBeUndefined();
    });
  });

  describe('createDeferredUpdateResponse', () => {
    it('遅延更新レスポンスを作成できる', async () => {
      const response = createDeferredUpdateResponse();
      const body = JSON.parse(await response.text());

      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(body).toEqual({
        type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
      });
    });
  });
});

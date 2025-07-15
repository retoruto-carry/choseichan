/**
 * Discord メッセージ更新サービス
 *
 * Discord APIを使用してメッセージを更新する実装
 */

import type {
  IDiscordMessageUpdater,
  MessageComponent,
  MessageEmbed,
} from '../../application/ports/MessageFormatterPort';

export class DiscordMessageUpdaterService implements IDiscordMessageUpdater {
  /**
   * オリジナルメッセージを更新
   */
  async updateOriginalMessage(
    applicationId: string,
    interactionToken: string,
    data: {
      embeds?: MessageEmbed[];
      components?: MessageComponent[];
      content?: string;
    },
    messageId?: string
  ): Promise<void> {
    const url = messageId
      ? `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/${messageId}`
      : `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update message: ${response.status} - ${errorText}`);
    }
  }
}

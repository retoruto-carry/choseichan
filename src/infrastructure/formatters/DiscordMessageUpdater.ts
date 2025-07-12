/**
 * Discord メッセージ更新の実装
 *
 * プレゼンテーション層のユーティリティをラップし、
 * アプリケーション層のインターフェースを実装
 */

import type {
  IDiscordMessageUpdater,
  MessageComponent,
  MessageEmbed,
} from '../../application/ports/MessageFormatterPort';
import { updateOriginalMessage } from '../../presentation/utils/discord';

export class DiscordMessageUpdater implements IDiscordMessageUpdater {
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
    // プレゼンテーション層のユーティリティを呼び出し
    await updateOriginalMessage(applicationId, interactionToken, data, messageId);
  }
}

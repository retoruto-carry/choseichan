/**
 * Discord API Adapter
 *
 * IDiscordApiPort の Infrastructure 実装
 * infrastructure/services/DiscordApiService を使用
 */

import type {
  IDiscordApiPort,
  SearchGuildMembersOptions,
  SendMessageOptions,
  SendNotificationOptions,
  UpdateMessageOptions,
} from '../../application/ports/DiscordApiPort';
import { getLogger } from '../logging/Logger';
import { DiscordApiService } from '../services/DiscordApiService';

const logger = getLogger();

export class DiscordApiAdapter implements IDiscordApiPort {
  private discordApiService = new DiscordApiService();

  async updateMessage(options: UpdateMessageOptions): Promise<void> {
    await this.discordApiService.updateMessage({
      channelId: options.channelId,
      messageId: options.messageId,
      message: options.message,
      botToken: options.botToken,
    });
  }

  async sendMessage(options: SendMessageOptions): Promise<{ id: string }> {
    return await this.discordApiService.sendMessage({
      channelId: options.channelId,
      message: options.message,
      botToken: options.botToken,
    });
  }

  async sendNotification(options: SendNotificationOptions): Promise<void> {
    await this.discordApiService.sendNotification({
      channelId: options.channelId,
      content: options.content,
      botToken: options.botToken,
    });
  }

  async searchGuildMembers(options: SearchGuildMembersOptions): Promise<
    Array<{
      user: { id: string; username: string; discriminator: string };
    }>
  > {
    const { guildId, query, botToken, limit = 5 } = options;
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(
      query
    )}&limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    if (!response.ok) {
      // 検索エラー時は空配列を返す（ユーザー検索の失敗を許容し、アプリケーションの継続性を保つ）
      logger.warn('ギルドメンバー検索に失敗しました', { status: response.status });
      return [];
    }

    return (await response.json()) as Array<{
      user: { id: string; username: string; discriminator: string };
    }>;
  }
}

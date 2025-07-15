/**
 * Discord API Adapter
 *
 * IDiscordApiPort の Infrastructure 実装
 * infrastructure/services/DiscordApiService を使用
 */

import type { IDiscordApiPort } from '../../application/ports/DiscordApiPort';
import { getLogger } from '../logging/Logger';
import { DiscordApiService } from '../services/DiscordApiService';

const logger = getLogger();

export class DiscordApiAdapter implements IDiscordApiPort {
  private discordApiService = new DiscordApiService();

  async updateMessage(
    channelId: string,
    messageId: string,
    content: object,
    token: string
  ): Promise<void> {
    await this.discordApiService.updateMessage(channelId, messageId, content, token);
  }

  async sendMessage(channelId: string, content: object, token: string): Promise<{ id: string }> {
    return await this.discordApiService.sendMessage(channelId, content, token);
  }

  async sendNotification(channelId: string, content: string, token: string): Promise<void> {
    await this.discordApiService.sendNotification(channelId, content, token);
  }

  async searchGuildMembers(
    guildId: string,
    query: string,
    token: string,
    limit: number = 5
  ): Promise<
    Array<{
      user: { id: string; username: string; discriminator: string };
    }>
  > {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(
      query
    )}&limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bot ${token}`,
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

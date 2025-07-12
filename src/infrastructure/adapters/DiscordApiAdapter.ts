/**
 * Discord API Adapter
 *
 * IDiscordApiPort の Infrastructure 実装
 * infrastructure/services/DiscordApiService を使用
 */

import type { IDiscordApiPort } from '../../application/ports/DiscordApiPort';
import { DiscordApiService } from '../services/DiscordApiService';

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

  async fetchGuildMembers(guildId: string, token: string): Promise<Array<{
    user: { id: string; username: string; discriminator: string };
  }>> {
    const members: Array<{
      user: { id: string; username: string; discriminator: string };
    }> = [];
    let after: string | undefined;

    // Discord APIは一度に最大1000人のメンバーを取得可能
    while (true) {
      const url = `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000${after ? `&after=${after}` : ''}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bot ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch guild members: ${response.status}`);
      }

      const memberList = (await response.json()) as Array<{
        user: { id: string; username: string; discriminator: string };
      }>;

      if (memberList.length === 0) break;

      members.push(...memberList);

      if (memberList.length < 1000) break;
      after = memberList[memberList.length - 1].user.id;
    }

    return members;
  }
}
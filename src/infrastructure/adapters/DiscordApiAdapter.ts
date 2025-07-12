/**
 * Discord API Adapter
 *
 * Application層のIDiscordApiPortの実装
 * Infrastructure層のDiscordApiServiceを適合
 */

import type { IDiscordApiPort } from '../../application/ports/DiscordApiPort';
import type { IDiscordApiService } from '../services/DiscordApiService';

export class DiscordApiAdapter implements IDiscordApiPort {
  constructor(private discordApiService: IDiscordApiService) {}

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
    await this.discordApiService.sendMessage(channelId, { content }, token);
  }
}

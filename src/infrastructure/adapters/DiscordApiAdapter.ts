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
}
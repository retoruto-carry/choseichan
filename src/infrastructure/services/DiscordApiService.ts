/**
 * Discord API Service
 *
 * Discord APIとの通信を担当するインフラストラクチャサービス
 * 外部依存を分離し、テスタビリティを向上
 */

import type {
  APIEmbed,
  APIGuildMember,
  APIInteractionResponseChannelMessageWithSource,
  APIMessageComponent,
} from 'discord-api-types/v10';

export interface DiscordMessage {
  content?: string;
  embeds?: APIEmbed[];
  components?: APIMessageComponent[];
  ephemeral?: boolean;
}

export interface DiscordWebhookResponse {
  type: APIInteractionResponseChannelMessageWithSource['type'];
  data: DiscordMessage;
}

export interface IDiscordApiService {
  /**
   * Discord Webhookでメッセージを送信
   */
  sendWebhookMessage(webhookUrl: string, message: DiscordMessage): Promise<Response>;

  /**
   * Discord メッセージを更新
   */
  updateMessage(
    channelId: string,
    messageId: string,
    message: DiscordMessage,
    botToken: string
  ): Promise<Response>;

  /**
   * Discord メッセージを削除
   */
  deleteMessage(channelId: string, messageId: string, botToken: string): Promise<Response>;

  /**
   * ギルドメンバー情報を取得
   */
  getGuildMember(guildId: string, userId: string, botToken: string): Promise<APIGuildMember>;

  /**
   * Discord Interaction Response を作成
   */
  createInteractionResponse(message: DiscordMessage): DiscordWebhookResponse;

  /**
   * スケジュールメッセージを更新
   */
  updateScheduleMessage(
    channelId: string,
    messageId: string,
    summary: import('../../application/dto/ScheduleDto').ScheduleSummaryResponse,
    botToken: string
  ): Promise<void>;
}

export class DiscordApiService implements IDiscordApiService {
  private readonly baseUrl = 'https://discord.com/api/v10';

  async sendWebhookMessage(webhookUrl: string, message: DiscordMessage): Promise<Response> {
    return fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  }

  async updateMessage(
    channelId: string,
    messageId: string,
    message: DiscordMessage,
    botToken: string
  ): Promise<Response> {
    return fetch(`${this.baseUrl}/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  }

  async deleteMessage(channelId: string, messageId: string, botToken: string): Promise<Response> {
    return fetch(`${this.baseUrl}/channels/${channelId}/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });
  }

  async getGuildMember(guildId: string, userId: string, botToken: string): Promise<APIGuildMember> {
    const response = await fetch(`${this.baseUrl}/guilds/${guildId}/members/${userId}`, {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch guild member: ${response.status}`);
    }

    return response.json();
  }

  createInteractionResponse(message: DiscordMessage): DiscordWebhookResponse {
    return {
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: message,
    };
  }

  async updateScheduleMessage(
    channelId: string,
    messageId: string,
    summary: import('../../application/dto/ScheduleDto').ScheduleSummaryResponse,
    botToken: string
  ): Promise<void> {
    const { createScheduleEmbedWithTable, createSimpleScheduleComponents } = await import(
      '../../presentation/utils/embeds'
    );

    const embed = createScheduleEmbedWithTable(summary, false);
    const components = createSimpleScheduleComponents(summary.schedule, false);

    const response = await this.updateMessage(
      channelId,
      messageId,
      {
        embeds: [embed],
        components,
      },
      botToken
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Discord API error: ${response.status} - ${errorText}`);
    }
  }
}

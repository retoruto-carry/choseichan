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

// DiscordApiService用の名前付き引数インターフェース
export interface SendMessageOptions {
  readonly channelId: string;
  readonly message: object;
  readonly botToken: string;
}

export interface SendNotificationOptions {
  readonly channelId: string;
  readonly content: string;
  readonly botToken: string;
}

export interface UpdateMessageOptions {
  readonly channelId: string;
  readonly messageId: string;
  readonly message: DiscordMessage;
  readonly botToken: string;
}

export interface DeleteMessageOptions {
  readonly channelId: string;
  readonly messageId: string;
  readonly botToken: string;
}

export interface GetGuildMemberOptions {
  readonly guildId: string;
  readonly userId: string;
  readonly botToken: string;
}

export interface IDiscordApiService {
  /**
   * Discord Webhookでメッセージを送信
   */
  sendWebhookMessage(webhookUrl: string, message: DiscordMessage): Promise<Response>;

  /**
   * Discord メッセージを送信
   */
  sendMessage(options: SendMessageOptions): Promise<{ id: string }>;

  /**
   * Discord 通知を送信
   */
  sendNotification(options: SendNotificationOptions): Promise<void>;

  /**
   * Discord メッセージを更新
   */
  updateMessage(options: UpdateMessageOptions): Promise<Response>;

  /**
   * Discord メッセージを削除
   */
  deleteMessage(options: DeleteMessageOptions): Promise<Response>;

  /**
   * ギルドメンバー情報を取得
   */
  getGuildMember(options: GetGuildMemberOptions): Promise<APIGuildMember>;

  /**
   * Discord Interaction Response を作成
   */
  createInteractionResponse(message: DiscordMessage): DiscordWebhookResponse;
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

  async sendMessage(options: SendMessageOptions): Promise<{ id: string }> {
    const { channelId, message, botToken } = options;
    const response = await fetch(`${this.baseUrl}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`);
    }

    const data = (await response.json()) as { id: string };
    return { id: data.id };
  }

  async sendNotification(options: SendNotificationOptions): Promise<void> {
    const { channelId, content, botToken } = options;
    await fetch(`${this.baseUrl}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });
  }

  async updateMessage(options: UpdateMessageOptions): Promise<Response> {
    const { channelId, messageId, message, botToken } = options;
    return fetch(`${this.baseUrl}/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  }

  async deleteMessage(options: DeleteMessageOptions): Promise<Response> {
    const { channelId, messageId, botToken } = options;
    return fetch(`${this.baseUrl}/channels/${channelId}/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });
  }

  async getGuildMember(options: GetGuildMemberOptions): Promise<APIGuildMember> {
    const { guildId, userId, botToken } = options;
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

  // updateScheduleMessageメソッドは削除されました
  // Clean Architectureの原則に従い、embedとcomponentsの作成は
  // プレゼンテーション層で行い、updateMessageを直接使用してください
}

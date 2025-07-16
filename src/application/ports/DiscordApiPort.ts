/**
 * Discord API Port Interface
 *
 * Application層でのDiscord API操作の抽象化
 * Infrastructure層のDiscordApiService実装への依存を解消
 */

// Named argument interfaces for DiscordApiPort
export interface UpdateMessageOptions {
  readonly channelId: string;
  readonly messageId: string;
  readonly message: object;
  readonly botToken: string;
}

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

export interface SearchGuildMembersOptions {
  readonly guildId: string;
  readonly query: string;
  readonly botToken: string;
  readonly limit?: number;
}

export interface IDiscordApiPort {
  /**
   * メッセージを更新
   */
  updateMessage(options: UpdateMessageOptions): Promise<void>;

  /**
   * メッセージを送信
   */
  sendMessage(options: SendMessageOptions): Promise<{ id: string }>;

  /**
   * 通知を送信
   */
  sendNotification(options: SendNotificationOptions): Promise<void>;

  /**
   * ギルドメンバーを検索
   */
  searchGuildMembers(options: SearchGuildMembersOptions): Promise<
    Array<{
      user: { id: string; username: string; discriminator: string };
    }>
  >;
}

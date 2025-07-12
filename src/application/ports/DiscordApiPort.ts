/**
 * Discord API Port Interface
 *
 * Application層でのDiscord API操作の抽象化
 * Infrastructure層のDiscordApiService実装への依存を解消
 */

export interface IDiscordApiPort {
  /**
   * メッセージを更新
   */
  updateMessage(
    channelId: string,
    messageId: string,
    content: object,
    token: string
  ): Promise<void>;

  /**
   * メッセージを送信
   */
  sendMessage(channelId: string, content: object, token: string): Promise<{ id: string }>;

  /**
   * 通知を送信
   */
  sendNotification(channelId: string, content: string, token: string): Promise<void>;

  /**
   * ギルドメンバーを取得
   */
  fetchGuildMembers(
    guildId: string,
    token: string
  ): Promise<
    Array<{
      user: { id: string; username: string; discriminator: string };
    }>
  >;
}

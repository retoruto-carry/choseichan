/**
 * Message Update Types
 *
 * Application層でのメッセージ更新に関する型定義
 * Infrastructure層への依存を解消
 */

export interface MessageUpdateTask {
  scheduleId: string;
  messageId: string;
  channelId: string;
  guildId: string;
  updateType: string;
}

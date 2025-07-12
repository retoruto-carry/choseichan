/**
 * メッセージ更新サービス（ドメインサービス）
 *
 * メッセージ更新のビジネスルールを定義
 */

export interface MessageUpdateRequest {
  scheduleId: string;
  messageId: string;
  channelId: string;
  guildId: string;
  updateType: MessageUpdateType;
}

export enum MessageUpdateType {
  VOTE_UPDATE = 'vote_update',
  CLOSE_UPDATE = 'close_update',
  SUMMARY_UPDATE = 'summary_update',
}

export interface MessageUpdateService {
  /**
   * メッセージ更新をスケジュール
   */
  scheduleUpdate(request: MessageUpdateRequest): Promise<void>;
}

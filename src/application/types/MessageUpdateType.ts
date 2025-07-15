/**
 * メッセージ更新タイプ
 *
 * Presentation層から参照可能なメッセージ更新のタイプ定義
 * Domain層のMessageUpdateTypeと同じ値を持つが、
 * Clean Architectureの依存方向を守るために別定義
 */

export enum MessageUpdateType {
  VOTE_UPDATE = 'vote_update',
  CLOSE_UPDATE = 'close_update',
  SUMMARY_UPDATE = 'summary_update',
}

/**
 * Domain層のMessageUpdateTypeへの変換を行う場合は
 * Application層のサービスで行う
 */

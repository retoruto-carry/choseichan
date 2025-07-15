/**
 * メッセージ更新キューのポート定義（アプリケーション層）
 */

import type { MessageUpdateRequest } from '../../domain/services/MessageUpdateService';

export { MessageUpdateType } from '../../domain/services/MessageUpdateService';

export interface MessageUpdateTask extends MessageUpdateRequest {
  timestamp: number;
}

export interface MessageUpdateQueuePort {
  /**
   * タスクをキューに追加
   */
  enqueue(
    task: MessageUpdateTask,
    options?: {
      delaySeconds?: number;
    }
  ): Promise<void>;
}

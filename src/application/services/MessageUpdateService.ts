/**
 * メッセージ更新サービス実装（アプリケーション層）
 *
 * メッセージ更新をQueueに送信する設計理由：
 * 1. **非同期処理**: Discord APIへの更新を待たずにユーザーに即座にレスポンスを返す
 * 2. **デバウンス効果**: 2秒の遅延により連続投票をまとめて1回の更新に最適化
 * 3. **3秒制限対策**: Discordのインタラクション応答3秒制限を回避
 */

import {
  type MessageUpdateService as IMessageUpdateService,
  type MessageUpdateRequest,
  MessageUpdateType,
} from '../../domain/services/MessageUpdateService';
import type { MessageUpdateQueuePort } from '../ports/MessageUpdateQueuePort';

export class MessageUpdateService implements IMessageUpdateService {
  constructor(private readonly queuePort: MessageUpdateQueuePort) {}

  async scheduleUpdate(request: MessageUpdateRequest): Promise<void> {
    // ビジネスルール: 締切更新は即座に、投票更新は2秒遅延
    const delaySeconds = request.updateType === MessageUpdateType.CLOSE_UPDATE ? 0 : 2;

    await this.queuePort.enqueue(
      {
        ...request,
        timestamp: Date.now(),
      },
      {
        delaySeconds,
      }
    );
  }
}

/**
 * メッセージ更新サービス実装（アプリケーション層）
 */

import {
  type MessageUpdateRequest,
  type MessageUpdateService,
  MessageUpdateType,
} from '../../domain/services/MessageUpdateService';
import type { MessageUpdateQueuePort } from '../../infrastructure/ports/MessageUpdateQueuePort';

export class MessageUpdateServiceImpl implements MessageUpdateService {
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

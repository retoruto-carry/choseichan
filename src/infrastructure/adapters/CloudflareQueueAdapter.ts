/**
 * Cloudflare Queuesアダプター（インフラストラクチャ層）
 */

import type { MessageUpdateQueuePort, MessageUpdateTask } from '../ports/MessageUpdateQueuePort';
import { getLogger } from '../logging/Logger';

export class CloudflareQueueAdapter implements MessageUpdateQueuePort {
  private readonly logger = getLogger();

  constructor(
    private readonly queue: Queue<MessageUpdateTask> | undefined
  ) {}

  async enqueue(
    task: MessageUpdateTask,
    options?: { delaySeconds?: number }
  ): Promise<void> {
    if (!this.queue) {
      this.logger.warn('MESSAGE_UPDATE_QUEUE not configured, skipping message update', {
        operation: 'enqueue-message-update',
        scheduleId: task.scheduleId,
      });
      return;
    }

    try {
      await this.queue.send(task, {
        delaySeconds: options?.delaySeconds ?? 2,
      });
      
      this.logger.info('Message update enqueued', {
        operation: 'enqueue-message-update',
        scheduleId: task.scheduleId,
        messageId: task.messageId,
        delaySeconds: options?.delaySeconds ?? 2,
      });
    } catch (error) {
      this.logger.error(
        'Failed to enqueue message update',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'enqueue-message-update',
          scheduleId: task.scheduleId,
          messageId: task.messageId,
        }
      );
      throw error;
    }
  }
}
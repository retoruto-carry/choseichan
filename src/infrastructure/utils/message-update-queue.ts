/**
 * メッセージ更新キューハンドラー
 *
 * Cloudflare Queuesのバッチ処理を行うエントリーポイント
 */

import type { MessageUpdateTask } from '../../application/ports/MessageUpdateQueuePort';
import { DependencyContainer } from '../../di/DependencyContainer';
import { getLogger } from '../logging/Logger';
import type { Env } from '../types/discord';

const logger = getLogger();

/**
 * バッチでメッセージ更新を処理するコンシューマー
 * wrangler.tomlでconsumer設定が必要
 */
export async function handleMessageUpdateBatch(
  batch: MessageBatch<MessageUpdateTask>,
  env: Env
): Promise<void> {
  const container = new DependencyContainer(env);
  const processMessageUpdateUseCase = container.processMessageUpdateUseCase;

  if (!processMessageUpdateUseCase) {
    logger.error(
      'ProcessMessageUpdateUseCase not available - missing Discord credentials',
      new Error('Missing Discord credentials'),
      {
        service: 'message-update-queue',
      }
    );

    // すべてのメッセージをackして終了
    for (const message of batch.messages) {
      message.ack();
    }
    return;
  }

  // タスクを抽出してackする
  const tasks: MessageUpdateTask[] = [];
  for (const message of batch.messages) {
    tasks.push(message.body);
    message.ack();
  }

  logger.info('Processing message update batch', {
    operation: 'handle-message-update-batch',
    service: 'message-update-queue',
    batchSize: tasks.length,
  });

  // バッチ処理を実行
  await processMessageUpdateUseCase.executeBatch(tasks);
}

/**
 * メッセージ更新処理ユースケース
 *
 * Cloudflare Queuesを使用してメッセージ更新を処理する理由：
 * 1. **応答性の向上**: ユーザーへの応答を待たせずに即座に完了を返せる
 *    （注: メッセージ自体の更新は遅延するが、ユーザー体験は向上）
 * 2. **更新の一貫性保証**: 複数の同時更新があっても最新の状態のみを反映
 * 3. **API制限対策**: Discord APIのレート制限を自然に回避
 * 4. **エラー分離**: メッセージ更新の失敗が投票処理に影響しない
 */

import type { IDiscordApiPort } from '../../ports/DiscordApiPort';
import type { ILogger } from '../../ports/LoggerPort';
import type { IMessageFormatter } from '../../ports/MessageFormatterPort';
import type { MessageUpdateTask } from '../../types/MessageUpdateTypes';
import type { GetScheduleSummaryUseCase } from '../schedule/GetScheduleSummaryUseCase';

export class ProcessMessageUpdateUseCase {
  constructor(
    private readonly logger: ILogger,
    private readonly getScheduleSummaryUseCase: GetScheduleSummaryUseCase,
    private readonly discordApiService: IDiscordApiPort,
    private readonly messageFormatter: IMessageFormatter,
    private readonly discordToken: string
  ) {}

  /**
   * メッセージ更新タスクを処理
   */
  async execute(task: MessageUpdateTask): Promise<void> {
    try {
      // 最新のサマリーを取得
      const summaryResult = await this.getScheduleSummaryUseCase.execute(
        task.scheduleId,
        task.guildId
      );

      if (!summaryResult.success || !summaryResult.summary) {
        throw new Error(`Failed to get schedule summary: ${task.scheduleId}`);
      }

      // embedとcomponentsを作成（MessageFormatterを使用）
      const { embed, components } = this.messageFormatter.formatScheduleMessage(
        summaryResult.summary,
        true
      );

      // メッセージ更新を実行
      await this.discordApiService.updateMessage(
        task.channelId,
        task.messageId,
        {
          embeds: [embed],
          components,
        },
        this.discordToken
      );

      this.logger.info('Message updated successfully', {
        operation: 'process-message-update',
        scheduleId: task.scheduleId,
        messageId: task.messageId,
        updateType: task.updateType,
      });
    } catch (error) {
      this.logger.error(
        'Failed to process message update',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'process-message-update',
          scheduleId: task.scheduleId,
          messageId: task.messageId,
          updateType: task.updateType,
        }
      );
      throw error;
    }
  }

  /**
   * バッチ処理
   *
   * 重要な設計ポイント：
   * - 同一メッセージへの複数更新は最新のもののみを実行
   * - これにより古い状態でメッセージが上書きされることを防ぐ
   *
   * 例: User A, B, C が短時間に投票した場合
   * - バッチには3つの更新タスクが届く
   * - Mapによって最後のタスク（C投票後の状態）のみが実行される
   * - さらに実行時にDBから最新状態を取得するため、確実に最新の投票状態が反映される
   */
  async executeBatch(tasks: MessageUpdateTask[]): Promise<void> {
    // 同じメッセージに対する複数の更新をまとめる
    const latestUpdates = new Map<string, MessageUpdateTask>();

    for (const task of tasks) {
      const key = `${task.scheduleId}:${task.messageId}`;
      // 同じメッセージの最新タスクのみ保持（重複除去）
      latestUpdates.set(key, task);
    }

    // 最新の更新のみを並行実行
    const updatePromises = Array.from(latestUpdates.values()).map((task) =>
      this.execute(task).catch((error) => {
        this.logger.error(
          'Failed to update message in batch',
          error instanceof Error ? error : new Error(String(error)),
          {
            operation: 'batch-message-update',
            scheduleId: task.scheduleId,
            messageId: task.messageId,
          }
        );
      })
    );

    await Promise.allSettled(updatePromises);
  }
}

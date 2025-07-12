/**
 * メッセージ更新処理ユースケース
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
      const embed = this.messageFormatter.createScheduleEmbed(summaryResult.summary, false);
      const components = this.messageFormatter.createScheduleComponents(
        summaryResult.summary,
        false
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
   */
  async executeBatch(tasks: MessageUpdateTask[]): Promise<void> {
    // 同じメッセージに対する複数の更新をまとめる
    const latestUpdates = new Map<string, MessageUpdateTask>();

    for (const task of tasks) {
      const key = `${task.scheduleId}:${task.messageId}`;
      const existing = latestUpdates.get(key);

      // 最新の更新で上書き
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

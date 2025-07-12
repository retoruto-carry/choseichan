import type { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import type { Env } from '../../infrastructure/types/discord';
import type { IDiscordApiPort } from '../ports/DiscordApiPort';
import type { ILogger } from '../ports/LoggerPort';
import type { IMessageFormatterPort } from '../ports/MessageFormatterPort';

/**
 * スケジュールのメイン画面を更新する共通関数 - Clean Architecture版
 * @param scheduleId スケジュールID
 * @param messageId 更新対象のメッセージID（省略時はschedule.messageIdを使用）
 * @param interactionToken インタラクショントークン
 * @param container DependencyContainer インスタンス
 * @param env 環境変数
 * @param guildId ギルドID
 * @param discordApi Discord API アダプター
 * @param messageFormatter メッセージフォーマッター
 * @param logger ログアダプター
 * @returns 更新が成功したかどうか
 */
export async function updateScheduleMainMessage(
  scheduleId: string,
  messageId: string | undefined,
  interactionToken: string,
  container: DependencyContainer,
  env: Env,
  guildId: string = 'default',
  discordApi: IDiscordApiPort,
  messageFormatter: IMessageFormatterPort,
  logger: ILogger
): Promise<boolean> {
  try {
    // 最新のスケジュール情報を取得
    const scheduleResult = await container.applicationServices.getScheduleUseCase.execute(
      scheduleId,
      guildId
    );
    if (!scheduleResult.success || !scheduleResult.schedule) {
      logger.error(`Schedule not found for ID: ${scheduleId}`);
      return false;
    }
    const schedule = scheduleResult.schedule;

    // メッセージIDを決定
    const targetMessageId = messageId || schedule.messageId;
    if (!targetMessageId) {
      logger.error(`No message ID available for schedule: ${scheduleId}`);
      return false;
    }

    // スケジュールの集計情報を取得
    const summaryResult = await container.applicationServices.getScheduleSummaryUseCase.execute(
      scheduleId,
      guildId
    );
    if (!summaryResult.success || !summaryResult.summary) {
      logger.error(`Failed to get schedule summary for ID: ${scheduleId}`);
      return false;
    }
    const summary = summaryResult.summary;

    // 現在の状態（showDetails）を維持したいが、これは別途管理が必要
    // とりあえずシンプルな表示で更新
    const { embed, components } = messageFormatter.formatScheduleMessage(summary, false);

    // Discord APIを使ってメッセージを更新
    if (!env.DISCORD_APPLICATION_ID) {
      logger.error('DISCORD_APPLICATION_ID is not set');
      return false;
    }

    await discordApi.updateMessage(
      schedule.channelId,
      targetMessageId,
      {
        embeds: [embed],
        components,
      },
      interactionToken
    );

    return true;
  } catch (error) {
    logger.error(
      'Error updating schedule main message',
      error instanceof Error ? error : new Error(String(error))
    );
    return false;
  }
}

/**
 * スケジュールのメッセージIDを保存
 * @param scheduleId スケジュールID
 * @param messageId メッセージID
 * @param container DependencyContainer インスタンス
 * @param guildId ギルドID
 */
export async function saveScheduleMessageId(
  scheduleId: string,
  messageId: string,
  container: DependencyContainer,
  guildId: string = 'default'
): Promise<void> {
  const scheduleResult = await container.applicationServices.getScheduleUseCase.execute(
    scheduleId,
    guildId
  );
  if (!scheduleResult.success || !scheduleResult.schedule) {
    console.error(`Schedule not found: ${scheduleId}`);
    return;
  }

  if (scheduleResult.schedule.messageId !== messageId) {
    // Use UpdateScheduleUseCase to update the message ID
    await container.applicationServices.updateScheduleUseCase.execute({
      scheduleId,
      guildId,
      editorUserId: 'system', // System update
      messageId,
    });
  }
}

import { Env } from '../../infrastructure/types/discord';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { updateOriginalMessage } from '../../presentation/utils/discord';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../../presentation/utils/embeds';

/**
 * スケジュールのメイン画面を更新する共通関数 - Clean Architecture版
 * @param scheduleId スケジュールID
 * @param messageId 更新対象のメッセージID（省略時はschedule.messageIdを使用）
 * @param interactionToken インタラクショントークン
 * @param container DependencyContainer インスタンス
 * @param env 環境変数
 * @param guildId ギルドID
 * @returns 更新が成功したかどうか
 */
export async function updateScheduleMainMessage(
  scheduleId: string,
  messageId: string | undefined,
  interactionToken: string,
  container: DependencyContainer,
  env: Env,
  guildId: string = 'default'
): Promise<boolean> {
  try {
    // 最新のスケジュール情報を取得
    const scheduleResult = await container.getScheduleUseCase.execute(scheduleId, guildId);
    if (!scheduleResult.success || !scheduleResult.schedule) {
      console.error(`Schedule not found for ID: ${scheduleId}`);
      return false;
    }
    const schedule = scheduleResult.schedule;

    // メッセージIDを決定
    const targetMessageId = messageId || schedule.messageId;
    if (!targetMessageId) {
      console.error(`No message ID available for schedule: ${scheduleId}`);
      return false;
    }

    // スケジュールの集計情報を取得
    const summaryResult = await container.getScheduleSummaryUseCase.execute(scheduleId, guildId);
    if (!summaryResult.success || !summaryResult.summary) {
      console.error(`Failed to get schedule summary for ID: ${scheduleId}`);
      return false;
    }
    const summary = summaryResult.summary;

    // 現在の状態（showDetails）を維持したいが、これは別途管理が必要
    // とりあえずシンプルな表示で更新
    const embed = createScheduleEmbedWithTable(summary, false);
    const components = createSimpleScheduleComponents(schedule, false);

    // Discord APIを使ってメッセージを更新
    if (!env.DISCORD_APPLICATION_ID) {
      console.error('DISCORD_APPLICATION_ID is not set');
      return false;
    }

    await updateOriginalMessage(
      env.DISCORD_APPLICATION_ID,
      interactionToken,
      {
        embeds: [embed],
        components
      },
      targetMessageId
    );

    return true;
  } catch (error) {
    console.error('Error updating schedule main message:', error);
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
  const scheduleResult = await container.getScheduleUseCase.execute(scheduleId, guildId);
  if (!scheduleResult.success || !scheduleResult.schedule) {
    console.error(`Schedule not found: ${scheduleId}`);
    return;
  }

  if (scheduleResult.schedule.messageId !== messageId) {
    // Use UpdateScheduleUseCase to update the message ID
    await container.updateScheduleUseCase.execute({
      scheduleId,
      guildId,
      editorUserId: 'system', // System update
      messageId
    });
  }
}
import type { IDiscordApiPort } from '../ports/DiscordApiPort';
import type { ILogger } from '../ports/LoggerPort';
import type { IMessageFormatterPort } from '../ports/MessageFormatterPort';
import type { GetScheduleSummaryUseCase } from '../usecases/schedule/GetScheduleSummaryUseCase';
import type { GetScheduleUseCase } from '../usecases/schedule/GetScheduleUseCase';
import type { UpdateScheduleUseCase } from '../usecases/schedule/UpdateScheduleUseCase';

/**
 * スケジュール更新サービス
 */
export class ScheduleUpdaterService {
  constructor(
    private readonly getScheduleUseCase: GetScheduleUseCase,
    private readonly getScheduleSummaryUseCase: GetScheduleSummaryUseCase,
    private readonly updateScheduleUseCase: UpdateScheduleUseCase,
    private readonly discordApi: IDiscordApiPort,
    private readonly messageFormatter: IMessageFormatterPort,
    private readonly logger: ILogger
  ) {}

  /**
   * スケジュールのメイン画面を更新
   * @param scheduleId スケジュールID
   * @param messageId 更新対象のメッセージID（省略時はschedule.messageIdを使用）
   * @param interactionToken インタラクショントークン
   * @param guildId ギルドID
   * @returns 更新が成功したかどうか
   */
  async updateScheduleMainMessage(
    scheduleId: string,
    messageId: string | undefined,
    interactionToken: string,
    guildId: string = 'default'
  ): Promise<boolean> {
    try {
      // 最新のスケジュール情報を取得
      const scheduleResult = await this.getScheduleUseCase.execute(scheduleId, guildId);
      if (!scheduleResult.success || !scheduleResult.schedule) {
        this.logger.error(`Schedule not found for ID: ${scheduleId}`);
        return false;
      }
      const schedule = scheduleResult.schedule;

      // メッセージIDを決定
      const targetMessageId = messageId || schedule.messageId;
      if (!targetMessageId) {
        this.logger.error(`No message ID available for schedule: ${scheduleId}`);
        return false;
      }

      // スケジュールの集計情報を取得
      const summaryResult = await this.getScheduleSummaryUseCase.execute(scheduleId, guildId);
      if (!summaryResult.success || !summaryResult.summary) {
        this.logger.error(`Failed to get schedule summary for ID: ${scheduleId}`);
        return false;
      }
      const summary = summaryResult.summary;

      // 現在の状態（showDetails）を維持したいが、これは別途管理が必要
      // とりあえずシンプルな表示で更新
      const { embed, components } = this.messageFormatter.formatScheduleMessage(summary, false);

      // Discord APIを使ってメッセージを更新
      await this.discordApi.updateMessage({
        channelId: schedule.channelId,
        messageId: targetMessageId,
        message: {
          embeds: [embed],
          components,
        },
        botToken: interactionToken,
      });

      return true;
    } catch (error) {
      this.logger.error(
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
   * @param guildId ギルドID
   */
  async saveScheduleMessageId(
    scheduleId: string,
    messageId: string,
    guildId: string = 'default'
  ): Promise<void> {
    const scheduleResult = await this.getScheduleUseCase.execute(scheduleId, guildId);
    if (!scheduleResult.success || !scheduleResult.schedule) {
      this.logger.error(`Schedule not found: ${scheduleId}`);
      return;
    }

    if (scheduleResult.schedule.messageId !== messageId) {
      // Use UpdateScheduleUseCase to update the message ID
      await this.updateScheduleUseCase.execute({
        scheduleId,
        guildId,
        editorUserId: 'system', // System update
        messageId,
      });
    }
  }
}

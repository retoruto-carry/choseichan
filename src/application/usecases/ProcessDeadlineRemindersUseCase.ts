/**
 * Process Deadline Reminders Use Case
 *
 * 締切リマインダー処理のユースケース
 */

import type { DeadlineReminderQueuePort } from '../ports/DeadlineReminderQueuePort';
// Rate limiting removed - using Cloudflare Queues for scheduling instead
import type { IEnvironmentPort } from '../ports/EnvironmentPort';
import type { ILogger } from '../ports/LoggerPort';
import type { NotificationService } from '../services/NotificationService';
import type { ReminderStateService } from '../services/ReminderStateService';
import type { DeadlineCheckResult, ReminderInfo } from '../types/ReminderTypes';
import type { CloseScheduleUseCase } from './schedule/CloseScheduleUseCase';
import type { DeadlineReminderUseCase } from './schedule/DeadlineReminderUseCase';
import type { GetScheduleSummaryUseCase } from './schedule/GetScheduleSummaryUseCase';
import type { GetScheduleUseCase } from './schedule/GetScheduleUseCase';

export class ProcessDeadlineRemindersUseCase {
  constructor(
    private readonly logger: ILogger,
    private readonly deadlineReminderUseCase: DeadlineReminderUseCase,
    private readonly getScheduleUseCase: GetScheduleUseCase,
    private readonly getScheduleSummaryUseCase: GetScheduleSummaryUseCase,
    private readonly reminderStateService: ReminderStateService,
    private readonly closeScheduleUseCase: CloseScheduleUseCase,
    private readonly notificationService: NotificationService,
    private readonly env: IEnvironmentPort,
    private readonly deadlineReminderQueue?: DeadlineReminderQueuePort
  ) {}

  async execute(): Promise<void> {
    const discordToken = this.env.get('DISCORD_TOKEN');
    const discordAppId = this.env.get('DISCORD_APPLICATION_ID');

    if (!discordToken || !discordAppId) {
      this.logger.error(
        'Missing Discord credentials for notifications',
        new Error('DISCORD_TOKEN or DISCORD_APPLICATION_ID is missing')
      );
      return;
    }

    const deadlineCheckResult = await this.checkDeadlines();
    const { upcomingReminders, justClosed } = deadlineCheckResult;

    this.logger.info(
      `Processing ${upcomingReminders.length} upcoming reminders and ${justClosed.length} closure notifications`
    );

    // Rate limiting configuration
    const batchSizeEnv = this.env.getOptional('REMINDER_BATCH_SIZE');
    const reminderBatchSize = batchSizeEnv ? parseInt(batchSizeEnv) : 20;
    const batchDelayEnv = this.env.getOptional('REMINDER_BATCH_DELAY');
    const reminderBatchDelay = batchDelayEnv ? parseInt(batchDelayEnv) : 100;

    // Send reminders for upcoming deadlines
    await this.processReminders({
      reminders: upcomingReminders,
      batchSize: reminderBatchSize,
      batchDelay: reminderBatchDelay,
    });

    // Send closure notifications
    await this.processClosures(justClosed);
  }

  private async checkDeadlines(): Promise<DeadlineCheckResult> {
    const result = await this.deadlineReminderUseCase.checkDeadlines();

    if (!result.success || !result.result) {
      this.logger.error(
        'Failed to check deadlines:',
        new Error(`Error: ${result.errors?.join(', ') || 'Unknown error'}`)
      );
      return {
        upcomingReminders: [],
        justClosed: [],
      };
    }

    this.logger.info(
      `Found ${result.result.upcomingReminders.length} upcoming reminders and ${result.result.justClosed.length} schedules to close`
    );

    return {
      upcomingReminders: result.result.upcomingReminders,
      justClosed: result.result.justClosed,
    };
  }

  private async processReminders({
    reminders,
  }: {
    reminders: ReminderInfo[];
    batchSize: number;
    batchDelay: number;
  }): Promise<void> {
    if (!this.deadlineReminderQueue) {
      // Fallback: 直接処理（テスト環境など）
      await this.processRemindersDirectly(reminders);
      return;
    }

    // Queueにタスクを送信
    const tasks = reminders.map((reminderInfo) => ({
      type: 'send_reminder' as const,
      scheduleId: reminderInfo.scheduleId,
      guildId: reminderInfo.guildId,
      customMessage: reminderInfo.message,
    }));

    await this.deadlineReminderQueue.sendBatch(tasks);

    // リマインダー送信済みフラグの更新
    await Promise.allSettled(
      reminders.map((reminderInfo) =>
        this.reminderStateService.markReminderSent({
          scheduleId: reminderInfo.scheduleId,
          guildId: reminderInfo.guildId,
          reminderType: reminderInfo.reminderType,
        })
      )
    );

    this.logger.info(`Queued ${tasks.length} reminder tasks`);
  }

  private async processRemindersDirectly(reminders: ReminderInfo[]): Promise<void> {
    // 既存の直接処理ロジック（テスト用）
    const results = await Promise.allSettled(
      reminders.map(async (reminderInfo) => {
        const { scheduleId, guildId, reminderType, message } = reminderInfo;

        try {
          const scheduleResult = await this.getScheduleUseCase.execute(scheduleId, guildId);

          if (!scheduleResult?.success || !scheduleResult?.schedule) {
            throw new Error(`Failed to get schedule ${scheduleId}`);
          }

          await this.notificationService.sendDeadlineReminder(scheduleResult.schedule, message);

          await this.reminderStateService.markReminderSent({
            scheduleId,
            guildId,
            reminderType,
          });

          this.logger.info(`Sent ${reminderType} deadline reminder for schedule ${scheduleId}`);
          return { success: true, scheduleId };
        } catch (error) {
          this.logger.error(
            `Failed to send reminder for schedule ${scheduleId}`,
            error instanceof Error ? error : new Error(String(error))
          );
          return { success: false, scheduleId, error };
        }
      })
    );

    const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    this.logger.info(
      `Reminders completed: ${successful} successful, ${failed} failed out of ${results.length} total`
    );
  }

  private async processClosures(
    closures: Array<{ scheduleId: string; guildId: string }>
  ): Promise<void> {
    if (!this.deadlineReminderQueue) {
      // Fallback: 直接処理（テスト環境など）
      await this.processClosuresDirectly(closures);
      return;
    }

    // Queueにタスクを送信
    const closeTasks = closures.map(({ scheduleId, guildId }) => ({
      type: 'close_schedule' as const,
      scheduleId,
      guildId,
    }));

    const summaryTasks = closures.map(({ scheduleId, guildId }) => ({
      type: 'send_summary' as const,
      scheduleId,
      guildId,
    }));

    // 締切処理とサマリー送信を別々にキューイング
    await this.deadlineReminderQueue.sendBatch([...closeTasks, ...summaryTasks]);

    this.logger.info(
      `Queued ${closeTasks.length} closure tasks and ${summaryTasks.length} summary tasks`
    );
  }

  private async processClosuresDirectly(
    closures: Array<{ scheduleId: string; guildId: string }>
  ): Promise<void> {
    // 既存の直接処理ロジック（テスト用）
    const results = await Promise.allSettled(
      closures.map(async (closureInfo) => {
        try {
          const { scheduleId, guildId } = closureInfo;

          const closeResult = await this.closeScheduleUseCase.execute({
            scheduleId,
            guildId,
            editorUserId: 'system',
          });

          if (!closeResult.success) {
            this.logger.error(
              `Failed to close schedule ${scheduleId}`,
              new Error(`Close failed: ${closeResult.errors?.join(', ') || 'Unknown error'}`)
            );
            return { success: false, scheduleId };
          }

          // メインメッセージを更新（締切済み状態に）
          await this.notificationService.updateMainMessage(scheduleId, guildId);

          const scheduleResult = await this.getScheduleUseCase.execute(scheduleId, guildId);
          if (!scheduleResult.success || !scheduleResult.schedule) {
            this.logger.error(
              `Failed to get schedule ${scheduleId} for notification`,
              new Error(
                `Get schedule failed: ${scheduleResult.errors?.join(', ') || 'Unknown error'}`
              )
            );
            return { success: false, scheduleId };
          }

          await this.notificationService.sendSummaryMessage(scheduleId, guildId);
          // 一時的にPR通知機能をオフ
          // this.notificationService.sendPRMessage(scheduleResult.schedule);

          this.logger.info(`Sent closure notification for schedule ${scheduleId}`);
          return { success: true, scheduleId };
        } catch (error) {
          this.logger.error(
            `Failed to send closure notification for schedule ${closureInfo.scheduleId}`,
            error instanceof Error ? error : new Error(String(error))
          );
          return { success: false, scheduleId: closureInfo.scheduleId, error };
        }
      })
    );

    const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    this.logger.info(
      `Closures completed: ${successful} successful, ${failed} failed out of ${results.length} total`
    );
  }
}

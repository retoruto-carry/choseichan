/**
 * Process Deadline Reminders Use Case
 *
 * 締切リマインダー処理のユースケース
 */

import { processBatches } from '../../infrastructure/utils/rate-limiter';
import type { IEnvironmentPort } from '../ports/EnvironmentPort';
import type { ILogger } from '../ports/LoggerPort';
import type { NotificationService } from '../services/NotificationService';
import type { DeadlineCheckResult, ReminderInfo } from '../types/ReminderTypes';
import type { CloseScheduleUseCase } from './schedule/CloseScheduleUseCase';
import type { DeadlineReminderUseCase } from './schedule/DeadlineReminderUseCase';
import type { GetScheduleSummaryUseCase } from './schedule/GetScheduleSummaryUseCase';
import type { GetScheduleUseCase } from './schedule/GetScheduleUseCase';
import type { ProcessReminderUseCase } from './schedule/ProcessReminderUseCase';

export class ProcessDeadlineRemindersUseCase {
  constructor(
    private readonly logger: ILogger,
    private readonly deadlineReminderUseCase: DeadlineReminderUseCase,
    private readonly getScheduleUseCase: GetScheduleUseCase,
    private readonly getScheduleSummaryUseCase: GetScheduleSummaryUseCase,
    private readonly processReminderUseCase: ProcessReminderUseCase,
    private readonly closeScheduleUseCase: CloseScheduleUseCase,
    private readonly notificationService: NotificationService,
    private readonly env: IEnvironmentPort
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
    await this.processReminders(upcomingReminders, reminderBatchSize, reminderBatchDelay);

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

  private async processReminders(
    reminders: ReminderInfo[],
    batchSize: number,
    batchDelay: number
  ): Promise<void> {
    const result = await processBatches(
      reminders,
      async (reminderInfo) => {
        const { scheduleId, guildId, reminderType, message } = reminderInfo;

        // Get schedule and summary in parallel for better performance
        const [scheduleResult, _summaryResult] = await Promise.allSettled([
          this.getScheduleUseCase.execute(scheduleId, guildId),
          this.getScheduleSummaryUseCase.execute(scheduleId, guildId),
        ]);

        // Handle schedule result
        if (scheduleResult.status === 'rejected') {
          throw new Error(`Failed to get schedule ${scheduleId}: ${scheduleResult.reason}`);
        }

        if (!scheduleResult.value?.success || !scheduleResult.value?.schedule) {
          throw new Error(`Failed to get schedule ${scheduleId}`);
        }

        // Send reminder (summary is optional)
        await this.notificationService.sendDeadlineReminder(scheduleResult.value.schedule, message);

        // Update reminder status
        await this.processReminderUseCase.markReminderSent({
          scheduleId,
          guildId,
          reminderType,
        });

        this.logger.info(`Sent ${reminderType} deadline reminder for schedule ${scheduleId}`);
      },
      {
        batchSize,
        delayBetweenBatches: batchDelay,
        maxRetries: 2,
        onProgress: (processed, total, errors) => {
          this.logger.info(`Reminder progress: ${processed}/${total} processed, ${errors} errors`);
        },
        onError: (item, error, retryCount) => {
          this.logger.error(
            `Failed to send reminder for schedule ${item.scheduleId} (retry ${retryCount})`,
            error instanceof Error ? error : new Error(String(error))
          );
          return retryCount < 2; // Retry up to 2 times
        },
      }
    );

    this.logger.info(
      `Reminders completed: ${result.processed} processed, ${result.retried} retried, ${result.errors.length} final errors`
    );
  }

  private async processClosures(
    closures: Array<{ scheduleId: string; guildId: string }>
  ): Promise<void> {
    await processBatches(
      closures,
      async (closureInfo) => {
        try {
          const { scheduleId, guildId } = closureInfo;

          // Close schedule
          const closeResult = await this.closeScheduleUseCase.execute({
            scheduleId,
            guildId,
            editorUserId: 'system', // System closure
          });

          if (!closeResult.success) {
            this.logger.error(
              `Failed to close schedule ${scheduleId}`,
              new Error(`Close failed: ${closeResult.errors?.join(', ') || 'Unknown error'}`)
            );
            return;
          }

          // Get schedule for PR message
          const scheduleResult = await this.getScheduleUseCase.execute(scheduleId, guildId);
          if (!scheduleResult.success || !scheduleResult.schedule) {
            this.logger.error(
              `Failed to get schedule ${scheduleId} for notification`,
              new Error(
                `Get schedule failed: ${scheduleResult.errors?.join(', ') || 'Unknown error'}`
              )
            );
            return;
          }

          // Convert to format expected by notification service
          // Send summary and PR message in sequence
          await this.notificationService.sendSummaryMessage(scheduleId, guildId);
          await this.notificationService.sendPRMessage(scheduleResult.schedule);

          this.logger.info(`Sent closure notification for schedule ${scheduleId}`);
        } catch (error) {
          this.logger.error(
            `Failed to send closure notification for schedule ${closureInfo.scheduleId}`,
            error instanceof Error ? error : new Error(String(error))
          );
        }
      },
      {
        batchSize: 15,
        delayBetweenBatches: 100,
      }
    );
  }
}

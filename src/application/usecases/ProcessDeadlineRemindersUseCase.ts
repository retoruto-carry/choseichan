/**
 * Process Deadline Reminders Use Case
 * 
 * 締切リマインダー処理のユースケース
 */

import { Env } from '../../types/discord';
import { GetScheduleUseCase } from './schedule/GetScheduleUseCase';
import { GetScheduleSummaryUseCase } from './schedule/GetScheduleSummaryUseCase';
import { ProcessReminderUseCase } from './schedule/ProcessReminderUseCase';
import { CloseScheduleUseCase } from './schedule/CloseScheduleUseCase';
import { DeadlineReminderUseCase } from './schedule/DeadlineReminderUseCase';
import { NotificationService } from '../services/NotificationService';
import { ReminderInfo, DeadlineCheckResult } from '../services/ReminderService';
import { processBatches } from '../../utils/rate-limiter';

export class ProcessDeadlineRemindersUseCase {
  constructor(
    private deadlineReminderUseCase: DeadlineReminderUseCase,
    private getScheduleUseCase: GetScheduleUseCase,
    private getScheduleSummaryUseCase: GetScheduleSummaryUseCase,
    private processReminderUseCase: ProcessReminderUseCase,
    private closeScheduleUseCase: CloseScheduleUseCase,
    private notificationService: NotificationService,
    private env: Env
  ) {}

  async execute(): Promise<void> {
    if (!this.env.DISCORD_TOKEN || !this.env.DISCORD_APPLICATION_ID) {
      console.error('Missing Discord credentials for notifications');
      return;
    }

    const deadlineCheckResult = await this.checkDeadlines();
    const { upcomingReminders, justClosed } = deadlineCheckResult;

    console.log(`Processing ${upcomingReminders.length} upcoming reminders and ${justClosed.length} closure notifications`);

    // Rate limiting configuration
    const reminderBatchSize = this.env.REMINDER_BATCH_SIZE ? parseInt(this.env.REMINDER_BATCH_SIZE) : 20;
    const reminderBatchDelay = this.env.REMINDER_BATCH_DELAY ? parseInt(this.env.REMINDER_BATCH_DELAY) : 100;

    // Send reminders for upcoming deadlines
    await this.processReminders(upcomingReminders, reminderBatchSize, reminderBatchDelay);

    // Send closure notifications
    await this.processClosures(justClosed);
  }

  private async checkDeadlines(): Promise<DeadlineCheckResult> {
    const result = await this.deadlineReminderUseCase.checkDeadlines();
    
    if (!result.success || !result.result) {
      console.error('Failed to check deadlines:', result.errors);
      return {
        upcomingReminders: [],
        justClosed: []
      };
    }

    console.log(`Found ${result.result.upcomingReminders.length} upcoming reminders and ${result.result.justClosed.length} schedules to close`);

    return {
      upcomingReminders: result.result.upcomingReminders,
      justClosed: result.result.justClosed
    };
  }

  private async processReminders(
    reminders: ReminderInfo[],
    batchSize: number,
    batchDelay: number
  ): Promise<void> {
    await processBatches(reminders, async (reminderInfo) => {
      try {
        const { scheduleId, guildId, reminderType, message } = reminderInfo;
        
        // Get schedule
        const scheduleResult = await this.getScheduleUseCase.execute(scheduleId, guildId);
        if (!scheduleResult.success || !scheduleResult.schedule) {
          console.error(`Failed to get schedule ${scheduleId}:`, scheduleResult.errors);
          return;
        }

        // Get total responses
        const summaryResult = await this.getScheduleSummaryUseCase.execute(scheduleId, guildId);
        let totalResponses = 0;
        if (summaryResult.success && summaryResult.summary) {
          totalResponses = summaryResult.summary.totalResponseUsers;
        }

        // Pass schedule as-is (ScheduleResponse)
        await this.notificationService.sendDeadlineReminder(scheduleResult.schedule, message);
        
        // Update reminder status
        await this.processReminderUseCase.markReminderSent({
          scheduleId,
          guildId,
          reminderType
        });
        
        console.log(`Sent ${reminderType} deadline reminder for schedule ${scheduleId}`);
      } catch (error) {
        console.error(`Failed to send reminder for schedule ${reminderInfo.scheduleId}:`, error);
      }
    }, {
      batchSize,
      delayBetweenBatches: batchDelay
    });
  }

  private async processClosures(
    closures: Array<{scheduleId: string; guildId: string}>
  ): Promise<void> {
    await processBatches(closures, async (closureInfo) => {
      try {
        const { scheduleId, guildId } = closureInfo;
        
        // Close schedule
        const closeResult = await this.closeScheduleUseCase.execute({
          scheduleId,
          guildId,
          editorUserId: 'system' // System closure
        });
        
        if (!closeResult.success) {
          console.error(`Failed to close schedule ${scheduleId}:`, closeResult.errors);
          return;
        }

        // Get schedule for PR message
        const scheduleResult = await this.getScheduleUseCase.execute(scheduleId, guildId);
        if (!scheduleResult.success || !scheduleResult.schedule) {
          console.error(`Failed to get schedule ${scheduleId} for notification:`, scheduleResult.errors);
          return;
        }

        // Convert to format expected by notification service
        // Send summary and PR message in sequence
        await this.notificationService.sendSummaryMessage(scheduleId, guildId);
        await this.notificationService.sendPRMessage(scheduleResult.schedule);
        
        console.log(`Sent closure notification for schedule ${scheduleId}`);
      } catch (error) {
        console.error(`Failed to send closure notification for schedule ${closureInfo.scheduleId}:`, error);
      }
    }, {
      batchSize: 15,
      delayBetweenBatches: 100
    });
  }
}
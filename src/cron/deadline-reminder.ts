import { Env } from '../types/discord';
import { DependencyContainer } from '../infrastructure/factories/DependencyContainer';
import { NotificationService } from '../services/notification';
import { processBatches } from '../utils/rate-limiter';

interface LegacyReminderInfo {
  scheduleId: string;
  guildId: string;
  reminderType: string;
  message: string;
}

interface LegacyDeadlineCheckResult {
  upcomingReminders: LegacyReminderInfo[];
  justClosed: Array<{scheduleId: string; guildId: string}>;
}

// デフォルトのリマインダータイミング定義
const DEFAULT_REMINDER_TIMINGS = [
  { type: '3d', hours: 72, message: '締切まで3日' },
  { type: '1d', hours: 24, message: '締切まで1日' },
  { type: '8h', hours: 8, message: '締切まで8時間' }
];

// 古いリマインダーをスキップする閾値
// リマインダータイプに応じて動的に決定
function getOldReminderThreshold(timing: string): number {
  const match = timing.match(/^(\d+)([dhm])$/);
  if (!match) return 8 * 60 * 60 * 1000; // デフォルト8時間
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  // 各単位に応じた許容遅延時間
  switch (unit) {
    case 'd':
      // 日単位: 8時間の遅延を許容
      return 8 * 60 * 60 * 1000;
    case 'h':
      // 時間単位: 2時間または設定値の25%のうち大きい方
      return Math.max(2 * 60 * 60 * 1000, value * 0.25 * 60 * 60 * 1000);
    case 'm':
      // 分単位: 30分または設定値の50%のうち大きい方
      return Math.max(30 * 60 * 1000, value * 0.5 * 60 * 1000);
    default:
      return 8 * 60 * 60 * 1000;
  }
}

// カスタムタイミングの文字列（例: '3d', '8h', '30m'）を時間に変換
function parseTimingToHours(timing: string): number | null {
  const match = timing.match(/^(\d+)([dhm])$/);
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 'd': return value * 24;
    case 'h': return value;
    case 'm': return value / 60;
    default: return null;
  }
}

// タイミングに基づいたメッセージを生成
function getTimingMessage(timing: string): string {
  const match = timing.match(/^(\d+)([dhm])$/);
  if (!match) return `締切まで${timing}`;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 'd': return `締切まで${value}日`;
    case 'h': return `締切まで${value}時間`;
    case 'm': return `締切まで${value}分`;
    default: return `締切まで${timing}`;
  }
}

export async function checkDeadlines(env: Env): Promise<LegacyDeadlineCheckResult> {
  const container = new DependencyContainer(env);
  const deadlineReminderUseCase = container.deadlineReminderUseCase;
  
  const result = await deadlineReminderUseCase.checkDeadlines();
  
  if (!result.success || !result.result) {
    console.error('Failed to check deadlines:', result.errors);
    return {
      upcomingReminders: [],
      justClosed: []
    };
  }

  console.log(`Found ${result.result.upcomingReminders.length} upcoming reminders and ${result.result.justClosed.length} schedules to close`);

  // Convert to legacy format for backward compatibility
  const legacyReminders = result.result.upcomingReminders.map(r => ({
    scheduleId: r.scheduleId,
    guildId: r.guildId,
    reminderType: r.reminderType,
    message: r.message
  }));

  return {
    upcomingReminders: legacyReminders,
    justClosed: result.result.justClosed
  };
}

export async function sendDeadlineReminders(env: Env): Promise<void> {
  if (!env.DISCORD_TOKEN || !env.DISCORD_APPLICATION_ID) {
    console.error('Missing Discord credentials for notifications');
    return;
  }

  const container = new DependencyContainer(env);
  const getScheduleUseCase = container.getScheduleUseCase;
  const getScheduleSummaryUseCase = container.getScheduleSummaryUseCase;
  const processReminderUseCase = container.processReminderUseCase;
  const closeScheduleUseCase = container.closeScheduleUseCase;
  
  // Legacy NotificationService - this will eventually be refactored to clean architecture too  
  // For now, we'll use StorageServiceV2 as a temporary bridge
  const { StorageServiceV2 } = await import('../services/storage-v2');
  const legacyStorage = new StorageServiceV2(env);
  const notificationService = new NotificationService(
    legacyStorage,
    env.DISCORD_TOKEN,
    env.DISCORD_APPLICATION_ID
  );

  const { upcomingReminders, justClosed } = await checkDeadlines(env);

  console.log(`Processing ${upcomingReminders.length} upcoming reminders and ${justClosed.length} closure notifications`);

  // Rate limiting configuration
  const reminderBatchSize = env.REMINDER_BATCH_SIZE ? parseInt(env.REMINDER_BATCH_SIZE) : 20;
  const reminderBatchDelay = env.REMINDER_BATCH_DELAY ? parseInt(env.REMINDER_BATCH_DELAY) : 100;

  // Send reminders for upcoming deadlines with rate limiting
  await processBatches(upcomingReminders, async (reminderInfo) => {
    try {
      const { scheduleId, guildId, reminderType, message } = reminderInfo;
      
      // Get schedule and summary using clean architecture
      const scheduleResult = await getScheduleUseCase.execute(scheduleId, guildId);
      if (!scheduleResult.success || !scheduleResult.schedule) {
        console.error(`Failed to get schedule ${scheduleId}:`, scheduleResult.errors);
        return;
      }

      const summaryResult = await getScheduleSummaryUseCase.execute(scheduleId, guildId);
      let totalResponses = 0;
      if (summaryResult.success && summaryResult.summary) {
        totalResponses = summaryResult.summary.totalResponseUsers;
      }

      // Convert to legacy format for notification service
      const legacySchedule = {
        ...scheduleResult.schedule,
        deadline: scheduleResult.schedule.deadline ? new Date(scheduleResult.schedule.deadline) : undefined,
        createdAt: new Date(scheduleResult.schedule.createdAt),
        updatedAt: new Date(scheduleResult.schedule.updatedAt),
        totalResponses
      };
      
      await notificationService.sendDeadlineReminder(legacySchedule, message);
      
      // Update reminder status using clean architecture
      await processReminderUseCase.markReminderSent({
        scheduleId,
        guildId,
        reminderType
      });
      
      console.log(`Sent ${reminderType} deadline reminder for schedule ${scheduleId}`);
    } catch (error) {
      console.error(`Failed to send reminder for schedule ${reminderInfo.scheduleId}:`, error);
    }
  }, {
    batchSize: reminderBatchSize,
    delayBetweenBatches: reminderBatchDelay
  });

  // Send closure notifications with rate limiting
  await processBatches(justClosed, async (closureInfo) => {
    try {
      const { scheduleId, guildId } = closureInfo;
      
      // Close schedule using clean architecture
      const closeResult = await closeScheduleUseCase.execute({
        scheduleId,
        guildId,
        editorUserId: 'system' // System closure
      });
      
      if (!closeResult.success) {
        console.error(`Failed to close schedule ${scheduleId}:`, closeResult.errors);
        return;
      }

      // Get schedule for notification
      const scheduleResult = await getScheduleUseCase.execute(scheduleId, guildId);
      if (!scheduleResult.success || !scheduleResult.schedule) {
        console.error(`Failed to get schedule ${scheduleId} for notification:`, scheduleResult.errors);
        return;
      }

      // Convert to legacy format for notification service
      const legacyScheduleForPR = {
        ...scheduleResult.schedule,
        deadline: scheduleResult.schedule.deadline ? new Date(scheduleResult.schedule.deadline) : undefined,
        createdAt: new Date(scheduleResult.schedule.createdAt),
        updatedAt: new Date(scheduleResult.schedule.updatedAt)
      };

      // Send summary and PR message in sequence
      await notificationService.sendSummaryMessage(scheduleId, guildId);
      await notificationService.sendPRMessage(legacyScheduleForPR);
      
      console.log(`Sent closure notification for schedule ${scheduleId}`);
    } catch (error) {
      console.error(`Failed to send closure notification for schedule ${closureInfo.scheduleId}:`, error);
    }
  }, {
    batchSize: 15,
    delayBetweenBatches: 100
  });
}
import { Env } from '../types/discord';
import { StorageServiceV2 as StorageService } from '../services/storage-v2';
import { NotificationService } from '../services/notification';
import { Schedule } from '../types/schedule';
import { processBatches } from '../utils/rate-limiter';

interface ReminderInfo {
  schedule: Schedule;
  reminderType: string; // '3d', '1d', '8h', '1h'
  message: string; // カスタムメッセージ
}

interface DeadlineCheckResult {
  upcomingReminders: ReminderInfo[];  // 送信すべきリマインダー
  justClosed: Schedule[]; // 締切を過ぎたがまだ開いているスケジュール（自動クローズ対象）
}

// デフォルトのリマインダータイミング定義
const DEFAULT_REMINDER_TIMINGS = [
  { type: '3d', hours: 72, message: '締切まで3日' },
  { type: '1d', hours: 24, message: '締切まで1日' },
  { type: '8h', hours: 8, message: '締切まで8時間' }
];

// 古いリマインダーをスキップする閾値（8時間）
// この時間以上遅れているリマインダーは送信しない
const OLD_REMINDER_THRESHOLD_MS = 8 * 60 * 60 * 1000;

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

export async function checkDeadlines(env: Env): Promise<DeadlineCheckResult> {
  const storage = new StorageService(env.SCHEDULES, env.RESPONSES);
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 過去1週間まで確認
  
  const result: DeadlineCheckResult = {
    upcomingReminders: [],
    justClosed: []
  };

  // Scan global deadline index for schedules within past week to 3 days from now
  // 過去の締切も含めて広範囲をスキャンして、まだ閉じられていないものを見つける
  const startTime = Math.floor(oneWeekAgo.getTime() / 1000); // Convert to seconds for key comparison
  const endTime = Math.floor(threeDaysFromNow.getTime() / 1000);
  
  // Use global deadline index for efficient cross-guild query
  const deadlineKeys = await env.SCHEDULES.list({
    prefix: 'deadline:',
    start: `deadline:${startTime}`,
    end: `deadline:${endTime}`,
    limit: 1000
  });

  console.log(`Found ${deadlineKeys.keys.length} schedules with deadlines in range`);

  for (const key of deadlineKeys.keys) {
    const parts = key.name.split(':');
    // Format: deadline:{timestamp}:{guildId}:{scheduleId}
    const timestamp = parseInt(parts[1]) * 1000; // Convert back to milliseconds
    const guildId = parts[2];
    const scheduleId = parts[3];
    
    const schedule = await storage.getSchedule(scheduleId, guildId);
    if (schedule && schedule.deadline) {
      // Add guildId to schedule
      schedule.guildId = guildId;
      const deadlineTime = schedule.deadline.getTime();
      
      console.log(`Schedule ${scheduleId}: deadline=${new Date(deadlineTime).toISOString()}, status=${schedule.status}, remindersSent=${schedule.remindersSent?.join(',') || 'none'}`);
      
      // Check which reminders need to be sent
      if (schedule.status === 'open' && deadlineTime > now.getTime()) {
        const remindersSent = schedule.remindersSent || [];
        
        // Use custom timings if available, otherwise use defaults
        const timings = schedule.reminderTimings && schedule.reminderTimings.length > 0
          ? schedule.reminderTimings.map(t => ({
              type: t,
              hours: parseTimingToHours(t) || 0,
              message: getTimingMessage(t)
            })).filter(t => t.hours > 0)
          : DEFAULT_REMINDER_TIMINGS;
        
        for (const timing of timings) {
          const reminderTime = deadlineTime - (timing.hours * 60 * 60 * 1000);
          
          // Check if this reminder should be sent now
          // リマインダー時刻を過ぎていて、まだ送信していない場合
          if (now.getTime() >= reminderTime && !remindersSent.includes(timing.type)) {
            // Skip if reminder is too old (more than 8 hours past the reminder time)
            // 8時間以上前のリマインダーはスキップ（大幅に過ぎている場合）
            const timeSinceReminder = now.getTime() - reminderTime;
            if (timeSinceReminder > OLD_REMINDER_THRESHOLD_MS) {
              console.log(`Skipping old reminder for ${scheduleId} (${timing.type}) - ${Math.floor(timeSinceReminder / (60 * 60 * 1000))} hours late`);
              continue;
            }
            
            console.log(`Adding ${scheduleId} to upcoming reminders (${timing.type})`);
            result.upcomingReminders.push({
              schedule,
              reminderType: timing.type,
              message: timing.message
            });
          }
        }
      }
      
      // Check if it's past deadline but still open
      // 締切を過ぎているがまだ開いている場合（自動クローズ対象）
      if (schedule.status === 'open' && deadlineTime <= now.getTime()) {
        // Skip if deadline is too old (more than 8 hours past)
        // 締切を8時間以上過ぎている場合はスキップ
        const timeSinceDeadline = now.getTime() - deadlineTime;
        if (timeSinceDeadline > OLD_REMINDER_THRESHOLD_MS) {
          console.log(`Skipping old closure for ${scheduleId} - deadline was ${Math.floor(timeSinceDeadline / (60 * 60 * 1000))} hours ago`);
          continue;
        }
        
        console.log(`Adding ${scheduleId} to justClosed (deadline was ${new Date(deadlineTime).toISOString()})`);
        result.justClosed.push(schedule);
      }
    }
  }

  return result;
}

export async function sendDeadlineReminders(env: Env): Promise<void> {
  if (!env.DISCORD_TOKEN || !env.DISCORD_APPLICATION_ID) {
    console.error('Missing Discord credentials for notifications');
    return;
  }

  const storage = new StorageService(env.SCHEDULES, env.RESPONSES);
  const notificationService = new NotificationService(
    storage,
    env.DISCORD_TOKEN,
    env.DISCORD_APPLICATION_ID
  );

  const { upcomingReminders, justClosed } = await checkDeadlines(env);

  console.log(`Processing ${upcomingReminders.length} upcoming reminders and ${justClosed.length} closure notifications`);

  // Rate limiting configuration (can be overridden by environment variables)
  const reminderBatchSize = env.REMINDER_BATCH_SIZE ? parseInt(env.REMINDER_BATCH_SIZE) : 20;
  const reminderBatchDelay = env.REMINDER_BATCH_DELAY ? parseInt(env.REMINDER_BATCH_DELAY) : 100;

  // Send reminders for upcoming deadlines with rate limiting
  await processBatches(upcomingReminders, async (reminderInfo) => {
    try {
      const { schedule, reminderType, message } = reminderInfo;
      
      // Get current response count
      const summary = await storage.getScheduleSummary(schedule.id, schedule.guildId || 'default');
      if (summary) {
        schedule.totalResponses = summary.userResponses.length;
      }
      
      await notificationService.sendDeadlineReminder(schedule, message);
      
      // Update remindersSent array
      const remindersSent = schedule.remindersSent || [];
      if (!remindersSent.includes(reminderType)) {
        remindersSent.push(reminderType);
      }
      schedule.remindersSent = remindersSent;
      
      // Keep backward compatibility
      if (reminderType === '8h') {
        schedule.reminderSent = true;
      }
      
      if (!schedule.guildId) schedule.guildId = 'default';
      await storage.saveSchedule(schedule);
      
      console.log(`Sent ${reminderType} deadline reminder for schedule ${schedule.id}`);
    } catch (error) {
      console.error(`Failed to send reminder for schedule ${reminderInfo.schedule.id}:`, error);
    }
  }, {
    batchSize: reminderBatchSize,
    delayBetweenBatches: reminderBatchDelay
  });

  // Send closure notifications with rate limiting
  await processBatches(justClosed, async (schedule) => {
    try {
      // Mark as closed
      schedule.status = 'closed';
      if (!schedule.guildId) schedule.guildId = 'default';
      await storage.saveSchedule(schedule);
      
      // Send summary and PR message in sequence (to avoid doubling API calls)
      await notificationService.sendSummaryMessage(schedule.id, schedule.guildId || 'default');
      await notificationService.sendPRMessage(schedule);
      
      console.log(`Sent closure notification for schedule ${schedule.id}`);
    } catch (error) {
      console.error(`Failed to send closure notification for schedule ${schedule.id}:`, error);
    }
  }, {
    batchSize: 15,  // Process 15 closures in parallel (each sends 2 messages = 30 total)
    delayBetweenBatches: 100  // 0.1 second delay between batches
  });
}
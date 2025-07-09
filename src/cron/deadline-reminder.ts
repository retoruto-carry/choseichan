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

// リマインダーのタイミング定義
const REMINDER_TIMINGS = [
  { type: '3d', hours: 72, message: '締切まで3日' },
  { type: '1d', hours: 24, message: '締切まで1日' },
  { type: '8h', hours: 8, message: '締切まで8時間' },
  { type: '1h', hours: 1, message: '締切まで1時間' }
];

export async function checkDeadlines(env: Env): Promise<DeadlineCheckResult> {
  const storage = new StorageService(env.SCHEDULES, env.RESPONSES);
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 過去1週間まで確認
  
  const result: DeadlineCheckResult = {
    upcomingReminders: [],
    justClosed: []
  };

  // Scan deadline index for schedules within past week to 3 days from now
  // 過去の締切も含めて広範囲をスキャンして、まだ閉じられていないものを見つける
  const startTime = oneWeekAgo.getTime();
  const endTime = threeDaysFromNow.getTime();
  
  // List all guilds first by finding all schedule keys
  const scheduleKeys = await env.SCHEDULES.list({
    prefix: 'guild:',
    limit: 1000
  });

  // Extract unique guild IDs from schedule keys only
  const guildIds = new Set<string>();
  for (const key of scheduleKeys.keys) {
    const parts = key.name.split(':');
    // Match pattern: guild:{guildId}:schedule:{scheduleId}
    if (parts[0] === 'guild' && parts[2] === 'schedule' && parts[1]) {
      guildIds.add(parts[1]);
    }
  }

  // Check deadline index for each guild
  console.log(`Found ${guildIds.size} guilds to check`);
  
  for (const guildId of guildIds) {
    const deadlineKeys = await env.SCHEDULES.list({
      prefix: `guild:${guildId}:deadline:`,
      limit: 1000
    });
    
    console.log(`Guild ${guildId}: Found ${deadlineKeys.keys.length} deadline keys`);

    for (const key of deadlineKeys.keys) {
      const parts = key.name.split(':');
      const timestamp = parseInt(parts[3]) * 1000; // Convert to milliseconds
      
      if (timestamp >= startTime && timestamp <= endTime) {
        const scheduleId = parts[4];
        
        const schedule = await storage.getSchedule(scheduleId, guildId);
        if (schedule && schedule.deadline) {
          // Add guildId to schedule
          schedule.guildId = guildId;
          const deadlineTime = schedule.deadline.getTime();
          
          console.log(`Schedule ${scheduleId}: deadline=${new Date(deadlineTime).toISOString()}, status=${schedule.status}, remindersSent=${schedule.remindersSent?.join(',') || 'none'}`);
          
          // Check which reminders need to be sent
          if (schedule.status === 'open' && deadlineTime > now.getTime()) {
            const remindersSent = schedule.remindersSent || [];
            
            for (const timing of REMINDER_TIMINGS) {
              const reminderTime = deadlineTime - (timing.hours * 60 * 60 * 1000);
              
              // Check if this reminder should be sent now
              // リマインダー時刻を過ぎていて、まだ送信していない場合
              if (now.getTime() >= reminderTime && !remindersSent.includes(timing.type)) {
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
            console.log(`Adding ${scheduleId} to justClosed (deadline was ${new Date(deadlineTime).toISOString()})`);
            result.justClosed.push(schedule);
          }
        }
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
      if (reminderType === '1h') {
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
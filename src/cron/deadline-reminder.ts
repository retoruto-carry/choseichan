import { Env } from '../types/discord';
import { StorageServiceV2 as StorageService } from '../services/storage-v2';
import { NotificationService } from '../services/notification';
import { Schedule } from '../types/schedule';

interface DeadlineCheckResult {
  upcoming: Schedule[];  // 1時間以内に締切予定
  justClosed: Schedule[]; // 前回チェックから今回までに締切を過ぎた
}

export async function checkDeadlines(env: Env): Promise<DeadlineCheckResult> {
  const storage = new StorageService(env.SCHEDULES, env.RESPONSES);
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  const result: DeadlineCheckResult = {
    upcoming: [],
    justClosed: []
  };

  // Scan deadline index for schedules within past hour to next hour
  const startTimestamp = Math.floor(oneHourAgo.getTime() / 1000);
  const endTimestamp = Math.floor(oneHourFromNow.getTime() / 1000);
  
  const deadlineKeys = await env.SCHEDULES.list({
    prefix: 'deadline:',
    limit: 1000
  });

  for (const key of deadlineKeys.keys) {
    const parts = key.name.split(':');
    const timestamp = parseInt(parts[1]);
    
    if (timestamp >= startTimestamp && timestamp <= endTimestamp) {
      const guildId = parts[2];
      const scheduleId = parts[3];
      
      const schedule = await storage.getSchedule(scheduleId, guildId);
      if (schedule && schedule.deadline) {
        // Add guildId to schedule
        schedule.guildId = guildId;
        const deadlineTime = schedule.deadline.getTime();
        
        // Check if it's about to close (within next hour) and hasn't been reminded
        if (schedule.status === 'open' && 
            deadlineTime > now.getTime() && 
            deadlineTime <= oneHourFromNow.getTime() &&
            !schedule.reminderSent) {
          result.upcoming.push(schedule);
        }
        
        // Check if it just closed (past deadline but still open status)
        if (schedule.status === 'open' && deadlineTime <= now.getTime()) {
          result.justClosed.push(schedule);
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

  const { upcoming, justClosed } = await checkDeadlines(env);

  // Send reminders for upcoming deadlines
  for (const schedule of upcoming) {
    try {
      await notificationService.sendDeadlineReminder(schedule);
      
      // Mark reminder as sent
      schedule.reminderSent = true;
      if (!schedule.guildId) schedule.guildId = 'default';
      await storage.saveSchedule(schedule);
      
      console.log(`Sent deadline reminder for schedule ${schedule.id}`);
    } catch (error) {
      console.error(`Failed to send reminder for schedule ${schedule.id}:`, error);
    }
  }

  // Send closure notifications and PR messages
  for (const schedule of justClosed) {
    try {
      // Mark as closed
      schedule.status = 'closed';
      if (!schedule.guildId) schedule.guildId = 'default';
      await storage.saveSchedule(schedule);
      
      // Send summary
      await notificationService.sendSummaryMessage(schedule.id, schedule.guildId || 'default');
      
      // Send PR message
      await notificationService.sendPRMessage(schedule);
      
      console.log(`Sent closure notification for schedule ${schedule.id}`);
    } catch (error) {
      console.error(`Failed to send closure notification for schedule ${schedule.id}:`, error);
    }
  }
}
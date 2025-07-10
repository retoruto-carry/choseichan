/**
 * KV実装のスケジュールリポジトリ
 */

import { IScheduleRepository, NotFoundError } from '../interfaces';
import { Schedule } from '../../types/schedule-v2';
import { TIME_CONSTANTS } from '../../constants';

export class KVScheduleRepository implements IScheduleRepository {
  constructor(private schedules: KVNamespace) {}

  async save(schedule: Schedule): Promise<void> {
    const guildId = schedule.guildId || 'default';
    
    // Check for existing schedule to clean up old deadline index
    const existingSchedule = await this.findById(schedule.id, guildId);
    if (existingSchedule?.deadline) {
      const oldTimestamp = Math.floor(existingSchedule.deadline.getTime() / 1000);
      const newTimestamp = schedule.deadline ? Math.floor(schedule.deadline.getTime() / 1000) : null;
      
      // If deadline was removed or changed, delete old index entries
      if (!schedule.deadline || oldTimestamp !== newTimestamp) {
        // Delete old guild-specific index (legacy)
        await this.schedules.delete(`guild:${guildId}:deadline:${oldTimestamp}:${schedule.id}`);
        // Delete old global index
        await this.schedules.delete(`deadline:${oldTimestamp}:${guildId}:${schedule.id}`);
      }
    }
    
    // Calculate expiration time: 6 months after deadline (or creation if no deadline)
    const baseTime = schedule.deadline ? schedule.deadline.getTime() : schedule.createdAt.getTime();
    const expirationTime = Math.floor(baseTime / TIME_CONSTANTS.MILLISECONDS_PER_SECOND) + TIME_CONSTANTS.SIX_MONTHS_SECONDS;
    
    // Save main schedule data
    await this.schedules.put(
      `guild:${guildId}:schedule:${schedule.id}`,
      JSON.stringify(schedule),
      {
        metadata: {
          guildId,
          channelId: schedule.channelId,
          createdBy: schedule.createdBy.id,
          status: schedule.status
        },
        expiration: expirationTime
      }
    );

    // Save to channel index with same expiration
    await this.schedules.put(
      `guild:${guildId}:channel:${schedule.channelId}:${schedule.id}`,
      schedule.id,
      {
        expiration: expirationTime
      }
    );

    // Save to deadline index if deadline exists
    if (schedule.deadline) {
      const timestamp = Math.floor(schedule.deadline.getTime() / 1000);
      // Save to global deadline index for efficient cross-guild queries
      await this.schedules.put(
        `deadline:${timestamp}:${guildId}:${schedule.id}`,
        schedule.id,
        {
          expiration: expirationTime
        }
      );
    }
  }

  async findById(scheduleId: string, guildId: string = 'default'): Promise<Schedule | null> {
    const data = await this.schedules.get(`guild:${guildId}:schedule:${scheduleId}`);
    if (!data) return null;
    
    const schedule = JSON.parse(data) as Schedule;
    // Convert date strings back to Date objects
    schedule.createdAt = new Date(schedule.createdAt);
    schedule.updatedAt = new Date(schedule.updatedAt);
    if (schedule.deadline) {
      schedule.deadline = new Date(schedule.deadline);
    }
    
    return schedule;
  }

  async findByChannel(channelId: string, guildId: string = 'default', limit: number = 100): Promise<Schedule[]> {
    const list = await this.schedules.list({ 
      prefix: `guild:${guildId}:channel:${channelId}:`,
      limit 
    });
    
    const schedules: Schedule[] = [];
    for (const key of list.keys) {
      const scheduleId = key.name.split(':').pop();
      if (scheduleId) {
        const schedule = await this.findById(scheduleId, guildId);
        if (schedule) {
          schedules.push(schedule);
        }
      }
    }
    
    // Sort by creation date (newest first)
    return schedules.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findByDeadlineRange(
    startTime: Date, 
    endTime: Date, 
    guildId?: string
  ): Promise<Schedule[]> {
    const startTimestamp = Math.floor(startTime.getTime() / 1000);
    const endTimestamp = Math.floor(endTime.getTime() / 1000);
    
    // Get all deadline keys in range
    const list = await this.schedules.list({ 
      prefix: 'deadline:',
      limit: 1000 
    });
    
    const schedules: Schedule[] = [];
    const seenIds = new Set<string>();
    
    for (const key of list.keys) {
      const parts = key.name.split(':');
      if (parts.length >= 4) {
        const timestamp = parseInt(parts[1]);
        const keyGuildId = parts[2];
        const scheduleId = parts[3];
        
        // Check if within time range and guild match
        if (timestamp >= startTimestamp && 
            timestamp <= endTimestamp &&
            (!guildId || guildId === keyGuildId) &&
            !seenIds.has(scheduleId)) {
          
          seenIds.add(scheduleId);
          const schedule = await this.findById(scheduleId, keyGuildId);
          if (schedule && schedule.status === 'open') {
            schedules.push(schedule);
          }
        }
      }
    }
    
    return schedules;
  }

  async delete(scheduleId: string, guildId: string = 'default'): Promise<void> {
    const schedule = await this.findById(scheduleId, guildId);
    if (!schedule) return;
    
    // Delete main schedule
    await this.schedules.delete(`guild:${guildId}:schedule:${scheduleId}`);
    
    // Delete from channel index
    await this.schedules.delete(`guild:${guildId}:channel:${schedule.channelId}:${scheduleId}`);
    
    // Delete from deadline index if exists
    if (schedule.deadline) {
      const timestamp = Math.floor(schedule.deadline.getTime() / 1000);
      // Delete from guild-specific deadline index (legacy)
      await this.schedules.delete(`guild:${guildId}:deadline:${timestamp}:${scheduleId}`);
      // Delete from global deadline index
      await this.schedules.delete(`deadline:${timestamp}:${guildId}:${scheduleId}`);
    }
  }

  async findByMessageId(messageId: string, guildId: string): Promise<Schedule | null> {
    // This is inefficient with KV, but necessary for compatibility
    // In D1, this would be a simple indexed query
    const channelList = await this.schedules.list({
      prefix: `guild:${guildId}:schedule:`,
      limit: 1000
    });

    for (const key of channelList.keys) {
      const data = await this.schedules.get(key.name);
      if (data) {
        const schedule = JSON.parse(data) as Schedule;
        if (schedule.messageId === messageId) {
          // Convert dates
          schedule.createdAt = new Date(schedule.createdAt);
          schedule.updatedAt = new Date(schedule.updatedAt);
          if (schedule.deadline) {
            schedule.deadline = new Date(schedule.deadline);
          }
          return schedule;
        }
      }
    }

    return null;
  }

  async countByGuild(guildId: string): Promise<number> {
    const list = await this.schedules.list({
      prefix: `guild:${guildId}:schedule:`,
      limit: 1000
    });
    
    return list.keys.length;
  }
}
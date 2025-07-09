import { Schedule, Response, ScheduleSummary, ResponseStatus } from '../types/schedule';

/**
 * マルチテナント対応のStorageService
 * guildIdを含むキー設計で、サーバーごとにデータを分離
 */
export class StorageServiceV2 {
  constructor(
    private schedules: KVNamespace,
    private responses: KVNamespace
  ) {}

  // Schedule operations
  async saveSchedule(schedule: Schedule): Promise<void> {
    const guildId = schedule.guildId || 'default';
    
    await this.schedules.put(
      `guild:${guildId}:schedule:${schedule.id}`,
      JSON.stringify(schedule),
      {
        metadata: {
          guildId,
          channelId: schedule.channelId,
          createdBy: schedule.createdBy.id,
          status: schedule.status
        }
      }
    );

    // Save to channel index
    await this.schedules.put(
      `guild:${guildId}:channel:${schedule.channelId}:${schedule.id}`,
      schedule.id,
      {
        expiration: schedule.deadline ? Math.floor(schedule.deadline.getTime() / 1000) : undefined
      }
    );

    // Save to deadline index if deadline exists
    if (schedule.deadline) {
      const timestamp = Math.floor(schedule.deadline.getTime() / 1000);
      await this.schedules.put(
        `deadline:${timestamp}:${guildId}:${schedule.id}`,
        schedule.id
      );
    }
  }

  async getSchedule(scheduleId: string, guildId: string = 'default'): Promise<Schedule | null> {
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

  async listSchedulesByChannel(channelId: string, guildId: string = 'default'): Promise<Schedule[]> {
    const list = await this.schedules.list({ 
      prefix: `guild:${guildId}:channel:${channelId}:` 
    });
    const schedules: Schedule[] = [];
    
    for (const key of list.keys) {
      const scheduleId = await this.schedules.get(key.name);
      if (scheduleId && typeof scheduleId === 'string') {
        const schedule = await this.getSchedule(scheduleId, guildId);
        if (schedule) {
          schedules.push(schedule);
        }
      }
    }
    
    return schedules.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteSchedule(scheduleId: string, guildId: string = 'default'): Promise<void> {
    const schedule = await this.getSchedule(scheduleId, guildId);
    if (!schedule) return;

    // Delete main record
    await this.schedules.delete(`guild:${guildId}:schedule:${scheduleId}`);
    
    // Delete from channel index
    await this.schedules.delete(`guild:${guildId}:channel:${schedule.channelId}:${scheduleId}`);
    
    // Delete from deadline index
    if (schedule.deadline) {
      const timestamp = Math.floor(schedule.deadline.getTime() / 1000);
      await this.schedules.delete(`deadline:${timestamp}:${guildId}:${scheduleId}`);
    }
  }

  // Response operations
  async saveResponse(response: Response, guildId: string = 'default'): Promise<void> {
    await this.responses.put(
      `guild:${guildId}:response:${response.scheduleId}:${response.userId}`,
      JSON.stringify(response)
    );
  }

  async getResponse(scheduleId: string, userId: string, guildId: string = 'default'): Promise<Response | null> {
    const data = await this.responses.get(`guild:${guildId}:response:${scheduleId}:${userId}`);
    if (!data) return null;
    
    const response = JSON.parse(data) as Response;
    response.updatedAt = new Date(response.updatedAt);
    
    return response;
  }

  async listResponsesBySchedule(scheduleId: string, guildId: string = 'default'): Promise<Response[]> {
    const list = await this.responses.list({ 
      prefix: `guild:${guildId}:response:${scheduleId}:` 
    });
    const responses: Response[] = [];
    
    for (const key of list.keys) {
      const data = await this.responses.get(key.name);
      if (data) {
        const response = JSON.parse(data) as Response;
        response.updatedAt = new Date(response.updatedAt);
        responses.push(response);
      }
    }
    
    return responses.sort((a, b) => a.userName.localeCompare(b.userName));
  }

  async getUserResponses(scheduleId: string, userId: string, guildId: string = 'default'): Promise<Response[]> {
    const response = await this.getResponse(scheduleId, userId, guildId);
    return response ? [response] : [];
  }
  
  async deleteResponse(scheduleId: string, userId: string, guildId: string = 'default'): Promise<void> {
    await this.responses.delete(`guild:${guildId}:response:${scheduleId}:${userId}`);
  }

  // Summary operations
  async getScheduleSummary(scheduleId: string, guildId: string = 'default'): Promise<ScheduleSummary | null> {
    const schedule = await this.getSchedule(scheduleId, guildId);
    if (!schedule) return null;
    
    const userResponses = await this.listResponsesBySchedule(scheduleId, guildId);
    
    // Initialize response counts
    const responseCounts: { [dateId: string]: { yes: number; maybe: number; no: number; total: number } } = {};
    
    for (const date of schedule.dates) {
      responseCounts[date.id] = { yes: 0, maybe: 0, no: 0, total: 0 };
    }
    
    // Count responses
    for (const userResponse of userResponses) {
      for (const dateResponse of userResponse.responses) {
        if (responseCounts[dateResponse.dateId]) {
          responseCounts[dateResponse.dateId][dateResponse.status]++;
          responseCounts[dateResponse.dateId].total++;
        }
      }
    }
    
    // Find best date
    let bestDateId: string | undefined = undefined;
    let maxScore = -1;
    
    for (const date of schedule.dates) {
      const count = responseCounts[date.id];
      const score = count.yes * 2 + count.maybe;
      
      if (score > maxScore) {
        maxScore = score;
        bestDateId = date.id;
      }
    }
    
    return {
      schedule,
      userResponses,
      responseCounts,
      bestDateId
    };
  }
}
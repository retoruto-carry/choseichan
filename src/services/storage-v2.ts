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
    
    // Check for existing schedule to clean up old deadline index
    const existingSchedule = await this.getSchedule(schedule.id, guildId);
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
    const expirationTime = Math.floor(baseTime / 1000) + (6 * 30 * 24 * 60 * 60); // +6 months
    
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
      // Delete from global deadline index
      await this.schedules.delete(`deadline:${timestamp}:${guildId}:${scheduleId}`);
    }
  }

  // Response operations
  async saveResponse(response: Response, guildId: string = 'default'): Promise<void> {
    // Get schedule to determine expiration time
    const schedule = await this.getSchedule(response.scheduleId, guildId);
    let expirationTime: number | undefined;
    
    if (schedule) {
      // Same expiration logic as schedule: 6 months after deadline (or creation if no deadline)
      const baseTime = schedule.deadline ? schedule.deadline.getTime() : schedule.createdAt.getTime();
      expirationTime = Math.floor(baseTime / 1000) + (6 * 30 * 24 * 60 * 60); // +6 months
    }
    
    await this.responses.put(
      `guild:${guildId}:response:${response.scheduleId}:${response.userId}`,
      JSON.stringify(response),
      expirationTime ? { expiration: expirationTime } : undefined
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

  /**
   * Get schedule summary with optimistic update for a specific user response
   * This is used to immediately reflect changes without waiting for KV propagation
   */
  async getScheduleSummaryWithOptimisticUpdate(
    scheduleId: string, 
    guildId: string,
    optimisticResponse: Response
  ): Promise<ScheduleSummary | null> {
    const schedule = await this.getSchedule(scheduleId, guildId);
    if (!schedule) return null;
    
    const userResponses = await this.listResponsesBySchedule(scheduleId, guildId);
    
    // Apply optimistic update
    const existingIndex = userResponses.findIndex(r => r.userId === optimisticResponse.userId);
    if (existingIndex >= 0) {
      userResponses[existingIndex] = optimisticResponse;
    } else {
      userResponses.push(optimisticResponse);
    }
    
    // Initialize response counts
    const responseCounts: { [dateId: string]: { yes: number; maybe: number; no: number; total: number } } = {};
    
    for (const date of schedule.dates) {
      responseCounts[date.id] = { yes: 0, maybe: 0, no: 0, total: 0 };
    }
    
    // Count responses with optimistic data
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
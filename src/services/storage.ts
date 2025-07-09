import { Schedule, Response, ScheduleSummary, ResponseStatus } from '../types/schedule';

export class StorageService {
  constructor(
    private schedules: KVNamespace,
    private responses: KVNamespace
  ) {}

  // Schedule operations
  async saveSchedule(schedule: Schedule): Promise<void> {
    await this.schedules.put(
      `schedule:${schedule.id}`,
      JSON.stringify(schedule),
      {
        metadata: {
          channelId: schedule.channelId,
          createdBy: schedule.createdBy.id,
          status: schedule.status
        }
      }
    );

    // Also save to channel index for listing
    await this.schedules.put(
      `channel:${schedule.channelId}:${schedule.id}`,
      schedule.id,
      {
        expiration: schedule.deadline ? Math.floor(schedule.deadline.getTime() / 1000) : undefined
      }
    );
  }

  async getSchedule(scheduleId: string): Promise<Schedule | null> {
    const data = await this.schedules.get(`schedule:${scheduleId}`);
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

  async listSchedulesByChannel(channelId: string): Promise<Schedule[]> {
    const list = await this.schedules.list({ prefix: `channel:${channelId}:` });
    const schedules: Schedule[] = [];
    
    for (const key of list.keys) {
      const scheduleId = await this.schedules.get(key.name);
      if (scheduleId && typeof scheduleId === 'string') {
        const schedule = await this.getSchedule(scheduleId);
        if (schedule) {
          schedules.push(schedule);
        }
      }
    }
    
    return schedules.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    const schedule = await this.getSchedule(scheduleId);
    if (!schedule) return;
    
    // Delete schedule
    await this.schedules.delete(`schedule:${scheduleId}`);
    
    // Delete from channel index
    await this.schedules.delete(`channel:${schedule.channelId}:${scheduleId}`);
    
    // Delete all responses
    const responseList = await this.responses.list({ prefix: `response:${scheduleId}:` });
    for (const key of responseList.keys) {
      await this.responses.delete(key.name);
    }
  }

  // Response operations
  async saveResponse(response: Response): Promise<void> {
    await this.responses.put(
      `response:${response.scheduleId}:${response.userId}`,
      JSON.stringify(response),
      {
        metadata: {
          userName: response.userName,
          updatedAt: response.updatedAt.toISOString()
        }
      }
    );
  }

  async getResponse(scheduleId: string, userId: string): Promise<Response | null> {
    const data = await this.responses.get(`response:${scheduleId}:${userId}`);
    if (!data) return null;
    
    const response = JSON.parse(data) as Response;
    response.updatedAt = new Date(response.updatedAt);
    
    return response;
  }

  async listResponsesBySchedule(scheduleId: string): Promise<Response[]> {
    const list = await this.responses.list({ prefix: `response:${scheduleId}:` });
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

  // Summary operations
  async getScheduleSummary(scheduleId: string): Promise<ScheduleSummary | null> {
    const schedule = await this.getSchedule(scheduleId);
    if (!schedule) return null;
    
    const userResponses = await this.listResponsesBySchedule(scheduleId);
    
    // Calculate response counts
    const responseCounts: ScheduleSummary['responseCounts'] = {};
    
    for (const date of schedule.dates) {
      responseCounts[date.id] = {
        yes: 0,
        maybe: 0,
        no: 0,
        total: 0
      };
    }
    
    for (const userResponse of userResponses) {
      for (const dateResponse of userResponse.responses) {
        const count = responseCounts[dateResponse.dateId];
        if (count) {
          count[dateResponse.status]++;
          count.total++;
        }
      }
    }
    
    // Find best date (most "yes" votes, then least "no" votes)
    let bestDateId: string | undefined;
    let bestScore = -1;
    
    for (const date of schedule.dates) {
      const count = responseCounts[date.id];
      const score = count.yes * 1000 - count.no * 100 + count.maybe * 10;
      
      if (score > bestScore) {
        bestScore = score;
        bestDateId = date.id;
      }
    }
    
    return {
      schedule,
      responseCounts,
      userResponses,
      bestDateId
    };
  }
}
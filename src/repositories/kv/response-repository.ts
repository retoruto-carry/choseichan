/**
 * KV実装のレスポンスリポジトリ
 */

import { IResponseRepository, IScheduleRepository } from '../interfaces';
import { Response as LegacyResponse } from '../../types/schedule';
import { Response, ScheduleSummary, ResponseStatus, convertLegacyResponse, convertResponseToLegacy } from '../../types/schedule-v2';
import { TIME_CONSTANTS } from '../../constants';

export class KVResponseRepository implements IResponseRepository {
  constructor(
    private responses: KVNamespace,
    private scheduleRepository: IScheduleRepository
  ) {}

  async save(response: Response, guildId: string = 'default'): Promise<void> {
    // Get schedule to determine expiration time
    const schedule = await this.scheduleRepository.findById(response.scheduleId, guildId);
    let expirationTime: number | undefined;
    
    if (schedule) {
      // Same expiration logic as schedule: 6 months after deadline (or creation if no deadline)
      const baseTime = schedule.deadline ? schedule.deadline.getTime() : schedule.createdAt.getTime();
      expirationTime = Math.floor(baseTime / TIME_CONSTANTS.MILLISECONDS_PER_SECOND) + TIME_CONSTANTS.SIX_MONTHS_SECONDS;
    }
    
    // Convert to legacy format for storage compatibility
    const legacyResponse = convertResponseToLegacy(response);
    
    await this.responses.put(
      `guild:${guildId}:response:${response.scheduleId}:${response.userId}`,
      JSON.stringify(legacyResponse),
      expirationTime ? { expiration: expirationTime } : undefined
    );
  }

  async findByUser(
    scheduleId: string, 
    userId: string, 
    guildId: string = 'default'
  ): Promise<Response | null> {
    const data = await this.responses.get(`guild:${guildId}:response:${scheduleId}:${userId}`);
    if (!data) return null;
    
    const legacyResponse = JSON.parse(data);
    return convertLegacyResponse(legacyResponse);
  }

  async findBySchedule(scheduleId: string, guildId: string = 'default'): Promise<Response[]> {
    const list = await this.responses.list({ 
      prefix: `guild:${guildId}:response:${scheduleId}:` 
    });
    const responses: Response[] = [];
    
    for (const key of list.keys) {
      const data = await this.responses.get(key.name);
      if (data) {
        const legacyResponse = JSON.parse(data);
        responses.push(convertLegacyResponse(legacyResponse));
      }
    }
    
    return responses;
  }

  async delete(scheduleId: string, userId: string, guildId: string = 'default'): Promise<void> {
    await this.responses.delete(`guild:${guildId}:response:${scheduleId}:${userId}`);
  }

  async deleteBySchedule(scheduleId: string, guildId: string = 'default'): Promise<void> {
    const list = await this.responses.list({ 
      prefix: `guild:${guildId}:response:${scheduleId}:` 
    });
    
    // Delete all responses for the schedule
    const deletePromises = list.keys.map(key => this.responses.delete(key.name));
    await Promise.all(deletePromises);
  }

  async getScheduleSummary(scheduleId: string, guildId: string = 'default'): Promise<ScheduleSummary | null> {
    const schedule = await this.scheduleRepository.findById(scheduleId, guildId);
    if (!schedule) return null;
    
    const responses = await this.findBySchedule(scheduleId, guildId);
    
    // Calculate response counts for each date and status
    const responseCounts: Record<string, Record<ResponseStatus, number>> = {};
    const userResponses: Record<string, Record<string, ResponseStatus>> = {};
    
    // Initialize counts
    for (const date of schedule.dates) {
      responseCounts[date.id] = {
        ok: 0,
        maybe: 0,
        ng: 0
      };
    }
    
    // Count responses
    for (const response of responses) {
      if (!userResponses[response.userId]) {
        userResponses[response.userId] = {};
      }
      
      for (const [dateId, status] of Object.entries(response.dateStatuses)) {
        if (responseCounts[dateId]) {
          // Remove old status count if exists
          const oldStatus = userResponses[response.userId][dateId];
          if (oldStatus && responseCounts[dateId][oldStatus] > 0) {
            responseCounts[dateId][oldStatus]--;
          }
          
          // Add new status count
          responseCounts[dateId][status as ResponseStatus]++;
          userResponses[response.userId][dateId] = status as ResponseStatus;
        }
      }
    }
    
    return {
      schedule,
      responseCounts,
      userResponses,
      totalResponses: responses.length
    };
  }
}
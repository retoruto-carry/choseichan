/**
 * StorageServiceV2の互換性を保ちながら、実装をStorageServiceV3に委譲するアダプター
 */

import { Schedule, Response, ScheduleSummary } from '../types/schedule';
import { 
  Schedule as ScheduleV2, 
  Response as ResponseV2, 
  ScheduleSummary as ScheduleSummaryV2,
  convertLegacyResponse,
  convertResponseToLegacy,
  convertToLegacyScheduleSummary
} from '../types/schedule-v2';
import { StorageServiceV3 } from './storage-v3';
import { getRepositoryFactory } from '../infrastructure/factories/factory';
import { Env } from '../types/discord';

// Helper functions for Schedule type conversion
function convertScheduleToV2(schedule: Schedule): ScheduleV2 {
  return {
    ...schedule,
    guildId: schedule.guildId || 'default',  // Ensure guildId is never undefined
    dates: schedule.dates || [],
    totalResponses: schedule.totalResponses || 0,
    notificationSent: schedule.notificationSent || false,
    createdAt: schedule.createdAt instanceof Date ? schedule.createdAt : new Date(schedule.createdAt),
    updatedAt: schedule.updatedAt instanceof Date ? schedule.updatedAt : new Date(schedule.updatedAt)
  };
}

function convertScheduleFromV2(schedule: ScheduleV2): Schedule {
  return schedule as Schedule;  // V2 is compatible with V1
}

function convertScheduleSummaryFromV2(summary: ScheduleSummaryV2 | null, responses: ResponseV2[]): ScheduleSummary | null {
  if (!summary) return null;
  
  // Convert to legacy format
  const legacySummary = convertToLegacyScheduleSummary(summary, responses);
  
  return {
    schedule: convertScheduleFromV2(summary.schedule),
    responseCounts: legacySummary.responseCounts,
    userResponses: legacySummary.userResponses,
    bestDateId: legacySummary.bestDateId
  } as ScheduleSummary;
}

/**
 * 既存のStorageServiceV2と同じインターフェースを提供
 * 内部ではStorageServiceV3を使用
 */
export class StorageServiceV2 {
  private storageV3: StorageServiceV3;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    // テスト環境では常に新しいファクトリを作成
    const forceNew = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
    const repositoryFactory = getRepositoryFactory(env, forceNew);
    
    this.storageV3 = new StorageServiceV3(repositoryFactory);
  }

  // Helper method to get the environment
  getEnv(): Env {
    return this.env;
  }

  // Schedule operations
  async saveSchedule(schedule: Schedule): Promise<void> {
    const scheduleV2 = convertScheduleToV2(schedule);
    return this.storageV3.saveSchedule(scheduleV2);
  }

  async getSchedule(scheduleId: string, guildId: string = 'default'): Promise<Schedule | null> {
    const scheduleV2 = await this.storageV3.getSchedule(scheduleId, guildId);
    return scheduleV2 ? convertScheduleFromV2(scheduleV2) : null;
  }

  async listSchedulesByChannel(channelId: string, guildId: string = 'default', limit: number = 100): Promise<Schedule[]> {
    const schedulesV2 = await this.storageV3.listSchedulesByChannel(channelId, guildId, limit);
    return schedulesV2.map(convertScheduleFromV2);
  }

  async getSchedulesWithDeadlineInRange(startTime: Date, endTime: Date, guildId?: string): Promise<Schedule[]> {
    const schedulesV2 = await this.storageV3.getSchedulesWithDeadlineInRange(startTime, endTime, guildId);
    return schedulesV2.map(convertScheduleFromV2);
  }

  async deleteSchedule(scheduleId: string, guildId: string = 'default'): Promise<void> {
    return this.storageV3.deleteSchedule(scheduleId, guildId);
  }

  async getScheduleByMessageId(messageId: string, guildId: string): Promise<Schedule | null> {
    const scheduleV2 = await this.storageV3.getScheduleByMessageId(messageId, guildId);
    return scheduleV2 ? convertScheduleFromV2(scheduleV2) : null;
  }

  // Response operations
  async saveResponse(response: Response, guildId: string = 'default'): Promise<void> {
    // Convert old Response to LegacyResponse format first
    const legacyResponse = {
      ...response,
      username: response.userName,
      responses: response.responses.map(r => ({
        dateId: r.dateId,
        status: r.status
      }))
    };
    const responseV2 = convertLegacyResponse(legacyResponse);
    return this.storageV3.saveResponse(responseV2, guildId);
  }

  async getResponse(scheduleId: string, userId: string, guildId: string = 'default'): Promise<Response | null> {
    const responseV2 = await this.storageV3.getResponse(scheduleId, userId, guildId);
    if (!responseV2) return null;
    const legacyResponse = convertResponseToLegacy(responseV2);
    return {
      ...legacyResponse,
      updatedAt: legacyResponse.updatedAt instanceof Date ? legacyResponse.updatedAt : new Date(legacyResponse.updatedAt)
    } as Response;
  }

  async listResponsesBySchedule(scheduleId: string, guildId: string = 'default'): Promise<Response[]> {
    const responsesV2 = await this.storageV3.listResponsesBySchedule(scheduleId, guildId);
    return responsesV2.map(r => {
      const legacyResponse = convertResponseToLegacy(r);
      return {
        ...legacyResponse,
        updatedAt: legacyResponse.updatedAt instanceof Date ? legacyResponse.updatedAt : new Date(legacyResponse.updatedAt)
      } as Response;
    });
  }

  async getScheduleSummary(scheduleId: string, guildId: string = 'default'): Promise<ScheduleSummary | null> {
    const summaryV2 = await this.storageV3.getScheduleSummary(scheduleId, guildId);
    if (!summaryV2) return null;
    const responsesV2 = await this.storageV3.listResponsesBySchedule(scheduleId, guildId);
    return convertScheduleSummaryFromV2(summaryV2, responsesV2);
  }

  // Additional methods for backward compatibility
  async getUserResponses(scheduleId: string, userId: string, guildId: string = 'default'): Promise<Response[]> {
    const response = await this.getResponse(scheduleId, userId, guildId);
    return response ? [response] : [];
  }

  async getScheduleSummaryWithOptimisticUpdate(
    scheduleId: string,
    guildId: string,
    userId: string,
    optimisticResponse: Response
  ): Promise<ScheduleSummary | null> {
    // Convert old Response to LegacyResponse format first
    const legacyResponse = {
      ...optimisticResponse,
      username: optimisticResponse.userName,
      responses: optimisticResponse.responses.map(r => ({
        dateId: r.dateId,
        status: r.status
      }))
    };
    const responseV2 = convertLegacyResponse(legacyResponse);
    await this.storageV3.saveResponse(responseV2, guildId);
    
    // Get and convert the updated summary
    const summaryV2 = await this.storageV3.getScheduleSummary(scheduleId, guildId);
    if (!summaryV2) return null;
    const responsesV2 = await this.storageV3.listResponsesBySchedule(scheduleId, guildId);
    return convertScheduleSummaryFromV2(summaryV2, responsesV2);
  }
}
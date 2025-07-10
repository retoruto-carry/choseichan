/**
 * StorageServiceV2の互換性を保ちながら、実装をStorageServiceV3に委譲するアダプター
 */

import { Schedule, Response, ScheduleSummary } from '../types/schedule';
import { StorageServiceV3 } from './storage-v3';
import { getRepositoryFactory } from '../repositories/factory';
import { Env } from '../types/discord';

/**
 * 既存のStorageServiceV2と同じインターフェースを提供
 * 内部ではStorageServiceV3を使用
 */
export class StorageServiceV2 {
  private storageV3: StorageServiceV3;

  constructor(schedules: KVNamespace, responses: KVNamespace, env?: Env) {
    // 環境変数からリポジトリファクトリを作成
    const effectiveEnv: Env = env || {
      DISCORD_PUBLIC_KEY: '',
      DISCORD_APPLICATION_ID: '',
      DISCORD_TOKEN: '',
      SCHEDULES: schedules,
      RESPONSES: responses,
      DATABASE_TYPE: 'kv',
      DB: undefined
    };
    
    const repositoryFactory = getRepositoryFactory(effectiveEnv);
    
    this.storageV3 = new StorageServiceV3(repositoryFactory);
  }

  // Schedule operations
  async saveSchedule(schedule: Schedule): Promise<void> {
    return this.storageV3.saveSchedule(schedule);
  }

  async getSchedule(scheduleId: string, guildId: string = 'default'): Promise<Schedule | null> {
    return this.storageV3.getSchedule(scheduleId, guildId);
  }

  async listSchedulesByChannel(channelId: string, guildId: string = 'default', limit: number = 100): Promise<Schedule[]> {
    return this.storageV3.listSchedulesByChannel(channelId, guildId, limit);
  }

  async getSchedulesWithDeadlineInRange(startTime: Date, endTime: Date, guildId?: string): Promise<Schedule[]> {
    return this.storageV3.getSchedulesWithDeadlineInRange(startTime, endTime, guildId);
  }

  async deleteSchedule(scheduleId: string, guildId: string = 'default'): Promise<void> {
    return this.storageV3.deleteSchedule(scheduleId, guildId);
  }

  async getScheduleByMessageId(messageId: string, guildId: string): Promise<Schedule | null> {
    return this.storageV3.getScheduleByMessageId(messageId, guildId);
  }

  // Response operations
  async saveResponse(response: Response, guildId: string = 'default'): Promise<void> {
    return this.storageV3.saveResponse(response, guildId);
  }

  async getResponse(scheduleId: string, userId: string, guildId: string = 'default'): Promise<Response | null> {
    return this.storageV3.getResponse(scheduleId, userId, guildId);
  }

  async listResponsesBySchedule(scheduleId: string, guildId: string = 'default'): Promise<Response[]> {
    return this.storageV3.listResponsesBySchedule(scheduleId, guildId);
  }

  async getScheduleSummary(scheduleId: string, guildId: string = 'default'): Promise<ScheduleSummary | null> {
    return this.storageV3.getScheduleSummary(scheduleId, guildId);
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
    // For now, just save and return the updated summary
    await this.saveResponse(optimisticResponse, guildId);
    return this.getScheduleSummary(scheduleId, guildId);
  }
}
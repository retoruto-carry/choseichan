/**
 * リポジトリパターンを使用する新しいStorageService
 * 既存のStorageServiceV2と同じインターフェースを提供しながら、
 * 内部実装をリポジトリパターンに委譲
 */

import { Schedule, Response, ScheduleSummary } from '../types/schedule-v2';
import { IRepositoryFactory } from '../repositories/interfaces';

export class StorageServiceV3 {
  constructor(private repositoryFactory: IRepositoryFactory) {}

  // Schedule operations
  async saveSchedule(schedule: Schedule): Promise<void> {
    const repo = this.repositoryFactory.getScheduleRepository();
    await repo.save(schedule);
  }

  async getSchedule(scheduleId: string, guildId: string = 'default'): Promise<Schedule | null> {
    const repo = this.repositoryFactory.getScheduleRepository();
    return repo.findById(scheduleId, guildId);
  }

  async listSchedulesByChannel(channelId: string, guildId: string = 'default', limit: number = 100): Promise<Schedule[]> {
    const repo = this.repositoryFactory.getScheduleRepository();
    return repo.findByChannel(channelId, guildId, limit);
  }

  async getSchedulesWithDeadlineInRange(startTime: Date, endTime: Date, guildId?: string): Promise<Schedule[]> {
    const repo = this.repositoryFactory.getScheduleRepository();
    return repo.findByDeadlineRange(startTime, endTime, guildId);
  }

  async deleteSchedule(scheduleId: string, guildId: string = 'default'): Promise<void> {
    const scheduleRepo = this.repositoryFactory.getScheduleRepository();
    const responseRepo = this.repositoryFactory.getResponseRepository();
    
    // Delete all responses first
    await responseRepo.deleteBySchedule(scheduleId, guildId);
    
    // Then delete the schedule
    await scheduleRepo.delete(scheduleId, guildId);
  }

  async getScheduleByMessageId(messageId: string, guildId: string): Promise<Schedule | null> {
    const repo = this.repositoryFactory.getScheduleRepository();
    return repo.findByMessageId(messageId, guildId);
  }

  // Response operations
  async saveResponse(response: Response, guildId: string = 'default'): Promise<void> {
    const repo = this.repositoryFactory.getResponseRepository();
    await repo.save(response, guildId);
  }

  async getResponse(scheduleId: string, userId: string, guildId: string = 'default'): Promise<Response | null> {
    const repo = this.repositoryFactory.getResponseRepository();
    return repo.findByUser(scheduleId, userId, guildId);
  }

  async listResponsesBySchedule(scheduleId: string, guildId: string = 'default'): Promise<Response[]> {
    const repo = this.repositoryFactory.getResponseRepository();
    return repo.findBySchedule(scheduleId, guildId);
  }

  async getScheduleSummary(scheduleId: string, guildId: string = 'default'): Promise<ScheduleSummary | null> {
    const repo = this.repositoryFactory.getResponseRepository();
    return repo.getScheduleSummary(scheduleId, guildId);
  }

  // Utility methods for backward compatibility
  async getScheduleCountByGuild(guildId: string = 'default'): Promise<number> {
    const repo = this.repositoryFactory.getScheduleRepository();
    return repo.countByGuild(guildId);
  }
}
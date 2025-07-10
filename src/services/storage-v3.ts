/**
 * リポジトリパターンを使用する新しいStorageService
 * 既存のStorageServiceV2と同じインターフェースを提供しながら、
 * 内部実装をリポジトリパターンに委譲
 */

import { Schedule, Response, ScheduleSummary } from '../types/schedule-v2';
import { IRepositoryFactory } from '../domain/repositories/interfaces';
import { ScheduleMapper } from '../infrastructure/mappers/ScheduleMapper';

export class StorageServiceV3 {
  constructor(private repositoryFactory: IRepositoryFactory) {}

  // Schedule operations
  async saveSchedule(schedule: Schedule): Promise<void> {
    const repo = this.repositoryFactory.getScheduleRepository();
    const domainSchedule = ScheduleMapper.toDomain(schedule);
    await repo.save(domainSchedule);
  }

  async getSchedule(scheduleId: string, guildId: string = 'default'): Promise<Schedule | null> {
    const repo = this.repositoryFactory.getScheduleRepository();
    const domainSchedule = await repo.findById(scheduleId, guildId);
    return domainSchedule ? ScheduleMapper.toPersistence(domainSchedule) : null;
  }

  async listSchedulesByChannel(channelId: string, guildId: string = 'default', limit: number = 100): Promise<Schedule[]> {
    const repo = this.repositoryFactory.getScheduleRepository();
    const domainSchedules = await repo.findByChannel(channelId, guildId, limit);
    return domainSchedules.map(schedule => ScheduleMapper.toPersistence(schedule));
  }

  async getSchedulesWithDeadlineInRange(startTime: Date, endTime: Date, guildId?: string): Promise<Schedule[]> {
    const repo = this.repositoryFactory.getScheduleRepository();
    const domainSchedules = await repo.findByDeadlineRange(startTime, endTime, guildId);
    return domainSchedules.map(schedule => ScheduleMapper.toPersistence(schedule));
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
    const domainSchedule = await repo.findByMessageId(messageId, guildId);
    return domainSchedule ? ScheduleMapper.toPersistence(domainSchedule) : null;
  }

  // Response operations
  async saveResponse(response: Response, guildId: string = 'default'): Promise<void> {
    const repo = this.repositoryFactory.getResponseRepository();
    const domainResponse = ScheduleMapper.responseToDomain(response);
    await repo.save(domainResponse, guildId);
  }

  async getResponse(scheduleId: string, userId: string, guildId: string = 'default'): Promise<Response | null> {
    const repo = this.repositoryFactory.getResponseRepository();
    const domainResponse = await repo.findByUser(scheduleId, userId, guildId);
    return domainResponse ? ScheduleMapper.responseToPeristence(domainResponse) : null;
  }

  async listResponsesBySchedule(scheduleId: string, guildId: string = 'default'): Promise<Response[]> {
    const repo = this.repositoryFactory.getResponseRepository();
    const domainResponses = await repo.findByScheduleId(scheduleId, guildId);
    return domainResponses.map(response => ScheduleMapper.responseToPeristence(response));
  }

  async getScheduleSummary(scheduleId: string, guildId: string = 'default'): Promise<ScheduleSummary | null> {
    const repo = this.repositoryFactory.getResponseRepository();
    const domainSummary = await repo.getScheduleSummary(scheduleId, guildId);
    if (!domainSummary) return null;
    
    // Convert domain summary back to persistence summary
    // Convert responses array to userResponses record format
    const userResponses: Record<string, Record<string, import('../types/schedule-v2').ResponseStatus>> = {};
    for (const response of domainSummary.responses) {
      userResponses[response.userId] = response.dateStatuses as Record<string, import('../types/schedule-v2').ResponseStatus>;
    }
    
    return {
      schedule: ScheduleMapper.toPersistence(domainSummary.schedule),
      responseCounts: domainSummary.responseCounts as Record<string, Record<import('../types/schedule-v2').ResponseStatus, number>>,
      userResponses,
      totalResponses: domainSummary.totalResponseUsers
    };
  }

  // Utility methods for backward compatibility
  async getScheduleCountByGuild(guildId: string = 'default'): Promise<number> {
    const repo = this.repositoryFactory.getScheduleRepository();
    return repo.countByGuild(guildId);
  }
}
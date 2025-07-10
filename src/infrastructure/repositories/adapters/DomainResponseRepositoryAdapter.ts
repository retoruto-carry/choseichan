/**
 * Domain Response Repository Adapter
 * 
 * 既存のD1リポジトリをドメインインターフェースに適用するアダプター
 */

import { IResponseRepository } from '../../../domain/repositories/interfaces';
import { DomainResponse, DomainScheduleSummary } from '../../../domain/types/Schedule';
import { ScheduleMapper } from '../../mappers/ScheduleMapper';
import { D1ResponseRepository } from '../d1/response-repository';

export class DomainResponseRepositoryAdapter implements IResponseRepository {
  constructor(private d1Repository: D1ResponseRepository) {}

  async save(response: DomainResponse, guildId: string): Promise<void> {
    const persistenceResponse = ScheduleMapper.responseToPeristence(response);
    await this.d1Repository.save(persistenceResponse, guildId);
  }

  async findByUser(scheduleId: string, userId: string, guildId: string): Promise<DomainResponse | null> {
    const persistenceResponse = await this.d1Repository.findByUser(scheduleId, userId, guildId);
    return persistenceResponse ? ScheduleMapper.responseToDomain(persistenceResponse) : null;
  }

  async findByScheduleId(scheduleId: string, guildId: string): Promise<DomainResponse[]> {
    const persistenceResponses = await this.d1Repository.findByScheduleId(scheduleId, guildId);
    return persistenceResponses.map(response => ScheduleMapper.responseToDomain(response));
  }

  async delete(scheduleId: string, userId: string, guildId: string): Promise<void> {
    await this.d1Repository.delete(scheduleId, userId, guildId);
  }

  async deleteBySchedule(scheduleId: string, guildId: string): Promise<void> {
    await this.d1Repository.deleteBySchedule(scheduleId, guildId);
  }

  async getScheduleSummary(scheduleId: string, guildId: string): Promise<DomainScheduleSummary | null> {
    const persistenceSummary = await this.d1Repository.getScheduleSummary(scheduleId, guildId);
    if (!persistenceSummary) return null;
    
    const persistenceResponses = await this.d1Repository.findByScheduleId(scheduleId, guildId);
    return ScheduleMapper.summaryToDomain(persistenceSummary, persistenceResponses);
  }
}
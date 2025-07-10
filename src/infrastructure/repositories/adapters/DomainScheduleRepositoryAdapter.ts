/**
 * Domain Schedule Repository Adapter
 * 
 * 既存のD1リポジトリをドメインインターフェースに適用するアダプター
 */

import { IScheduleRepository } from '../../../domain/repositories/interfaces';
import { DomainSchedule } from '../../../domain/types/Schedule';
import { ScheduleMapper } from '../../mappers/ScheduleMapper';
import { D1ScheduleRepository } from '../d1/schedule-repository';

export class DomainScheduleRepositoryAdapter implements IScheduleRepository {
  constructor(private d1Repository: D1ScheduleRepository) {}

  async save(schedule: DomainSchedule): Promise<void> {
    const persistenceSchedule = ScheduleMapper.toPersistence(schedule);
    await this.d1Repository.save(persistenceSchedule);
  }

  async findById(scheduleId: string, guildId: string): Promise<DomainSchedule | null> {
    const persistenceSchedule = await this.d1Repository.findById(scheduleId, guildId);
    return persistenceSchedule ? ScheduleMapper.toDomain(persistenceSchedule) : null;
  }

  async findByChannel(channelId: string, guildId: string, limit?: number): Promise<DomainSchedule[]> {
    const persistenceSchedules = await this.d1Repository.findByChannel(channelId, guildId, limit);
    return persistenceSchedules.map(schedule => ScheduleMapper.toDomain(schedule));
  }

  async findByDeadlineRange(startTime: Date, endTime: Date, guildId?: string): Promise<DomainSchedule[]> {
    const persistenceSchedules = await this.d1Repository.findByDeadlineRange(startTime, endTime, guildId);
    return persistenceSchedules.map(schedule => ScheduleMapper.toDomain(schedule));
  }

  async delete(scheduleId: string, guildId: string): Promise<void> {
    await this.d1Repository.delete(scheduleId, guildId);
  }

  async findByMessageId(messageId: string, guildId: string): Promise<DomainSchedule | null> {
    const persistenceSchedule = await this.d1Repository.findByMessageId(messageId, guildId);
    return persistenceSchedule ? ScheduleMapper.toDomain(persistenceSchedule) : null;
  }

  async countByGuild(guildId: string): Promise<number> {
    return await this.d1Repository.countByGuild(guildId);
  }

  async updateReminders(params: {
    scheduleId: string;
    guildId: string;
    remindersSent: string[];
    reminderSent?: boolean;
  }): Promise<void> {
    await this.d1Repository.updateReminders(params);
  }
}
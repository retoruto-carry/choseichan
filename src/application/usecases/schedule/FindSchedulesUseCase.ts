/**
 * Find Schedules Use Case
 * 
 * スケジュール検索のユースケース
 */

import { IScheduleRepository } from '../../../domain/repositories/interfaces';
import { ScheduleResponse } from '../../dto/ScheduleDto';

export interface FindSchedulesByChannelUseCaseResult {
  success: boolean;
  schedules?: ScheduleResponse[];
  errors?: string[];
}

export interface FindSchedulesByDeadlineRangeUseCaseResult {
  success: boolean;
  schedules?: ScheduleResponse[];
  errors?: string[];
}

export interface FindScheduleByMessageIdUseCaseResult {
  success: boolean;
  schedule?: ScheduleResponse;
  errors?: string[];
}

export class FindSchedulesUseCase {
  constructor(
    private readonly scheduleRepository: IScheduleRepository
  ) {}

  async findByChannel(channelId: string, guildId: string, limit?: number): Promise<FindSchedulesByChannelUseCaseResult> {
    try {
      if (!channelId?.trim() || !guildId?.trim()) {
        return {
          success: false,
          errors: ['チャンネルIDとGuild IDが必要です']
        };
      }

      const schedules = await this.scheduleRepository.findByChannel(channelId, guildId, limit);
      const scheduleResponses = schedules.map(this.buildScheduleResponse);

      return {
        success: true,
        schedules: scheduleResponses
      };

    } catch (error) {
      return {
        success: false,
        errors: [`スケジュールの検索に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  async findByDeadlineRange(startTime: Date, endTime: Date, guildId?: string): Promise<FindSchedulesByDeadlineRangeUseCaseResult> {
    try {
      if (!startTime || !endTime || startTime >= endTime) {
        return {
          success: false,
          errors: ['有効な時刻範囲が必要です']
        };
      }

      const schedules = await this.scheduleRepository.findByDeadlineRange(startTime, endTime, guildId);
      const scheduleResponses = schedules.map(this.buildScheduleResponse);

      return {
        success: true,
        schedules: scheduleResponses
      };

    } catch (error) {
      return {
        success: false,
        errors: [`締切範囲でのスケジュール検索に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  async findByMessageId(messageId: string, guildId: string): Promise<FindScheduleByMessageIdUseCaseResult> {
    try {
      if (!messageId?.trim() || !guildId?.trim()) {
        return {
          success: false,
          errors: ['メッセージIDとGuild IDが必要です']
        };
      }

      const schedule = await this.scheduleRepository.findByMessageId(messageId, guildId);

      if (!schedule) {
        return {
          success: false,
          errors: ['指定されたメッセージに対応するスケジュールが見つかりません']
        };
      }

      return {
        success: true,
        schedule: this.buildScheduleResponse(schedule)
      };

    } catch (error) {
      return {
        success: false,
        errors: [`メッセージIDでのスケジュール検索に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  private buildScheduleResponse(schedule: any): ScheduleResponse {
    return {
      id: schedule.id,
      guildId: schedule.guildId,
      channelId: schedule.channelId,
      messageId: schedule.messageId,
      title: schedule.title,
      description: schedule.description,
      dates: schedule.dates,
      createdBy: schedule.createdBy,
      authorId: schedule.authorId,
      deadline: schedule.deadline?.toISOString(),
      reminderTimings: schedule.reminderTimings,
      reminderMentions: schedule.reminderMentions,
      remindersSent: schedule.remindersSent,
      status: schedule.status,
      notificationSent: schedule.notificationSent,
      totalResponses: schedule.totalResponses,
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString()
    };
  }
}
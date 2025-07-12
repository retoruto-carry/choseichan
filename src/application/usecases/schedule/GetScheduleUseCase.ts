/**
 * Get Schedule Use Case
 *
 * スケジュール取得のユースケース
 */

import type { Response } from '../../../domain/entities/Response';
import type { Schedule } from '../../../domain/entities/Schedule';
import type {
  IResponseRepository,
  IScheduleRepository,
} from '../../../domain/repositories/interfaces';
import { ResponseDomainService } from '../../../domain/services/ResponseDomainService';
import type { DomainResponse, DomainSchedule } from '../../../domain/types/DomainTypes';
import type { ResponseDto } from '../../dto/ResponseDto';
import type { ScheduleResponse, ScheduleSummaryResponse } from '../../dto/ScheduleDto';
import { ResponseMapper, ScheduleMapper } from '../../mappers/DomainMappers';

export interface GetScheduleUseCaseResult {
  success: boolean;
  schedule?: ScheduleResponse;
  errors?: string[];
}

export interface GetScheduleSummaryUseCaseResult {
  success: boolean;
  summary?: ScheduleSummaryResponse;
  errors?: string[];
}

export class GetScheduleUseCase {
  constructor(
    private readonly scheduleRepository: IScheduleRepository,
    private readonly responseRepository: IResponseRepository
  ) {}

  async execute(scheduleId: string, guildId: string): Promise<GetScheduleUseCaseResult> {
    try {
      // 1. データの基本検証
      if (!scheduleId?.trim()) {
        return {
          success: false,
          errors: ['スケジュールIDが必要です'],
        };
      }

      if (!guildId?.trim()) {
        return {
          success: false,
          errors: ['Guild IDが必要です'],
        };
      }

      // 2. スケジュールの取得
      const schedule = await this.scheduleRepository.findById(scheduleId, guildId);

      if (!schedule) {
        return {
          success: false,
          errors: ['スケジュールが見つかりません'],
        };
      }

      // 3. レスポンスの構築
      const response = this.buildScheduleResponse(schedule);

      return {
        success: true,
        schedule: response,
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          `スケジュールの取得に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };
    }
  }

  async getScheduleSummary(
    scheduleId: string,
    guildId: string
  ): Promise<GetScheduleSummaryUseCaseResult> {
    try {
      // 1. データの基本検証
      if (!scheduleId?.trim()) {
        return {
          success: false,
          errors: ['スケジュールIDが必要です'],
        };
      }

      if (!guildId?.trim()) {
        return {
          success: false,
          errors: ['Guild IDが必要です'],
        };
      }

      // 2. スケジュールの取得
      const schedule = await this.scheduleRepository.findById(scheduleId, guildId);

      if (!schedule) {
        return {
          success: false,
          errors: ['スケジュールが見つかりません'],
        };
      }

      // 3. レスポンスの取得
      const responses = await this.responseRepository.findByScheduleId(scheduleId, guildId);

      // 4. ドメインエンティティの構築
      const scheduleEntity = this.toDomainSchedule(schedule);
      const responseEntities = responses.map((r) => this.toDomainResponse(r));

      // 6. 統計情報の計算
      const dateIds = scheduleEntity.dates.map((d) => d.id);
      const statistics = ResponseDomainService.calculateResponseStatistics(
        responseEntities,
        dateIds
      );

      // 7. 最適な日程の計算
      const optimalDates = ResponseDomainService.findOptimalDates(responseEntities, dateIds);

      // 8. レスポンスカウントの計算
      const responseCounts: Record<string, { yes: number; maybe: number; no: number }> = {};
      dateIds.forEach((dateId) => {
        responseCounts[dateId] = { yes: 0, maybe: 0, no: 0 };
      });

      responseEntities.forEach((response) => {
        dateIds.forEach((dateId) => {
          const status = response.getStatusForDate(dateId);
          if (status && responseCounts[dateId]) {
            if (status.isYes()) {
              responseCounts[dateId].yes++;
            } else if (status.isMaybe()) {
              responseCounts[dateId].maybe++;
            } else if (status.isNo()) {
              responseCounts[dateId].no++;
            }
          }
        });
      });

      // 9. サマリーレスポンスの構築
      const summary: ScheduleSummaryResponse = {
        schedule: this.buildScheduleResponse(schedule),
        responses: responseEntities.map((r) => this.buildResponseDto(r)),
        responseCounts,
        totalResponseUsers: responses.length,
        bestDateId: optimalDates.optimalDateId,
        statistics: {
          overallParticipation: statistics.overallParticipation,
          optimalDates,
        },
      };

      return {
        success: true,
        summary,
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          `スケジュール詳細情報の取得に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };
    }
  }

  private buildScheduleResponse(schedule: DomainSchedule): ScheduleResponse {
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
      updatedAt: schedule.updatedAt.toISOString(),
    };
  }

  private toDomainSchedule(schedule: DomainSchedule): Schedule {
    return ScheduleMapper.toDomain(schedule);
  }

  private toDomainResponse(response: DomainResponse): Response {
    return ResponseMapper.toDomain(response);
  }

  private buildResponseDto(response: Response): ResponseDto {
    const primitives = response.toPrimitives();

    // primitives.dateStatuses はすでに文字列なので、直接変換
    const dateStatuses: Record<string, 'ok' | 'maybe' | 'ng'> = {};
    Object.entries(primitives.dateStatuses).forEach(([dateId, statusString]) => {
      if (statusString === 'ok') {
        dateStatuses[dateId] = 'ok';
      } else if (statusString === 'maybe') {
        dateStatuses[dateId] = 'maybe';
      } else if (statusString === 'ng') {
        dateStatuses[dateId] = 'ng';
      }
    });

    return {
      scheduleId: primitives.scheduleId,
      userId: primitives.user.id,
      username: primitives.user.username,
      displayName: primitives.user.displayName,
      dateStatuses,
      comment: primitives.comment,
      updatedAt: primitives.updatedAt.toISOString(),
    };
  }
}

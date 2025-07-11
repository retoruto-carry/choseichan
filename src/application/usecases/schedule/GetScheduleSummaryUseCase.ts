/**
 * Get Schedule Summary Use Case
 * 
 * スケジュール概要取得のユースケース
 */

import { IScheduleRepository, IResponseRepository } from '../../../domain/repositories/interfaces';
import { ScheduleSummaryResponse, ResponseDto } from '../../dto/ScheduleDto';

export interface GetScheduleSummaryUseCaseResult {
  success: boolean;
  summary?: ScheduleSummaryResponse;
  errors?: string[];
}

export class GetScheduleSummaryUseCase {
  constructor(
    private readonly scheduleRepository: IScheduleRepository,
    private readonly responseRepository: IResponseRepository
  ) {}

  async execute(scheduleId: string, guildId: string): Promise<GetScheduleSummaryUseCaseResult> {
    try {
      if (!scheduleId?.trim() || !guildId?.trim()) {
        return {
          success: false,
          errors: ['スケジュールIDとGuild IDが必要です']
        };
      }

      const schedule = await this.scheduleRepository.findById(scheduleId, guildId);
      
      if (!schedule) {
        return {
          success: false,
          errors: ['指定されたスケジュールが見つかりません']
        };
      }

      const responses = await this.responseRepository.findByScheduleId(scheduleId, guildId);

      // Convert DomainResponse to ResponseDto
      const responsesDtos = responses.map(response => ({
        scheduleId: response.scheduleId,
        userId: response.userId,
        username: response.username,
        displayName: response.displayName,
        dateStatuses: response.dateStatuses,
        comment: response.comment,
        updatedAt: response.updatedAt.toISOString()
      }));

      // Build summary response
      const responseCounts = this.calculateResponseCounts(schedule.dates, responsesDtos);
      const statistics = this.calculateStatistics(schedule.dates, responsesDtos);
      
      const summary: ScheduleSummaryResponse = {
        schedule: {
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
          totalResponses: responses.length,
          createdAt: schedule.createdAt.toISOString(),
          updatedAt: schedule.updatedAt.toISOString()
        },
        responses: responses.map(response => ({
          scheduleId: response.scheduleId,
          userId: response.userId,
          username: response.username,
          displayName: response.username,
          dateStatuses: this.convertResponseFormat(response.dateStatuses),
          comment: response.comment,
          updatedAt: response.updatedAt.toISOString()
        })),
        responseCounts,
        totalResponseUsers: responses.length,
        bestDateId: statistics.bestDateId,
        statistics: {
          overallParticipation: statistics.overallParticipation,
          optimalDates: statistics.optimalDates
        }
      };

      return {
        success: true,
        summary
      };

    } catch (error) {
      return {
        success: false,
        errors: [`スケジュール概要の取得に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  private convertResponseFormat(dateStatuses: Record<string, string>): Record<string, 'ok' | 'maybe' | 'ng'> {
    const converted: Record<string, 'ok' | 'maybe' | 'ng'> = {};
    
    for (const [dateId, status] of Object.entries(dateStatuses)) {
      switch (status) {
        // Current format
        case 'ok':
          converted[dateId] = 'ok';
          break;
        case 'maybe':
          converted[dateId] = 'maybe';
          break;
        case 'ng':
          converted[dateId] = 'ng';
          break;
        // Legacy format
        case 'available':
          converted[dateId] = 'ok';
          break;
        case 'unavailable':
          converted[dateId] = 'ng';
          break;
        default:
          converted[dateId] = 'ng';
      }
    }
    
    return converted;
  }

  private calculateResponseCounts(dates: Array<{id: string, datetime: string}>, responses: ResponseDto[]): Record<string, { yes: number; maybe: number; no: number }> {
    const counts: Record<string, { yes: number; maybe: number; no: number }> = {};
    
    for (const date of dates) {
      const yes = responses.filter(r => r.dateStatuses[date.id] === 'ok').length;
      const maybe = responses.filter(r => r.dateStatuses[date.id] === 'maybe').length;
      const no = responses.filter(r => r.dateStatuses[date.id] === 'ng').length;
      
      counts[date.id] = { yes, maybe, no };
    }
    
    return counts;
  }

  private calculateStatistics(dates: Array<{id: string, datetime: string}>, responses: ResponseDto[]) {
    // Calculate participation statistics
    const fullyAvailable = responses.filter(r => 
      dates.every(date => r.dateStatuses[date.id] === 'ok')
    ).length;
    
    const partiallyAvailable = responses.filter(r => 
      dates.some(date => r.dateStatuses[date.id] === 'ok') && 
      !dates.every(date => r.dateStatuses[date.id] === 'ok')
    ).length;
    
    const unavailable = responses.filter(r => 
      !dates.some(date => r.dateStatuses[date.id] === 'ok')
    ).length;

    // Calculate optimal dates
    const dateScores: Record<string, number> = {};
    let bestScore = -1;
    let bestDateId: string | undefined;
    
    for (const date of dates) {
      const available = responses.filter(r => r.dateStatuses[date.id] === 'ok').length;
      const maybe = responses.filter(r => r.dateStatuses[date.id] === 'maybe').length;
      
      // Score: 2 points for available, 1 point for maybe
      const score = available * 2 + maybe;
      dateScores[date.id] = score;
      
      if (score > bestScore) {
        bestScore = score;
        bestDateId = date.id;
      }
    }
    
    // Find alternative dates (within 80% of best score)
    const threshold = bestScore * 0.8;
    const alternativeDateIds = dates
      .filter(date => date.id !== bestDateId && dateScores[date.id] >= threshold)
      .map(date => date.id);

    return {
      bestDateId,
      overallParticipation: {
        fullyAvailable,
        partiallyAvailable,
        unavailable
      },
      optimalDates: {
        optimalDateId: bestDateId,
        alternativeDateIds,
        scores: dateScores
      }
    };
  }
}
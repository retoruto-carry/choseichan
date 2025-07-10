/**
 * Schedule Domain Mapper
 * 
 * ドメインオブジェクトと永続化オブジェクト間の変換を行う
 */

import { DomainSchedule, DomainResponse, DomainScheduleSummary, DomainUser, DomainScheduleDate, DomainResponseStatus } from '../../domain/types/Schedule';
import { Schedule, Response, ScheduleSummary, User, ScheduleDate, ResponseStatus } from '../../types/schedule-v2';

export class ScheduleMapper {
  /**
   * ドメインスケジュールから永続化スケジュールに変換
   */
  static toPersistence(domain: DomainSchedule): Schedule {
    return {
      id: domain.id,
      guildId: domain.guildId,
      channelId: domain.channelId,
      messageId: domain.messageId,
      title: domain.title,
      description: domain.description,
      dates: domain.dates.map(date => ({
        id: date.id,
        datetime: date.datetime
      })),
      createdBy: {
        id: domain.createdBy.id,
        username: domain.createdBy.username
      },
      authorId: domain.authorId,
      deadline: domain.deadline,
      reminderTimings: domain.reminderTimings,
      reminderMentions: domain.reminderMentions,
      remindersSent: domain.remindersSent,
      status: domain.status,
      notificationSent: domain.notificationSent,
      totalResponses: domain.totalResponses,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt
    };
  }

  /**
   * 永続化スケジュールからドメインスケジュールに変換
   */
  static toDomain(persistence: Schedule): DomainSchedule {
    return {
      id: persistence.id,
      guildId: persistence.guildId,
      channelId: persistence.channelId,
      messageId: persistence.messageId,
      title: persistence.title,
      description: persistence.description,
      dates: persistence.dates.map(date => ({
        id: date.id,
        datetime: date.datetime
      })),
      createdBy: {
        id: persistence.createdBy.id,
        username: persistence.createdBy.username
      },
      authorId: persistence.authorId,
      deadline: persistence.deadline,
      reminderTimings: persistence.reminderTimings,
      reminderMentions: persistence.reminderMentions,
      remindersSent: persistence.remindersSent,
      status: persistence.status,
      notificationSent: persistence.notificationSent,
      totalResponses: persistence.totalResponses,
      createdAt: persistence.createdAt,
      updatedAt: persistence.updatedAt
    };
  }

  /**
   * ドメインレスポンスから永続化レスポンスに変換
   */
  static responseToPeristence(domain: DomainResponse): Response {
    return {
      scheduleId: domain.scheduleId,
      userId: domain.userId,
      username: domain.username,
      displayName: domain.displayName,
      dateStatuses: domain.dateStatuses as Record<string, ResponseStatus>,
      comment: domain.comment,
      updatedAt: domain.updatedAt
    };
  }

  /**
   * 永続化レスポンスからドメインレスポンスに変換
   */
  static responseToDomain(persistence: Response): DomainResponse {
    return {
      scheduleId: persistence.scheduleId,
      userId: persistence.userId,
      username: persistence.username,
      displayName: persistence.displayName,
      dateStatuses: persistence.dateStatuses as Record<string, DomainResponseStatus>,
      comment: persistence.comment,
      updatedAt: persistence.updatedAt
    };
  }

  /**
   * 永続化サマリーからドメインサマリーに変換
   */
  static summaryToDomain(persistence: ScheduleSummary, responses: Response[]): DomainScheduleSummary {
    const domainResponses = responses.map(r => this.responseToDomain(r));
    
    // Calculate statistics
    const totalResponseUsers = domainResponses.length;
    const responseCounts = persistence.responseCounts as Record<string, Record<DomainResponseStatus, number>>;
    
    // Find optimal date (best date)
    let bestDateId: string | undefined;
    let maxScore = 0;
    const scores: Record<string, number> = {};
    
    for (const [dateId, counts] of Object.entries(responseCounts)) {
      const score = (counts.ok || 0) * 2 + (counts.maybe || 0) * 1 + (counts.ng || 0) * 0;
      scores[dateId] = score;
      if (score > maxScore) {
        maxScore = score;
        bestDateId = dateId;
      }
    }
    
    // Calculate participation statistics
    const fullyAvailable = domainResponses.filter(r => 
      Object.values(r.dateStatuses).every(status => status === 'ok')
    ).length;
    
    const unavailable = domainResponses.filter(r => 
      Object.values(r.dateStatuses).every(status => status === 'ng')
    ).length;
    
    const partiallyAvailable = totalResponseUsers - fullyAvailable - unavailable;
    
    const alternativeDateIds = Object.keys(scores)
      .filter(dateId => dateId !== bestDateId)
      .sort((a, b) => scores[b] - scores[a])
      .slice(0, 3);

    return {
      schedule: this.toDomain(persistence.schedule),
      responses: domainResponses,
      responseCounts,
      totalResponseUsers,
      bestDateId,
      statistics: {
        overallParticipation: {
          fullyAvailable,
          partiallyAvailable,
          unavailable
        },
        optimalDates: {
          optimalDateId: bestDateId,
          alternativeDateIds,
          scores
        }
      }
    };
  }
}
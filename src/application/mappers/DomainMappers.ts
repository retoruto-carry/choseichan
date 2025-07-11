/**
 * Domain Mappers
 * 
 * Conversion functions between domain entities and infrastructure types
 */

import { Schedule, ScheduleStatus } from '../../domain/entities/Schedule';
import { Response } from '../../domain/entities/Response';
import { User } from '../../domain/entities/User';
import { ScheduleDate } from '../../domain/entities/ScheduleDate';
import { ResponseStatus } from '../../domain/entities/ResponseStatus';
import { DomainSchedule, DomainResponse, DomainResponseStatus } from '../../domain/types/DomainTypes';

export class ScheduleMapper {
  /**
   * Convert DomainSchedule to Schedule entity
   */
  static toDomain(data: DomainSchedule): Schedule {
    const user = User.create(data.createdBy.id, data.createdBy.username);
    const dates = data.dates.map(d => ScheduleDate.create(d.id, d.datetime));
    
    return Schedule.create({
      id: data.id,
      guildId: data.guildId,
      channelId: data.channelId,
      title: data.title,
      dates,
      createdBy: user,
      authorId: data.authorId,
      messageId: data.messageId,
      description: data.description,
      deadline: data.deadline,
      reminderTimings: data.reminderTimings,
      reminderMentions: data.reminderMentions,
      remindersSent: data.remindersSent,
      status: data.status === 'open' ? ScheduleStatus.OPEN : ScheduleStatus.CLOSED,
      notificationSent: data.notificationSent,
      totalResponses: data.totalResponses,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }

  /**
   * Convert Schedule entity to DomainSchedule
   * Uses the entity's toPrimitives() method
   */
  static toLegacy(schedule: Schedule): DomainSchedule {
    return schedule.toPrimitives();
  }
}

export class ResponseMapper {
  /**
   * Convert DomainResponse to Response entity
   */
  static toDomain(data: DomainResponse): Response {
    const user = User.create(data.userId, data.username, data.displayName);
    
    // Convert string statuses to ResponseStatus objects
    const dateStatuses: Record<string, ResponseStatus> = {};
    Object.entries(data.dateStatuses).forEach(([dateId, status]) => {
      dateStatuses[dateId] = ResponseStatus.fromString(status);
    });
    
    return Response.create(
      data.scheduleId,
      user,
      dateStatuses,
      data.comment,
      data.updatedAt
    );
  }

  /**
   * Convert Response entity to DomainResponse
   * Uses the entity's toPrimitives() method
   */
  static toLegacy(response: Response): DomainResponse {
    const primitives = response.toPrimitives();
    // dateStatuses is already Record<string, string> from toPrimitives
    // Convert to Record<string, DomainResponseStatus>
    const dateStatuses: Record<string, DomainResponseStatus> = {};
    Object.entries(primitives.dateStatuses).forEach(([dateId, status]) => {
      dateStatuses[dateId] = status as DomainResponseStatus;
    });
    
    return {
      ...primitives,
      dateStatuses
    };
  }
}
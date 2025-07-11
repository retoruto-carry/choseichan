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
import { ScheduleResponse } from '../dto/ScheduleDto';
import { ResponseDto } from '../dto/ResponseDto';

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
    const dateStatuses = new Map<string, ResponseStatus>();
    Object.entries(data.dateStatuses).forEach(([dateId, status]) => {
      dateStatuses.set(dateId, ResponseStatus.fromString(status));
    });
    
    return Response.create({
      id: data.scheduleId + '-' + data.userId, // Generate ID from scheduleId and userId
      scheduleId: data.scheduleId,
      user,
      dateStatuses,
      comment: data.comment,
      updatedAt: data.updatedAt
    });
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
      scheduleId: primitives.scheduleId,
      userId: primitives.user.id,
      username: primitives.user.username,
      displayName: primitives.user.displayName,
      dateStatuses,
      comment: primitives.comment,
      updatedAt: primitives.updatedAt
    };
  }
}

// Main DomainMappers class for application layer
export class DomainMappers {
  /**
   * Convert Schedule entity to ScheduleResponse DTO
   */
  static scheduleToResponse(schedule: Schedule): ScheduleResponse {
    const primitives = schedule.toPrimitives();
    
    return {
      id: primitives.id,
      guildId: primitives.guildId,
      channelId: primitives.channelId,
      messageId: primitives.messageId,
      title: primitives.title,
      description: primitives.description,
      dates: primitives.dates.map(date => ({
        id: date.id,
        datetime: date.datetime
      })),
      createdBy: {
        id: primitives.createdBy.id,
        username: primitives.createdBy.username,
        displayName: primitives.createdBy.displayName || primitives.createdBy.username
      },
      authorId: primitives.authorId,
      deadline: primitives.deadline?.toISOString(),
      reminderTimings: primitives.reminderTimings || [],
      reminderMentions: primitives.reminderMentions || [],
      remindersSent: primitives.remindersSent || [],
      status: primitives.status,
      notificationSent: primitives.notificationSent,
      totalResponses: primitives.totalResponses,
      createdAt: primitives.createdAt.toISOString(),
      updatedAt: primitives.updatedAt.toISOString()
    };
  }

  /**
   * Convert Response entity to ResponseDto
   */
  static responseToDto(response: Response): ResponseDto {
    const primitives = response.toPrimitives();
    
    return {
      scheduleId: primitives.scheduleId,
      userId: primitives.user.id,
      username: primitives.user.username,
      displayName: primitives.user.displayName,
      dateStatuses: Object.fromEntries(
        Object.entries(primitives.dateStatuses).map(([key, value]) => [key, value as string])
      ) as Record<string, "ok" | "maybe" | "ng">,
      comment: primitives.comment,
      updatedAt: primitives.updatedAt.toISOString()
    };
  }
}
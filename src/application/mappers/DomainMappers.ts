/**
 * ドメインマッパー
 *
 * ドメインエンティティとインフラストラクチャ型間の変換関数
 */

import { Response } from '../../domain/entities/Response';
import { ResponseStatus } from '../../domain/entities/ResponseStatus';
import { Schedule, ScheduleStatus } from '../../domain/entities/Schedule';
import { ScheduleDate } from '../../domain/entities/ScheduleDate';
import { User } from '../../domain/entities/User';
import type { DomainResponse, DomainSchedule } from '../../domain/types/DomainTypes';
import type { ResponseDto } from '../dto/ResponseDto';
import type { ScheduleResponseDto } from '../dto/ScheduleDto';

/**
 * DomainScheduleをScheduleエンティティに変換
 */
export function mapDomainScheduleToEntity(data: DomainSchedule): Schedule {
  const user = User.create(data.createdBy.id, data.createdBy.username);
  const dates = data.dates.map((d) => ScheduleDate.create(d.id, d.datetime));

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
    updatedAt: data.updatedAt,
  });
}

/**
 * DomainResponseをResponseエンティティに変換
 */
export function mapDomainResponseToEntity(data: DomainResponse): Response {
  const user = User.create(data.userId, data.username, data.displayName);

  // 文字列ステータスをResponseStatusオブジェクトに変換
  const dateStatuses = new Map<string, ResponseStatus>();
  Object.entries(data.dateStatuses).forEach(([dateId, status]) => {
    dateStatuses.set(dateId, ResponseStatus.fromString(status));
  });

  return Response.create({
    id: `${data.scheduleId}-${data.userId}`, // scheduleIdとuserIdからIDを生成
    scheduleId: data.scheduleId,
    user,
    dateStatuses,
    updatedAt: data.updatedAt,
  });
}

// アプリケーション層用のメインマッパー関数

/**
 * ScheduleエンティティをScheduleResponseDto DTOに変換
 */
export function mapScheduleToResponseDto(schedule: Schedule): ScheduleResponseDto {
  const primitives = schedule.toPrimitives();

  return {
    id: primitives.id,
    guildId: primitives.guildId,
    channelId: primitives.channelId,
    messageId: primitives.messageId,
    title: primitives.title,
    description: primitives.description,
    dates: primitives.dates.map((date) => ({
      id: date.id,
      datetime: date.datetime,
    })),
    createdBy: {
      id: primitives.createdBy.id,
      username: primitives.createdBy.username,
      displayName: primitives.createdBy.displayName || primitives.createdBy.username,
    },
    authorId: primitives.authorId,
    deadline: primitives.deadline?.toISOString(),
    reminderTimings: primitives.reminderTimings,
    reminderMentions: primitives.reminderMentions,
    remindersSent: primitives.remindersSent,
    status: primitives.status,
    notificationSent: primitives.notificationSent,
    totalResponses: primitives.totalResponses,
    createdAt: primitives.createdAt.toISOString(),
    updatedAt: primitives.updatedAt.toISOString(),
  };
}

/**
 * ResponseエンティティをResponseDtoに変換
 */
export function mapResponseToDto(response: Response): ResponseDto {
  const primitives = response.toPrimitives();

  return {
    scheduleId: primitives.scheduleId,
    userId: primitives.user.id,
    username: primitives.user.username,
    displayName: primitives.user.displayName,
    dateStatuses: Object.fromEntries(
      Object.entries(primitives.dateStatuses).map(([key, value]) => [key, value as string])
    ) as Record<string, 'ok' | 'maybe' | 'ng'>,
    updatedAt: primitives.updatedAt.toISOString(),
  };
}

/**
 * スケジュールマッパークラス
 * Clean Architecture のユースケースで使用
 */
export class ScheduleMapper {
  static scheduleToResponseDto(schedule: Schedule): ScheduleResponseDto {
    return mapScheduleToResponseDto(schedule);
  }

  static toDomain(data: DomainSchedule): Schedule {
    return mapDomainScheduleToEntity(data);
  }
}

/**
 * レスポンスマッパークラス
 * Clean Architecture のユースケースで使用
 */
export class ResponseMapper {
  static responseToDto(response: Response): ResponseDto {
    return mapResponseToDto(response);
  }

  static toDomain(data: DomainResponse): Response {
    return mapDomainResponseToEntity(data);
  }
}

/**
 * ドメインマッパー統合クラス
 * テストで使用
 */
export class DomainMappers {
  static scheduleToResponseDto(schedule: Schedule): ScheduleResponseDto {
    return mapScheduleToResponseDto(schedule);
  }

  static responseToDto(response: Response): ResponseDto {
    return mapResponseToDto(response);
  }
}

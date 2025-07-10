/**
 * Schedule Mapper
 * 
 * レガシー型とドメインエンティティ間の変換を行う
 */

import { Schedule as ScheduleEntity, ScheduleStatus } from '../../domain/entities/Schedule';
import { User as UserEntity } from '../../domain/entities/User';
import { ScheduleDate as ScheduleDateEntity } from '../../domain/entities/ScheduleDate';
import { Schedule as ScheduleLegacy } from '../../types/schedule-v2';

export class ScheduleMapper {
  /**
   * レガシー型からドメインエンティティに変換
   */
  static toDomain(legacy: ScheduleLegacy): ScheduleEntity {
    const user = UserEntity.create(
      legacy.createdBy.id,
      legacy.createdBy.username
    );

    const dates = legacy.dates.map(d => 
      ScheduleDateEntity.create(d.id, d.datetime)
    );

    return ScheduleEntity.create({
      id: legacy.id,
      guildId: legacy.guildId,
      channelId: legacy.channelId,
      title: legacy.title,
      description: legacy.description,
      dates,
      createdBy: user,
      authorId: legacy.authorId,
      deadline: legacy.deadline,
      reminderTimings: legacy.reminderTimings,
      reminderMentions: legacy.reminderMentions,
      remindersSent: legacy.remindersSent,
      status: legacy.status === 'open' ? ScheduleStatus.OPEN : ScheduleStatus.CLOSED,
      notificationSent: legacy.notificationSent,
      totalResponses: legacy.totalResponses,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
      messageId: legacy.messageId
    });
  }

  /**
   * ドメインエンティティからレガシー型に変換
   */
  static toLegacy(domain: ScheduleEntity): ScheduleLegacy {
    const primitives = domain.toPrimitives();
    
    return {
      id: primitives.id,
      guildId: primitives.guildId,
      channelId: primitives.channelId,
      messageId: primitives.messageId,
      title: primitives.title,
      description: primitives.description,
      dates: primitives.dates,
      createdBy: primitives.createdBy,
      authorId: primitives.authorId,
      deadline: primitives.deadline,
      reminderTimings: primitives.reminderTimings,
      reminderMentions: primitives.reminderMentions,
      remindersSent: primitives.remindersSent,
      status: primitives.status,
      notificationSent: primitives.notificationSent,
      totalResponses: primitives.totalResponses,
      createdAt: primitives.createdAt,
      updatedAt: primitives.updatedAt
    };
  }
}
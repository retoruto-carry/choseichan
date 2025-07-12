/**
 * Close Schedule Use Case
 *
 * スケジュール締め切りのユースケース
 * 認可チェックとビジネスルールの検証を実行
 */

import { ERROR_MESSAGES } from '../../../constants/ApplicationConstants';
import type { Schedule } from '../../../domain/entities/Schedule';
import type { IScheduleRepository } from '../../../domain/repositories/interfaces';
import { ScheduleDomainService } from '../../../domain/services/ScheduleDomainService';
import type { CloseScheduleRequest, ScheduleResponse } from '../../dto/ScheduleDto';
import { ScheduleMapper } from '../../mappers/DomainMappers';

export interface CloseScheduleUseCaseResult {
  success: boolean;
  schedule?: ScheduleResponse;
  errors?: string[];
}

export class CloseScheduleUseCase {
  constructor(private readonly scheduleRepository: IScheduleRepository) {}

  async execute(request: CloseScheduleRequest): Promise<CloseScheduleUseCaseResult> {
    try {
      // 1. データの基本検証
      const basicValidation = this.validateBasicData(request);
      if (!basicValidation.isValid) {
        return {
          success: false,
          errors: basicValidation.errors,
        };
      }

      // 2. 既存スケジュールの取得
      const existingSchedule = await this.scheduleRepository.findById(
        request.scheduleId,
        request.guildId
      );

      if (!existingSchedule) {
        return {
          success: false,
          errors: [ERROR_MESSAGES.SCHEDULE_NOT_FOUND],
        };
      }

      // 3. スケジュールエンティティの構築
      const scheduleEntity = ScheduleMapper.toDomain(existingSchedule);

      // 4. 編集権限の確認 (システム操作は編集権限をバイパス)
      if (request.editorUserId !== 'system') {
        const editPermission = ScheduleDomainService.canEditSchedule(
          scheduleEntity,
          request.editorUserId
        );

        if (!editPermission.canEdit) {
          return {
            success: false,
            errors: [ERROR_MESSAGES.PERMISSION_DENIED],
          };
        }
      }

      // 5. 既に締め切られているかチェック
      if (scheduleEntity.isClosed()) {
        return {
          success: false,
          errors: [ERROR_MESSAGES.SCHEDULE_CLOSED],
        };
      }

      // 6. スケジュールの締め切り
      const closedSchedule = scheduleEntity.close();

      // 7. リポジトリへの保存
      await this.scheduleRepository.save(closedSchedule.toPrimitives());

      // 8. レスポンスの構築
      const response = this.buildResponse(closedSchedule);

      return {
        success: true,
        schedule: response,
      };
    } catch (_error) {
      return {
        success: false,
        errors: [ERROR_MESSAGES.INTERNAL_ERROR],
      };
    }
  }

  private validateBasicData(request: CloseScheduleRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.scheduleId?.trim()) {
      errors.push(ERROR_MESSAGES.INVALID_INPUT);
    }

    if (!request.guildId?.trim()) {
      errors.push(ERROR_MESSAGES.INVALID_INPUT);
    }

    if (!request.editorUserId?.trim()) {
      errors.push(ERROR_MESSAGES.INVALID_INPUT);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private buildResponse(schedule: Schedule): ScheduleResponse {
    const primitives = schedule.toPrimitives();

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
}

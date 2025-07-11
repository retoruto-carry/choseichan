/**
 * Update Schedule Use Case
 * 
 * スケジュール更新のユースケース
 * 認可チェックとビジネスルールの検証を実行
 */

import { Schedule } from '../../../domain/entities/Schedule';
import { ScheduleDate } from '../../../domain/entities/ScheduleDate';
import { ScheduleDomainService } from '../../../domain/services/ScheduleDomainService';
import { IScheduleRepository } from '../../../domain/repositories/interfaces';
import { UpdateScheduleRequest, ScheduleResponse } from '../../dto/ScheduleDto';
import { ScheduleMapper } from '../../mappers/DomainMappers';

export interface UpdateScheduleUseCaseResult {
  success: boolean;
  schedule?: ScheduleResponse;
  errors?: string[];
}

export class UpdateScheduleUseCase {
  constructor(
    private readonly scheduleRepository: IScheduleRepository
  ) {}

  async execute(request: UpdateScheduleRequest): Promise<UpdateScheduleUseCaseResult> {
    try {
      // 1. データの基本検証
      const basicValidation = this.validateBasicData(request);
      if (!basicValidation.isValid) {
        return {
          success: false,
          errors: basicValidation.errors
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
          errors: ['スケジュールが見つかりません']
        };
      }

      // 3. スケジュールエンティティの構築
      const scheduleEntity = ScheduleMapper.toDomain(existingSchedule);

      // 4. 編集権限の確認
      if (!scheduleEntity.canBeEditedBy(request.editorUserId)) {
        return {
          success: false,
          errors: ['このスケジュールを編集する権限がありません']
        };
      }

      // 5. ドメインサービスによる業務ルール検証
      const domainValidation = ScheduleDomainService.validateScheduleForUpdate({
        schedule: scheduleEntity,
        title: request.title,
        description: request.description,
        deadline: request.deadline ? new Date(request.deadline) : undefined
      });

      if (!domainValidation.isValid) {
        return {
          success: false,
          errors: domainValidation.errors
        };
      }

      // 6. スケジュールの更新
      let updatedSchedule = scheduleEntity;
      
      if (request.title !== undefined) {
        updatedSchedule = updatedSchedule.updateTitle(request.title);
      }
      
      if (request.description !== undefined) {
        updatedSchedule = updatedSchedule.updateDescription(request.description);
      }
      
      if (request.deadline !== undefined) {
        const deadline = request.deadline === null ? null : new Date(request.deadline);
        updatedSchedule = updatedSchedule.updateDeadline(deadline);
      }

      if (request.messageId !== undefined) {
        updatedSchedule = updatedSchedule.updateMessageId(request.messageId);
      }

      if (request.dates !== undefined) {
        const scheduleDates = request.dates.map(d => ScheduleDate.create(d.id, d.datetime));
        updatedSchedule = updatedSchedule.updateDates(scheduleDates);
      }

      if (request.reminderTimings !== undefined || request.reminderMentions !== undefined) {
        updatedSchedule = updatedSchedule.updateReminderSettings(
          request.reminderTimings,
          request.reminderMentions
        );
      }

      if (request.reminderStates !== undefined) {
        updatedSchedule = updatedSchedule.resetReminders();
      }

      // 7. リポジトリへの保存
      await this.scheduleRepository.save(updatedSchedule.toPrimitives());

      // 8. レスポンスの構築
      const response = this.buildResponse(updatedSchedule);

      return {
        success: true,
        schedule: response
      };

    } catch (error) {
      return {
        success: false,
        errors: [`スケジュールの更新に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  private validateBasicData(request: UpdateScheduleRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.scheduleId?.trim()) {
      errors.push('スケジュールIDが必要です');
    }

    if (!request.guildId?.trim()) {
      errors.push('Guild IDが必要です');
    }

    if (!request.editorUserId?.trim()) {
      errors.push('編集者IDが必要です');
    }

    // タイトルが指定されている場合の検証
    if (request.title !== undefined && !request.title.trim()) {
      errors.push('タイトルが空です');
    }

    // 締切日時の検証
    if (request.deadline !== undefined && request.deadline !== null) {
      const deadline = new Date(request.deadline);
      if (isNaN(deadline.getTime())) {
        errors.push('締切日時の形式が正しくありません');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
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
      updatedAt: primitives.updatedAt.toISOString()
    };
  }
}
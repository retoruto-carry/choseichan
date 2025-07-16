/**
 * Create Schedule Use Case
 *
 * スケジュール作成のユースケース
 * ビジネスルールの検証とスケジュール作成処理を実行
 */

import { Schedule } from '../../../domain/entities/Schedule';
import { ScheduleDate } from '../../../domain/entities/ScheduleDate';
import { User } from '../../../domain/entities/User';
import type { IScheduleRepository } from '../../../domain/repositories/interfaces';
import { ScheduleDomainService } from '../../../domain/services/ScheduleDomainService';
import { generateId } from '../../../domain/utils/id';
import { ERROR_MESSAGES } from '../../constants/ApplicationConstants';
import type { CreateScheduleRequestDto, ScheduleResponseDto } from '../../dto/ScheduleDto';
import type { ILogger } from '../../ports/LoggerPort';

export interface CreateScheduleUseCaseResult {
  success: boolean;
  schedule?: ScheduleResponseDto;
  errors?: string[];
}

export class CreateScheduleUseCase {
  constructor(
    private readonly scheduleRepository: IScheduleRepository,
    private readonly logger: ILogger
  ) {}

  async execute(request: CreateScheduleRequestDto): Promise<CreateScheduleUseCaseResult> {
    try {
      // 1. データの基本検証
      const basicValidation = this.validateBasicData(request);
      if (!basicValidation.isValid) {
        return {
          success: false,
          errors: basicValidation.errors,
        };
      }

      // 2. ドメインオブジェクトの構築
      const user = User.create(request.authorId, request.authorUsername, request.authorDisplayName);

      const dates = request.dates.map((dateData) =>
        ScheduleDate.create(dateData.id, dateData.datetime)
      );

      const deadline = request.deadline ? new Date(request.deadline) : undefined;

      // 3. ドメインサービスによる業務ルール検証
      const domainValidation = ScheduleDomainService.validateScheduleForCreation({
        title: request.title,
        dates,
        deadline,
      });

      if (!domainValidation.isValid) {
        return {
          success: false,
          errors: domainValidation.errors,
        };
      }

      // 4. スケジュールエンティティの作成
      const schedule = Schedule.create({
        id: generateId(),
        guildId: request.guildId,
        channelId: request.channelId,
        title: request.title,
        description: request.description,
        dates,
        createdBy: user,
        authorId: request.authorId,
        deadline,
        reminderTimings: request.reminderTimings,
        reminderMentions: request.reminderMentions,
      });

      // 5. リポジトリへの保存
      await this.scheduleRepository.save(schedule.toPrimitives());

      // 6. レスポンスの構築
      const response = this.buildResponse(schedule);

      return {
        success: true,
        schedule: response,
      };
    } catch (error) {
      this.logger.error(
        'CreateScheduleUseCase error',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'create-schedule',
          useCase: 'CreateScheduleUseCase',
        }
      );
      return {
        success: false,
        errors: [ERROR_MESSAGES.INTERNAL_ERROR],
      };
    }
  }

  private validateBasicData(request: CreateScheduleRequestDto): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!request.guildId?.trim()) {
      errors.push('Guild IDが必要です');
    }

    if (!request.channelId?.trim()) {
      errors.push('Channel IDが必要です');
    }

    if (!request.authorId?.trim()) {
      errors.push('作成者IDが必要です');
    }

    if (!request.authorUsername?.trim()) {
      errors.push('作成者名が必要です');
    }

    if (!request.title?.trim()) {
      errors.push('タイトルが必要です');
    }

    if (!request.dates || request.dates.length === 0) {
      errors.push('日程候補が必要です');
    } else {
      // 各日程候補の検証
      request.dates.forEach((date, index) => {
        if (!date.id?.trim()) {
          errors.push(`日程候補${index + 1}: IDが必要です`);
        }
        if (!date.datetime?.trim()) {
          errors.push(`日程候補${index + 1}: 日時が必要です`);
        }
        // 日時の形式は自由なのでバリデーションしない
      });
    }

    // 締切日時の検証
    if (request.deadline) {
      const deadline = new Date(request.deadline);
      if (Number.isNaN(deadline.getTime())) {
        errors.push('締切日時の形式が正しくありません');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private buildResponse(schedule: Schedule): ScheduleResponseDto {
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

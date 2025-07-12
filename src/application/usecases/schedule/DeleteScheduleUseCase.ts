/**
 * Delete Schedule Use Case
 *
 * スケジュールの削除ユースケース
 */

import type {
  IResponseRepository,
  IScheduleRepository,
} from '../../../domain/repositories/interfaces';
import { ScheduleMapper } from '../../mappers/DomainMappers';

export interface DeleteScheduleRequest {
  scheduleId: string;
  guildId: string;
  deletedByUserId: string;
}

export interface DeleteScheduleUseCaseResult {
  success: boolean;
  deletedSchedule?: {
    id: string;
    title: string;
    channelId: string;
    responseCount: number;
  };
  errors?: string[];
}

export class DeleteScheduleUseCase {
  constructor(
    private readonly scheduleRepository: IScheduleRepository,
    private readonly responseRepository: IResponseRepository
  ) {}

  async execute(request: DeleteScheduleRequest): Promise<DeleteScheduleUseCaseResult> {
    try {
      // 1. 入力検証
      const validation = this.validateRequest(request);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }

      // 2. スケジュールの取得
      const scheduleData = await this.scheduleRepository.findById(
        request.scheduleId,
        request.guildId
      );

      if (!scheduleData) {
        return {
          success: false,
          errors: ['スケジュールが見つかりません'],
        };
      }

      // 3. ドメインエンティティに変換
      const schedule = ScheduleMapper.toDomain(scheduleData);

      // 4. 権限チェック
      if (!schedule.canBeEditedBy(request.deletedByUserId)) {
        return {
          success: false,
          errors: ['このスケジュールを削除する権限がありません'],
        };
      }

      // 5. 削除前の情報を保存
      const deletedSchedule = {
        id: schedule.id,
        title: schedule.title,
        channelId: schedule.channelId,
        responseCount: schedule.totalResponses,
      };

      // 6. 関連する回答データの削除
      await this.responseRepository.deleteBySchedule(request.scheduleId, request.guildId);

      // 7. スケジュールの削除
      await this.scheduleRepository.delete(request.scheduleId, request.guildId);

      return {
        success: true,
        deletedSchedule,
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          `スケジュールの削除に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };
    }
  }

  private validateRequest(request: DeleteScheduleRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.scheduleId?.trim()) {
      errors.push('スケジュールIDが必要です');
    }

    if (!request.guildId?.trim()) {
      errors.push('Guild IDが必要です');
    }

    if (!request.deletedByUserId?.trim()) {
      errors.push('削除者IDが必要です');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Reopen Schedule Use Case
 *
 * スケジュールの再開ユースケース
 */

import type { IScheduleRepository } from '../../../domain/repositories/interfaces';
import type { ScheduleResponse } from '../../dto/ScheduleDto';
import { ScheduleMapper } from '../../mappers/DomainMappers';

export interface ReopenScheduleRequest {
  scheduleId: string;
  guildId: string;
  editorUserId: string;
}

export interface ReopenScheduleUseCaseResult {
  success: boolean;
  schedule?: ScheduleResponse;
  errors?: string[];
}

export class ReopenScheduleUseCase {
  constructor(private readonly scheduleRepository: IScheduleRepository) {}

  async execute(request: ReopenScheduleRequest): Promise<ReopenScheduleUseCaseResult> {
    try {
      // 1. 入力検証
      if (
        !request.scheduleId?.trim() ||
        !request.guildId?.trim() ||
        !request.editorUserId?.trim()
      ) {
        return {
          success: false,
          errors: ['必須パラメータが不足しています'],
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
          errors: ['指定されたスケジュールが見つかりません'],
        };
      }

      // 3. ドメインエンティティに変換
      const schedule = ScheduleMapper.toDomain(scheduleData);

      // 4. 権限チェック
      if (!schedule.canBeEditedBy(request.editorUserId)) {
        return {
          success: false,
          errors: ['このスケジュールを再開する権限がありません'],
        };
      }

      // 5. スケジュールの再開
      const reopenedSchedule = schedule.reopen();

      // 6. リポジトリへの保存
      await this.scheduleRepository.save(reopenedSchedule.toPrimitives());

      // 7. レスポンスの構築
      const response = ScheduleMapper.scheduleToResponse(reopenedSchedule);

      return {
        success: true,
        schedule: response,
      };
    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'スケジュールの再開に失敗しました'],
      };
    }
  }
}

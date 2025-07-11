/**
 * Delete Schedule Use Case
 * 
 * スケジュールの削除ユースケース
 */

import { IScheduleRepository, IResponseRepository } from '../../../domain/repositories/interfaces';
import { Schedule } from '../../../domain/entities/Schedule';
import { ScheduleMapper } from '../../mappers/DomainMappers';

export interface DeleteScheduleRequest {
  scheduleId: string;
  guildId: string;
  editorUserId: string;
}

export interface DeleteScheduleUseCaseResult {
  success: boolean;
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
      if (!request.scheduleId?.trim() || !request.guildId?.trim() || !request.editorUserId?.trim()) {
        return {
          success: false,
          errors: ['必須パラメータが不足しています']
        };
      }

      // 2. スケジュールの取得
      const scheduleData = await this.scheduleRepository.findById(request.scheduleId, request.guildId);
      
      if (!scheduleData) {
        return {
          success: false,
          errors: ['指定されたスケジュールが見つかりません']
        };
      }

      // 3. ドメインエンティティに変換
      const schedule = ScheduleMapper.toDomain(scheduleData);

      // 4. 権限チェック
      if (!schedule.canBeEditedBy(request.editorUserId)) {
        return {
          success: false,
          errors: ['このスケジュールを削除する権限がありません']
        };
      }

      // 5. 関連する回答データの削除
      await this.responseRepository.deleteBySchedule(request.scheduleId, request.guildId);

      // 6. スケジュールの削除
      await this.scheduleRepository.delete(request.scheduleId, request.guildId);

      return {
        success: true
      };

    } catch (error) {
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'スケジュールの削除に失敗しました']
      };
    }
  }
}
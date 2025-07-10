/**
 * Submit Response Use Case
 * 
 * レスポンス投稿のユースケース
 * ビジネスルールの検証とレスポンス作成処理を実行
 */

import { Schedule } from '../../../domain/entities/Schedule';
import { Response } from '../../../domain/entities/Response';
import { User } from '../../../domain/entities/User';
import { ResponseStatus } from '../../../domain/entities/ResponseStatus';
import { ResponseDomainService, UserResponseData } from '../../../domain/services/ResponseDomainService';
import { IScheduleRepository, IResponseRepository } from '../../../domain/repositories/interfaces';
import { SubmitResponseRequest, ResponseSubmissionResult, ResponseDto } from '../../dto/ResponseDto';
import { ScheduleMapper } from '../../mappers/ScheduleMapper';
import { ResponseMapper } from '../../mappers/ResponseMapper';

export class SubmitResponseUseCase {
  constructor(
    private readonly scheduleRepository: IScheduleRepository,
    private readonly responseRepository: IResponseRepository
  ) {}

  async execute(request: SubmitResponseRequest): Promise<ResponseSubmissionResult> {
    try {
      // 1. データの基本検証
      const basicValidation = this.validateBasicData(request);
      if (!basicValidation.isValid) {
        return {
          success: false,
          response: {} as ResponseDto,
          isNewResponse: false,
          errors: basicValidation.errors
        };
      }

      // 2. スケジュールの取得
      const schedule = await this.scheduleRepository.findById(
        request.scheduleId,
        request.guildId
      );

      if (!schedule) {
        return {
          success: false,
          response: {} as ResponseDto,
          isNewResponse: false,
          errors: ['スケジュールが見つかりません']
        };
      }

      // 3. スケジュールエンティティの構築
      const scheduleEntity = ScheduleMapper.toDomain(schedule);

      // 4. 既存のレスポンスを取得
      const existingResponseData = await this.responseRepository.findByUser(
        request.scheduleId,
        request.userId,
        request.guildId
      );

      const existingResponse = existingResponseData 
        ? ResponseMapper.toDomain(existingResponseData)
        : undefined;

      // 5. ユーザーオブジェクトの作成
      const user = User.create(
        request.userId,
        request.username,
        request.displayName
      );

      // 6. レスポンスデータの変換
      const responseData: UserResponseData[] = request.responses.map(r => ({
        dateId: r.dateId,
        status: ResponseStatus.fromString(r.status)
      }));

      // 7. ドメインサービスによる業務ルール検証
      const domainValidation = ResponseDomainService.validateResponse(
        scheduleEntity,
        responseData,
        request.comment
      );

      if (!domainValidation.isValid) {
        return {
          success: false,
          response: {} as ResponseDto,
          isNewResponse: false,
          errors: domainValidation.errors
        };
      }

      // 8. レスポンスの作成・更新
      const response = ResponseDomainService.createOrUpdateResponse(
        request.scheduleId,
        user,
        responseData,
        request.comment,
        existingResponse
      );

      // 9. リポジトリへの保存
      await this.responseRepository.save(ResponseMapper.toLegacy(response), request.guildId);

      // 10. スケジュールの総回答数を更新
      const allResponses = await this.responseRepository.findByScheduleId(
        request.scheduleId,
        request.guildId
      );
      
      const updatedSchedule = scheduleEntity.updateTotalResponses(allResponses.length);
      await this.scheduleRepository.save(ScheduleMapper.toLegacy(updatedSchedule));

      // 11. レスポンスの構築
      const responseDto = this.buildResponseDto(response);

      return {
        success: true,
        response: responseDto,
        isNewResponse: !existingResponse
      };

    } catch (error) {
      return {
        success: false,
        response: {} as ResponseDto,
        isNewResponse: false,
        errors: [`レスポンスの投稿に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  private validateBasicData(request: SubmitResponseRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.scheduleId?.trim()) {
      errors.push('スケジュールIDが必要です');
    }

    if (!request.guildId?.trim()) {
      errors.push('Guild IDが必要です');
    }

    if (!request.userId?.trim()) {
      errors.push('ユーザーIDが必要です');
    }

    if (!request.username?.trim()) {
      errors.push('ユーザー名が必要です');
    }

    if (!request.responses || request.responses.length === 0) {
      errors.push('レスポンスが必要です');
    } else {
      // 各レスポンスの検証
      request.responses.forEach((response, index) => {
        if (!response.dateId?.trim()) {
          errors.push(`レスポンス${index + 1}: 日程IDが必要です`);
        }
        if (!['ok', 'maybe', 'ng'].includes(response.status)) {
          errors.push(`レスポンス${index + 1}: 無効なステータスです`);
        }
      });
    }

    // コメント長さチェック
    if (request.comment && request.comment.length > 500) {
      errors.push('コメントは500文字以内で入力してください');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private buildResponseDto(response: Response): ResponseDto {
    const primitives = response.toPrimitives();
    
    // primitives.dateStatuses はすでに文字列なので、ResponseStatus型に変換
    const dateStatuses: Record<string, 'ok' | 'maybe' | 'ng'> = {};
    Object.entries(primitives.dateStatuses).forEach(([dateId, statusString]) => {
      // statusString は stringValue から来ているので、直接変換
      if (statusString === 'ok') {
        dateStatuses[dateId] = 'ok';
      } else if (statusString === 'maybe') {
        dateStatuses[dateId] = 'maybe';
      } else if (statusString === 'ng') {
        dateStatuses[dateId] = 'ng';
      }
    });

    return {
      scheduleId: primitives.scheduleId,
      userId: primitives.userId,
      username: primitives.username,
      displayName: primitives.displayName,
      dateStatuses,
      comment: primitives.comment,
      updatedAt: primitives.updatedAt.toISOString()
    };
  }
}
/**
 * Update Response Use Case
 *
 * レスポンス更新のユースケース
 * ビジネスルールの検証とレスポンス更新処理を実行
 */

import type { Response } from '../../../domain/entities/Response';
import { ResponseStatus } from '../../../domain/entities/ResponseStatus';
import type {
  IResponseRepository,
  IScheduleRepository,
} from '../../../domain/repositories/interfaces';
import {
  ResponseDomainService,
  type UserResponseData,
} from '../../../domain/services/ResponseDomainService';
import type { DomainResponse, DomainResponseStatus } from '../../../domain/types/DomainTypes';
import type {
  ResponseDto,
  ResponseSubmissionResult,
  UpdateResponseRequest,
} from '../../dto/ResponseDto';
import { ResponseMapper, ScheduleMapper } from '../../mappers/DomainMappers';

export class UpdateResponseUseCase {
  constructor(
    private readonly scheduleRepository: IScheduleRepository,
    private readonly responseRepository: IResponseRepository
  ) {}

  async execute(request: UpdateResponseRequest): Promise<ResponseSubmissionResult> {
    try {
      // 1. データの基本検証
      const basicValidation = this.validateBasicData(request);
      if (!basicValidation.isValid) {
        return {
          success: false,
          response: {} as ResponseDto,
          isNewResponse: false,
          errors: basicValidation.errors,
        };
      }

      // 2. スケジュールの取得
      const schedule = await this.scheduleRepository.findById(request.scheduleId, request.guildId);

      if (!schedule) {
        return {
          success: false,
          response: {} as ResponseDto,
          isNewResponse: false,
          errors: ['スケジュールが見つかりません'],
        };
      }

      // 3. 既存レスポンスの取得
      const existingResponseData = await this.responseRepository.findByUser(
        request.scheduleId,
        request.userId,
        request.guildId
      );

      if (!existingResponseData) {
        return {
          success: false,
          response: {} as ResponseDto,
          isNewResponse: false,
          errors: ['更新対象のレスポンスが見つかりません'],
        };
      }

      // 4. エンティティの構築
      const scheduleEntity = ScheduleMapper.toDomain(schedule);
      const existingResponse = ResponseMapper.toDomain(existingResponseData);

      // 5. ユーザーオブジェクトの作成（既存レスポンスから取得）
      const _user = existingResponse.user;

      // 6. 更新するレスポンスデータの変換
      let responseData: UserResponseData[] = [];
      if (request.responses) {
        responseData = request.responses.map((r) => ({
          dateId: r.dateId,
          status: ResponseStatus.fromString(r.status),
        }));

        // 7. ドメインサービスによる業務ルール検証
        const domainValidation = ResponseDomainService.validateResponse(
          scheduleEntity,
          responseData
        );

        if (!domainValidation.isValid) {
          return {
            success: false,
            response: {} as ResponseDto,
            isNewResponse: false,
            errors: domainValidation.errors,
          };
        }
      }

      // 8. レスポンスの更新
      let updatedResponse = existingResponse;

      // レスポンスデータの更新
      if (request.responses) {
        const newStatuses = new Map<string, ResponseStatus>();
        responseData.forEach((data) => {
          newStatuses.set(data.dateId, data.status);
        });
        updatedResponse = updatedResponse.updateStatuses(newStatuses);
      }

      // 9. リポジトリへの保存
      const primitives = updatedResponse.toPrimitives();
      const domainResponse: DomainResponse = {
        scheduleId: primitives.scheduleId,
        userId: primitives.user.id,
        username: primitives.user.username,
        displayName: primitives.user.displayName,
        dateStatuses: primitives.dateStatuses as Record<string, DomainResponseStatus>,
        updatedAt: primitives.updatedAt,
      };
      await this.responseRepository.save(domainResponse, request.guildId);

      // 10. レスポンスの構築
      const responseDto = this.buildResponseDto(updatedResponse);

      return {
        success: true,
        response: responseDto,
        isNewResponse: false,
      };
    } catch (error) {
      return {
        success: false,
        response: {} as ResponseDto,
        isNewResponse: false,
        errors: [
          `レスポンスの更新に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };
    }
  }

  private validateBasicData(request: UpdateResponseRequest): {
    isValid: boolean;
    errors: string[];
  } {
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

    // レスポンスが指定されている場合のみ検証
    if (request.responses) {
      if (request.responses.length === 0) {
        errors.push('レスポンスが空です');
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
    }

    // レスポンスが指定されていない場合
    if (!request.responses) {
      errors.push('更新内容が指定されていません');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private buildResponseDto(response: Response): ResponseDto {
    return ResponseMapper.responseToDto(response);
  }
}

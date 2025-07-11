/**
 * Get Response Use Case
 * 
 * レスポンス取得のユースケース
 */

import { Response } from '../../../domain/entities/Response';
import { IResponseRepository } from '../../../domain/repositories/interfaces';
import { GetResponseRequest, ResponseDto, ResponseStatistics } from '../../dto/ResponseDto';
import { ResponseDomainService } from '../../../domain/services/ResponseDomainService';
import { DomainResponse } from '../../../domain/types/DomainTypes';
import { ResponseMapper } from '../../mappers/DomainMappers';

export interface GetResponseUseCaseResult {
  success: boolean;
  response?: ResponseDto;
  errors?: string[];
}

export interface GetAllResponsesUseCaseResult {
  success: boolean;
  responses?: ResponseDto[];
  statistics?: ResponseStatistics;
  errors?: string[];
}

export class GetResponseUseCase {
  constructor(
    private readonly responseRepository: IResponseRepository
  ) {}

  /**
   * 特定ユーザーのレスポンスを取得
   */
  async execute(request: GetResponseRequest): Promise<GetResponseUseCaseResult> {
    try {
      // 1. データの基本検証
      const basicValidation = this.validateBasicData(request);
      if (!basicValidation.isValid) {
        return {
          success: false,
          errors: basicValidation.errors
        };
      }

      if (!request.userId) {
        return {
          success: false,
          errors: ['ユーザーIDが必要です']
        };
      }

      // 2. レスポンスの取得
      const responseData = await this.responseRepository.findByUser(
        request.scheduleId,
        request.userId,
        request.guildId
      );

      if (!responseData) {
        return {
          success: false,
          errors: ['レスポンスが見つかりません']
        };
      }

      // 3. レスポンスの構築
      const responseEntity = this.toDomainResponse(responseData);
      const responseDto = this.buildResponseDto(responseEntity);

      return {
        success: true,
        response: responseDto
      };

    } catch (error) {
      return {
        success: false,
        errors: [`レスポンスの取得に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * スケジュールの全レスポンスを取得（統計情報付き）
   */
  async getAllResponses(request: GetResponseRequest): Promise<GetAllResponsesUseCaseResult> {
    try {
      // 1. データの基本検証
      const basicValidation = this.validateBasicData(request);
      if (!basicValidation.isValid) {
        return {
          success: false,
          errors: basicValidation.errors
        };
      }

      // 2. 全レスポンスの取得
      const responsesData = await this.responseRepository.findByScheduleId(
        request.scheduleId,
        request.guildId
      );

      // 3. レスポンスDTOの構築
      const responseEntities = responsesData.map(r => this.toDomainResponse(r));
      const responses = responseEntities.map((r: Response) => this.buildResponseDto(r));

      // 4. 統計情報の計算
      let statistics: ResponseStatistics | undefined;
      
      if (responses.length > 0) {
        // 日程IDの抽出（最初のレスポンスから）
        const dateIds = Object.keys(responses[0].dateStatuses);
        
        // レスポンスエンティティはすでに上で構築済み
        
        // 統計情報の計算
        const responseStats = ResponseDomainService.calculateResponseStatistics(
          responseEntities,
          dateIds
        );

        // 最適な日程の計算
        const optimalDates = ResponseDomainService.findOptimalDates(
          responseEntities,
          dateIds
        );

        // 日程別の詳細な統計
        const responsesByDate: Record<string, {
          yes: number;
          maybe: number;
          no: number;
          total: number;
          percentage: {
            yes: number;
            maybe: number;
            no: number;
          };
        }> = {};

        Object.entries(responseStats.responsesByDate).forEach(([dateId, counts]) => {
          const total = counts.total || 1; // ゼロ除算を避ける
          responsesByDate[dateId] = {
            yes: counts.yes,
            maybe: counts.maybe,
            no: counts.no,
            total: counts.total,
            percentage: {
              yes: Math.round((counts.yes / total) * 100),
              maybe: Math.round((counts.maybe / total) * 100),
              no: Math.round((counts.no / total) * 100)
            }
          };
        });

        statistics = {
          totalUsers: responseStats.totalUsers,
          responsesByDate,
          overallParticipation: responseStats.overallParticipation,
          optimalDates
        };
      }

      return {
        success: true,
        responses,
        statistics
      };

    } catch (error) {
      return {
        success: false,
        errors: [`レスポンス一覧の取得に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  private validateBasicData(request: GetResponseRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.scheduleId?.trim()) {
      errors.push('スケジュールIDが必要です');
    }

    if (!request.guildId?.trim()) {
      errors.push('Guild IDが必要です');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private toDomainResponse(response: DomainResponse): Response {
    return ResponseMapper.toDomain(response);
  }

  private buildResponseDto(response: Response): ResponseDto {
    const primitives = response.toPrimitives();
    
    // primitives.dateStatuses はすでに文字列なので、直接変換
    const dateStatuses: Record<string, 'ok' | 'maybe' | 'ng'> = {};
    Object.entries(primitives.dateStatuses).forEach(([dateId, statusString]) => {
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
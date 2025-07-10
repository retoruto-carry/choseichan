/**
 * Response Domain Service
 * 
 * レスポンス（回答）に関する複雑なビジネスロジックを集約
 */

import { Response } from '../entities/Response';
import { Schedule } from '../entities/Schedule';
import { User } from '../entities/User';
import { ResponseStatus } from '../entities/ResponseStatus';

export interface ResponseValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface UserResponseData {
  dateId: string;
  status: ResponseStatus;
}

export class ResponseDomainService {
  /**
   * レスポンスの有効性を検証
   */
  static validateResponse(
    schedule: Schedule,
    responseData: UserResponseData[],
    comment?: string
  ): ResponseValidationResult {
    const errors: string[] = [];

    // スケジュールの状態チェック
    if (schedule.isClosed()) {
      errors.push('この日程調整は締め切られています');
    }

    if (schedule.isDeadlinePassed()) {
      errors.push('回答期限が過ぎています');
    }

    // 日程候補の存在チェック
    const scheduleeDateIds = new Set(schedule.dates.map(d => d.id));
    responseData.forEach(data => {
      if (!scheduleeDateIds.has(data.dateId)) {
        errors.push(`無効な日程候補です: ${data.dateId}`);
      }
    });

    // 重複チェック
    const responseDateIds = responseData.map(d => d.dateId);
    const uniqueDateIds = [...new Set(responseDateIds)];
    if (responseDateIds.length !== uniqueDateIds.length) {
      errors.push('同じ日程に対して複数の回答があります');
    }

    // コメント長さチェック
    if (comment && comment.length > 500) {
      errors.push('コメントは500文字以内で入力してください');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * ユーザーの回答を作成・更新
   */
  static createOrUpdateResponse(
    scheduleId: string,
    user: User,
    responseData: UserResponseData[],
    comment?: string,
    existingResponse?: Response
  ): Response {
    // 日程ステータスのマップを作成
    const dateStatuses: Record<string, ResponseStatus> = {};
    responseData.forEach(data => {
      dateStatuses[data.dateId] = data.status;
    });

    if (existingResponse) {
      // 既存のレスポンスを更新
      let updatedResponse = existingResponse;
      
      // 各日程のステータスを更新
      responseData.forEach(data => {
        updatedResponse = updatedResponse.updateDateStatus(data.dateId, data.status);
      });

      // コメントを更新
      if (comment !== undefined) {
        updatedResponse = updatedResponse.updateComment(comment);
      }

      return updatedResponse;
    } else {
      // 新しいレスポンスを作成
      return Response.create(
        scheduleId,
        user,
        dateStatuses,
        comment
      );
    }
  }

  /**
   * レスポンスの統計を計算
   */
  static calculateResponseStatistics(
    responses: Response[],
    dateIds: string[]
  ): {
    totalUsers: number;
    responsesByDate: Record<string, {
      yes: number;
      maybe: number;
      no: number;
      total: number;
    }>;
    overallParticipation: {
      fullyAvailable: number;    // 全日程参加可能
      partiallyAvailable: number; // 一部日程参加可能
      unavailable: number;       // 全日程不参加
    };
  } {
    const responsesByDate: Record<string, { yes: number; maybe: number; no: number; total: number }> = {};
    
    // 各日程の統計を初期化
    dateIds.forEach(dateId => {
      responsesByDate[dateId] = { yes: 0, maybe: 0, no: 0, total: 0 };
    });

    // 回答を集計
    responses.forEach(response => {
      dateIds.forEach(dateId => {
        const status = response.getStatusForDate(dateId);
        if (status) {
          responsesByDate[dateId].total++;
          if (status.isYes()) {
            responsesByDate[dateId].yes++;
          } else if (status.isMaybe()) {
            responsesByDate[dateId].maybe++;
          } else if (status.isNo()) {
            responsesByDate[dateId].no++;
          }
        }
      });
    });

    // 全体的な参加状況を計算
    let fullyAvailable = 0;
    let partiallyAvailable = 0;
    let unavailable = 0;

    responses.forEach(response => {
      const yesCount = dateIds.filter(dateId => {
        const status = response.getStatusForDate(dateId);
        return status?.isYes();
      }).length;

      const maybeCount = dateIds.filter(dateId => {
        const status = response.getStatusForDate(dateId);
        return status?.isMaybe();
      }).length;

      if (yesCount === dateIds.length) {
        fullyAvailable++;
      } else if (yesCount > 0 || maybeCount > 0) {
        partiallyAvailable++;
      } else {
        unavailable++;
      }
    });

    return {
      totalUsers: responses.length,
      responsesByDate,
      overallParticipation: {
        fullyAvailable,
        partiallyAvailable,
        unavailable
      }
    };
  }

  /**
   * 最適な日程を特定
   */
  static findOptimalDates(
    responses: Response[],
    dateIds: string[],
    options: {
      preferYes?: boolean;      // YES回答を重視するか
      includeMaybe?: boolean;   // MAYBE回答も考慮するか
      minimumParticipants?: number; // 最低参加者数
    } = {}
  ): {
    optimalDateId?: string;
    alternativeDateIds: string[];
    scores: Record<string, number>;
  } {
    const { preferYes = true, includeMaybe = true, minimumParticipants = 1 } = options;
    
    const scores: Record<string, number> = {};
    
    dateIds.forEach(dateId => {
      let score = 0;
      
      responses.forEach(response => {
        const status = response.getStatusForDate(dateId);
        if (status?.isYes()) {
          score += preferYes ? 3 : 1;
        } else if (status?.isMaybe() && includeMaybe) {
          score += 1;
        }
      });
      
      scores[dateId] = score;
    });

    // スコア順にソート
    const sortedDates = dateIds
      .filter(dateId => scores[dateId] >= minimumParticipants)
      .sort((a, b) => scores[b] - scores[a]);

    return {
      optimalDateId: sortedDates[0],
      alternativeDateIds: sortedDates.slice(1),
      scores
    };
  }

  /**
   * ユーザーが既に回答しているかチェック
   */
  static hasUserResponded(
    responses: Response[],
    userId: string
  ): boolean {
    return responses.some(response => response.user.id === userId);
  }

  /**
   * 特定ユーザーの回答を取得
   */
  static getUserResponse(
    responses: Response[],
    userId: string
  ): Response | undefined {
    return responses.find(response => response.user.id === userId);
  }
}
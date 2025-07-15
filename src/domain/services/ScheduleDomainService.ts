/**
 * Schedule Domain Service
 *
 * スケジュールに関する複雑なビジネスロジックを集約
 * エンティティ単体では表現できないドメインの知識を含む
 */

import { BUSINESS_CONSTANTS } from '../constants/BusinessConstants';
import type { Response } from '../entities/Response';
import type { Schedule } from '../entities/Schedule';
import type { ScheduleDate } from '../entities/ScheduleDate';

export interface ScheduleSummaryData {
  schedule: Schedule;
  responses: Response[];
  responseCounts: Record<string, { yes: number; maybe: number; no: number }>;
  totalResponseUsers: number;
  bestDateId?: string;
}

export class ScheduleDomainService {
  /**
   * スケジュールの集計データを生成
   */
  static calculateScheduleSummary(schedule: Schedule, responses: Response[]): ScheduleSummaryData {
    const responseCounts: Record<string, { yes: number; maybe: number; no: number }> = {};

    // 各日程の回答数を初期化
    schedule.dates.forEach((date) => {
      responseCounts[date.id] = { yes: 0, maybe: 0, no: 0 };
    });

    // 回答を集計
    responses.forEach((response) => {
      Object.entries(response.dateStatuses).forEach(([dateId, status]) => {
        if (responseCounts[dateId]) {
          if (status.isYes()) {
            responseCounts[dateId].yes++;
          } else if (status.isMaybe()) {
            responseCounts[dateId].maybe++;
          } else if (status.isNo()) {
            responseCounts[dateId].no++;
          }
        }
      });
    });

    // 最適な日程を計算（YES回答が最も多い日程）
    const bestDateId = ScheduleDomainService.findBestDate(responseCounts);

    return {
      schedule,
      responses,
      responseCounts,
      totalResponseUsers: responses.length,
      bestDateId,
    };
  }

  /**
   * 最適な日程を特定（YES回答が最も多い日程）
   */
  private static findBestDate(
    responseCounts: Record<string, { yes: number; maybe: number; no: number }>
  ): string | undefined {
    let bestDateId: string | undefined;
    let maxYesCount = -1;

    Object.entries(responseCounts).forEach(([dateId, counts]) => {
      if (counts.yes > maxYesCount) {
        maxYesCount = counts.yes;
        bestDateId = dateId;
      }
    });

    return maxYesCount > 0 ? bestDateId : undefined;
  }

  /**
   * スケジュールがリマインダー送信対象かチェック
   */
  static shouldSendReminder(schedule: Schedule, reminderTiming: string): boolean {
    if (!schedule.isOpen()) {
      return false;
    }

    if (!schedule.hasDeadline()) {
      return false;
    }

    if (schedule.remindersSent?.includes(reminderTiming)) {
      return false;
    }

    // Return false if deadline is not set
    if (!schedule.deadline) {
      return false;
    }

    const deadline = schedule.deadline;
    const now = new Date();
    const timeUntilDeadline = deadline.getTime() - now.getTime();

    // リマインダータイミングをミリ秒に変換
    const reminderTimeMs = ScheduleDomainService.parseReminderTiming(reminderTiming);

    if (reminderTimeMs === null) {
      return false;
    }

    // 締切の指定時間前に到達している場合
    return timeUntilDeadline <= reminderTimeMs && timeUntilDeadline > 0;
  }

  /**
   * リマインダータイミング文字列をミリ秒に変換
   */
  private static parseReminderTiming(timing: string): number | null {
    const match = timing.match(/^(\d+)([dhm])$/);
    if (!match) {
      return null;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'd': // days
        return value * 24 * 60 * 60 * 1000;
      case 'h': // hours
        return value * 60 * 60 * 1000;
      case 'm': // minutes
        return value * 60 * 1000;
      default:
        return null;
    }
  }

  /**
   * スケジュールの有効性を検証
   */
  static validateScheduleForCreation(data: {
    title: string;
    dates: ScheduleDate[];
    deadline?: Date;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // タイトルチェック
    if (!data.title || !data.title.trim()) {
      errors.push('タイトルは必須です');
    } else if (data.title.length > BUSINESS_CONSTANTS.MAX_SCHEDULE_TITLE_LENGTH) {
      errors.push(
        `タイトルは${BUSINESS_CONSTANTS.MAX_SCHEDULE_TITLE_LENGTH}文字以内で入力してください`
      );
    }

    // 日程チェック
    if (!data.dates || data.dates.length === 0) {
      errors.push('日程候補を1つ以上入力してください');
    } else if (data.dates.length > BUSINESS_CONSTANTS.MAX_DATES_PER_SCHEDULE) {
      errors.push(`日程候補は${BUSINESS_CONSTANTS.MAX_DATES_PER_SCHEDULE}個以内で入力してください`);
    }

    // 重複チェック
    if (data.dates && data.dates.length > 0) {
      const dateIds = data.dates.map((d) => d.id);
      const uniqueDateIds = [...new Set(dateIds)];
      if (dateIds.length !== uniqueDateIds.length) {
        errors.push('日程候補に重複があります');
      }
    }

    // 締切チェック
    if (data.deadline) {
      const now = new Date();
      if (data.deadline <= now) {
        errors.push('締切は未来の日時で設定してください');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * スケジュール更新時の有効性を検証
   */
  static validateScheduleForUpdate(data: {
    schedule: Schedule;
    title?: string;
    description?: string;
    deadline?: Date;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // タイトルチェック
    if (data.title !== undefined) {
      if (!data.title.trim()) {
        errors.push('タイトルは必須です');
      } else if (data.title.length > BUSINESS_CONSTANTS.MAX_SCHEDULE_TITLE_LENGTH) {
        errors.push(
          `タイトルは${BUSINESS_CONSTANTS.MAX_SCHEDULE_TITLE_LENGTH}文字以内で入力してください`
        );
      }
    }

    // 説明チェック
    if (
      data.description !== undefined &&
      data.description.length > BUSINESS_CONSTANTS.MAX_SCHEDULE_DESCRIPTION_LENGTH
    ) {
      errors.push(
        `説明は${BUSINESS_CONSTANTS.MAX_SCHEDULE_DESCRIPTION_LENGTH}文字以内で入力してください`
      );
    }

    // 締切チェック
    if (data.deadline !== undefined) {
      const now = new Date();
      if (data.deadline <= now) {
        errors.push('締切は未来の日時で設定してください');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * スケジュールが編集可能な状態かチェック
   */
  static canEditSchedule(
    schedule: Schedule,
    editorUserId: string
  ): { canEdit: boolean; reason?: string } {
    if (!schedule.canBeEditedBy(editorUserId)) {
      return {
        canEdit: false,
        reason: '編集できるのは作成者のみです',
      };
    }

    return { canEdit: true };
  }
}

/**
 * 締切リマインダーユースケース
 *
 * 締切リマインダーのユースケース
 */

import type { IScheduleRepository } from '../../../domain/repositories/interfaces';
import { getLogger } from '../../../infrastructure/logging/Logger';

export interface ReminderInfo {
  scheduleId: string;
  guildId: string;
  reminderType: string; // '3d', '1d', '8h', '1h'
  message: string;
}

export interface DeadlineCheckResult {
  upcomingReminders: ReminderInfo[];
  justClosed: Array<{ scheduleId: string; guildId: string }>;
}

export interface DeadlineReminderUseCaseResult {
  success: boolean;
  result?: DeadlineCheckResult;
  errors?: string[];
}

export class DeadlineReminderUseCase {
  private readonly logger = getLogger();

  constructor(private readonly scheduleRepository: IScheduleRepository) {}

  // デフォルトのリマインダータイミング定義
  private readonly DEFAULT_REMINDER_TIMINGS = [
    { type: '3d', hours: 72, message: '締切まで3日' },
    { type: '1d', hours: 24, message: '締切まで1日' },
    { type: '8h', hours: 8, message: '締切まで8時間' },
  ];

  async checkDeadlines(guildId?: string): Promise<DeadlineReminderUseCaseResult> {
    try {
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const result: DeadlineCheckResult = {
        upcomingReminders: [],
        justClosed: [],
      };

      const schedules = await this.scheduleRepository.findByDeadlineRange(
        oneWeekAgo,
        threeDaysFromNow,
        guildId
      );

      for (const schedule of schedules) {
        if (schedule?.deadline) {
          const deadlineTime = schedule.deadline.getTime();

          // 送信する必要があるリマインダーをチェック
          if (schedule.status === 'open' && deadlineTime > now.getTime()) {
            const remindersSent = schedule.remindersSent || [];

            // カスタムタイミングがあれば使用、そうでなければデフォルトを使用
            const isCustom = schedule.reminderTimings && schedule.reminderTimings.length > 0;
            const timings = isCustom
              ? schedule.reminderTimings
                  ?.map((t: string) => ({
                    type: t,
                    hours: this.parseTimingToHours(t) || 0,
                    message: this.getTimingMessage(t),
                    isCustom: true,
                  }))
                  .filter((t) => t.hours > 0)
              : this.DEFAULT_REMINDER_TIMINGS.map((t) => ({ ...t, isCustom: false }));

            for (const timing of timings || []) {
              const reminderTime = deadlineTime - timing.hours * 60 * 60 * 1000;

              // このリマインダーを今送信すべきかチェック
              if (now.getTime() >= reminderTime && !remindersSent.includes(timing.type)) {
                // リマインダーの種類に基づいて古すぎる場合はスキップ
                const timeSinceReminder = now.getTime() - reminderTime;
                const threshold =
                  'isCustom' in timing && timing.isCustom
                    ? this.getOldReminderThreshold(timing.type)
                    : 8 * 60 * 60 * 1000;

                if (timeSinceReminder > threshold) {
                  this.logger.info(`Skipping old reminder for ${schedule.id} (${timing.type})`);
                  continue;
                }

                result.upcomingReminders.push({
                  scheduleId: schedule.id,
                  guildId: schedule.guildId,
                  reminderType: timing.type,
                  message: timing.message,
                });
              }
            }
          }

          // 締切を過ぎているがまだオープンかチェック
          if (schedule.status === 'open' && deadlineTime <= now.getTime()) {
            const timeSinceDeadline = now.getTime() - deadlineTime;
            const CLOSURE_THRESHOLD_MS = 8 * 60 * 60 * 1000;

            if (timeSinceDeadline <= CLOSURE_THRESHOLD_MS) {
              result.justClosed.push({
                scheduleId: schedule.id,
                guildId: schedule.guildId,
              });
            }
          }
        }
      }

      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          `締切チェックに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
      };
    }
  }

  private getOldReminderThreshold(timing: string): number {
    const match = timing.match(/^(\d+)([dhm])$/);
    if (!match) return 8 * 60 * 60 * 1000;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'd':
        return 8 * 60 * 60 * 1000;
      case 'h':
        return Math.max(2 * 60 * 60 * 1000, value * 0.25 * 60 * 60 * 1000);
      case 'm':
        return Math.max(30 * 60 * 1000, value * 0.5 * 60 * 1000);
      default:
        return 8 * 60 * 60 * 1000;
    }
  }

  private parseTimingToHours(timing: string): number | null {
    const match = timing.match(/^(\d+)([dhm])$/);
    if (!match) return null;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'd':
        return value * 24;
      case 'h':
        return value;
      case 'm':
        return value / 60;
      default:
        return null;
    }
  }

  private getTimingMessage(timing: string): string {
    const match = timing.match(/^(\d+)([dhm])$/);
    if (!match) return `締切まで${timing}`;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'd':
        return `締切まで${value}日`;
      case 'h':
        return `締切まで${value}時間`;
      case 'm':
        return `締切まで${value}分`;
      default:
        return `締切まで${timing}`;
    }
  }
}

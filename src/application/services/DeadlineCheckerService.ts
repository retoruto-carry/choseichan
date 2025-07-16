/**
 * Deadline Checker Service
 *
 * 締切チェックのビジネスロジックを提供するサービス
 * ユースケースから呼び出される補助サービス
 */

import { Schedule } from '../../domain/entities/Schedule';
import type { IScheduleRepository } from '../../domain/repositories/interfaces';
import type { ILogger } from '../ports/LoggerPort';
import { mapDomainScheduleToEntity } from '../mappers/DomainMappers';

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

export class DeadlineCheckerService {
  constructor(
    private readonly logger: ILogger,
    private readonly scheduleRepository: IScheduleRepository
  ) {}

  // デフォルトのリマインダータイミング定義
  private readonly DEFAULT_REMINDER_TIMINGS = [
    { type: '3d', hours: 72, message: '回答締切まで残り3日' },
    { type: '1d', hours: 24, message: '回答締切まで残り1日' },
    { type: '8h', hours: 8, message: '回答締切まで残り8時間' },
  ];

  /**
   * 締切が近いスケジュールをチェックし、リマインダー送信が必要なものを返す
   */
  async checkDeadlines(
    guildId?: string,
    currentTime: Date = new Date()
  ): Promise<DeadlineCheckResult> {
    const threeDaysFromNow = new Date(currentTime.getTime() + 3 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(currentTime.getTime() - 7 * 24 * 60 * 60 * 1000);

    const result: DeadlineCheckResult = {
      upcomingReminders: [],
      justClosed: [],
    };

    const domainSchedules = await this.scheduleRepository.findByDeadlineRange({
      startTime: oneWeekAgo,
      endTime: threeDaysFromNow,
      guildId,
    });

    const schedules = domainSchedules.map(mapDomainScheduleToEntity);

    for (const schedule of schedules) {
      if (!schedule?.deadline) continue;

      const deadlineTime = schedule.deadline.getTime();

      // 送信する必要があるリマインダーをチェック
      if (schedule.status === 'open' && deadlineTime > currentTime.getTime()) {
        const reminders = this.getSchedulesNeedingReminders(schedule, currentTime);
        result.upcomingReminders.push(...reminders);
      }

      // 締切を過ぎているがまだオープンかチェック
      if (schedule.status === 'open' && deadlineTime <= currentTime.getTime()) {
        const needsClosure = this.shouldCloseDueToDeadline(schedule, currentTime);
        if (needsClosure) {
          result.justClosed.push({
            scheduleId: schedule.id,
            guildId: schedule.guildId,
          });
        }
      }
    }

    return result;
  }

  /**
   * スケジュールに対して送信が必要なリマインダーを取得
   */
  getSchedulesNeedingReminders(schedule: Schedule, currentTime: Date): ReminderInfo[] {
    const reminders: ReminderInfo[] = [];
    if (!schedule.deadline) return reminders;
    
    const deadlineTime = schedule.deadline.getTime();
    const remindersSent = schedule.remindersSent || [];

    // カスタムタイミングがあれば使用、そうでなければデフォルトを使用
    const hasCustomTimings = schedule.reminderTimings && schedule.reminderTimings.length > 0;
    if (!hasCustomTimings) {
      // デフォルトタイミングを使用
      const timings = this.DEFAULT_REMINDER_TIMINGS.map((t) => ({ ...t, isCustom: false }));
      for (const timing of timings) {
        const reminderTime = deadlineTime - timing.hours * 60 * 60 * 1000;
        if (currentTime.getTime() >= reminderTime && !remindersSent.includes(timing.type)) {
          const timeSinceReminder = currentTime.getTime() - reminderTime;
          if (timeSinceReminder > 8 * 60 * 60 * 1000) {
            this.logger.info(`Skipping old reminder for ${schedule.id} (${timing.type})`);
            continue;
          }
          reminders.push({
            scheduleId: schedule.id,
            guildId: schedule.guildId,
            reminderType: timing.type,
            message: timing.message,
          });
        }
      }
    } else {
      // カスタムタイミングを使用
      const timings = schedule.reminderTimings
        .map((t: string) => ({
          type: t,
          hours: this.parseTimingToHours(t) || 0,
          message: this.getTimingMessage(t),
          isCustom: true,
        }))
        .filter((t) => t.hours > 0);

      for (const timing of timings) {
        const reminderTime = deadlineTime - timing.hours * 60 * 60 * 1000;

        // このリマインダーを今送信すべきかチェック
        if (currentTime.getTime() >= reminderTime && !remindersSent.includes(timing.type)) {
          // リマインダーの種類に基づいて古すぎる場合はスキップ
          const timeSinceReminder = currentTime.getTime() - reminderTime;
          const threshold = this.getOldReminderThreshold(timing.type);

          if (timeSinceReminder > threshold) {
            this.logger.info(`Skipping old reminder for ${schedule.id} (${timing.type})`);
            continue;
          }

          reminders.push({
            scheduleId: schedule.id,
            guildId: schedule.guildId,
            reminderType: timing.type,
            message: timing.message,
          });
        }
      }
    }

    return reminders;
  }

  /**
   * スケジュールが締切のために閉じられるべきかチェック
   */
  shouldCloseDueToDeadline(schedule: Schedule, currentTime: Date): boolean {
    if (!schedule.deadline || schedule.status !== 'open') return false;

    const timeSinceDeadline = currentTime.getTime() - schedule.deadline.getTime();
    const CLOSURE_THRESHOLD_MS = 8 * 60 * 60 * 1000; // 8時間

    return timeSinceDeadline > 0 && timeSinceDeadline <= CLOSURE_THRESHOLD_MS;
  }

  /**
   * 締切を過ぎたオープンなスケジュールを取得
   */
  async getSchedulesNeedingClosure(currentTime: Date = new Date()): Promise<Schedule[]> {
    const oneWeekAgo = new Date(currentTime.getTime() - 7 * 24 * 60 * 60 * 1000);

    const domainSchedules = await this.scheduleRepository.findByDeadlineRange({
      startTime: oneWeekAgo,
      endTime: currentTime,
    });

    const schedules = domainSchedules.map(mapDomainScheduleToEntity);
    return schedules.filter((schedule) => this.shouldCloseDueToDeadline(schedule, currentTime));
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
    if (!match) return `回答締切まで残り${timing}`;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'd':
        return `回答締切まで残り${value}日`;
      case 'h':
        return `回答締切まで残り${value}時間`;
      case 'm':
        return `回答締切まで残り${value}分`;
      default:
        return `回答締切まで残り${timing}`;
    }
  }
}

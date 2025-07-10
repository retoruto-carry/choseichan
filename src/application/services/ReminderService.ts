/**
 * Reminder Service
 * 
 * リマインダー関連のビジネスロジックを管理
 */

import { Schedule } from '../../types/schedule';

export interface ReminderInfo {
  scheduleId: string;
  guildId: string;
  reminderType: string;
  message: string;
}

export interface DeadlineCheckResult {
  upcomingReminders: ReminderInfo[];
  justClosed: Array<{scheduleId: string; guildId: string}>;
}

export class ReminderService {
  // デフォルトのリマインダータイミング定義
  private static readonly DEFAULT_REMINDER_TIMINGS = [
    { type: '3d', hours: 72, message: '締切まで3日' },
    { type: '1d', hours: 24, message: '締切まで1日' },
    { type: '8h', hours: 8, message: '締切まで8時間' }
  ];

  /**
   * 古いリマインダーをスキップする閾値を取得
   * リマインダータイプに応じて動的に決定
   */
  static getOldReminderThreshold(timing: string): number {
    const match = timing.match(/^(\d+)([dhm])$/);
    if (!match) return 8 * 60 * 60 * 1000; // デフォルト8時間
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    // 各単位に応じた許容遅延時間
    switch (unit) {
      case 'd':
        // 日単位: 8時間の遅延を許容
        return 8 * 60 * 60 * 1000;
      case 'h':
        // 時間単位: 2時間または設定値の25%のうち大きい方
        return Math.max(2 * 60 * 60 * 1000, value * 0.25 * 60 * 60 * 1000);
      case 'm':
        // 分単位: 30分または設定値の50%のうち大きい方
        return Math.max(30 * 60 * 1000, value * 0.5 * 60 * 1000);
      default:
        return 8 * 60 * 60 * 1000;
    }
  }

  /**
   * カスタムタイミングの文字列（例: '3d', '8h', '30m'）を時間に変換
   */
  static parseTimingToHours(timing: string): number | null {
    const match = timing.match(/^(\d+)([dhm])$/);
    if (!match) return null;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'd': return value * 24;
      case 'h': return value;
      case 'm': return value / 60;
      default: return null;
    }
  }

  /**
   * タイミングに基づいたメッセージを生成
   */
  static getTimingMessage(timing: string): string {
    const match = timing.match(/^(\d+)([dhm])$/);
    if (!match) return `締切まで${timing}`;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'd': return `締切まで${value}日`;
      case 'h': return `締切まで${value}時間`;
      case 'm': return `締切まで${value}分`;
      default: return `締切まで${timing}`;
    }
  }

  /**
   * デフォルトのリマインダータイミングを取得
   */
  static getDefaultReminderTimings() {
    return this.DEFAULT_REMINDER_TIMINGS;
  }

  /**
   * スケジュールのリマインダー状態を判定
   */
  static shouldSendReminder(
    schedule: Schedule,
    reminderType: string,
    currentTime: Date
  ): boolean {
    if (!schedule.deadline) return false;
    if (!schedule.reminderTimings?.includes(reminderType)) return false;
    if (schedule.remindersSent?.includes(reminderType)) return false;

    const hours = this.parseTimingToHours(reminderType);
    if (hours === null) return false;

    const deadlineTime = new Date(schedule.deadline).getTime();
    const reminderTime = deadlineTime - (hours * 60 * 60 * 1000);
    const threshold = this.getOldReminderThreshold(reminderType);

    return currentTime.getTime() >= reminderTime && 
           currentTime.getTime() <= reminderTime + threshold;
  }

  /**
   * スケジュールを締切済みかどうか判定
   */
  static shouldCloseSchedule(schedule: Schedule, currentTime: Date): boolean {
    if (schedule.status === 'closed') return false;
    if (!schedule.deadline) return false;
    
    const deadlineTime = new Date(schedule.deadline).getTime();
    return currentTime.getTime() > deadlineTime && !schedule.notificationSent;
  }
}
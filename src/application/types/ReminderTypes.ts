/**
 * Reminder Type Definitions
 *
 * リマインダー関連の型定義
 */

export interface ReminderInfo {
  scheduleId: string;
  guildId: string;
  reminderType: string;
  message: string;
}

export interface DeadlineCheckResult {
  upcomingReminders: ReminderInfo[];
  justClosed: Array<{ scheduleId: string; guildId: string }>;
}

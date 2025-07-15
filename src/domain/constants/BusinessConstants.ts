/**
 * ビジネスロジック定数
 *
 * Domain層で使用するビジネスロジックに関する定数を定義
 * 他の層に依存しない純粋なビジネスルールを表現
 */

// ビジネスロジック定数
export const BUSINESS_CONSTANTS = {
  // スケジュール制限
  MAX_SCHEDULE_TITLE_LENGTH: 100,
  MAX_SCHEDULE_DESCRIPTION_LENGTH: 2000,
  MAX_DATES_PER_SCHEDULE: 50,
  MAX_SCHEDULES_PER_GUILD: 100,

  // 回答制限
  MAX_COMMENT_LENGTH: 1000,
  MAX_RESPONSES_PER_SCHEDULE: 200,

  // リマインダー設定
  DEFAULT_REMINDER_TIMINGS: ['3d', '1d', '8h'] as const,
  MAX_REMINDER_TIMINGS: 5,
  MIN_REMINDER_ADVANCE_MINUTES: 10,
  MAX_REMINDER_ADVANCE_DAYS: 30,

  // リマインダータイプ
  REMINDER_TYPES: {
    DEADLINE: 'deadline',
    CUSTOM: 'custom',
  } as const,

  // ステータス値
  SCHEDULE_STATUS: {
    OPEN: 'open',
    CLOSED: 'closed',
  } as const,

  RESPONSE_STATUS: {
    OK: 'ok',
    MAYBE: 'maybe',
    NG: 'ng',
  } as const,
} as const;

// 定数の型定義
export type ScheduleStatus =
  (typeof BUSINESS_CONSTANTS.SCHEDULE_STATUS)[keyof typeof BUSINESS_CONSTANTS.SCHEDULE_STATUS];
export type ResponseStatus =
  (typeof BUSINESS_CONSTANTS.RESPONSE_STATUS)[keyof typeof BUSINESS_CONSTANTS.RESPONSE_STATUS];
export type ReminderType =
  (typeof BUSINESS_CONSTANTS.REMINDER_TYPES)[keyof typeof BUSINESS_CONSTANTS.REMINDER_TYPES];

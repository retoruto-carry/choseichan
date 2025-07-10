/**
 * Discord API制限とUI制限
 */
export const DISCORD_LIMITS = {
  MAX_EMBED_FIELDS: 25,
  MAX_COMPONENTS_PER_MESSAGE: 5,
  MAX_SELECT_MENU_OPTIONS: 25,
  MAX_BUTTON_ROWS: 5,
  MAX_BUTTONS_PER_ROW: 5,
  MAX_CONTENT_LENGTH: 2000,
  MAX_EMBED_DESCRIPTION_LENGTH: 4096,
  MAX_EMBED_FIELD_VALUE_LENGTH: 1024
} as const;

/**
 * 時間関連の定数
 */
export const TIME_CONSTANTS = {
  SIX_MONTHS_SECONDS: 6 * 30 * 24 * 60 * 60,
  MILLISECONDS_PER_SECOND: 1000,
  MINUTES_PER_HOUR: 60,
  HOURS_PER_DAY: 24,
  DAYS_PER_MONTH: 30,
  SECONDS_PER_MINUTE: 60,
  SECONDS_PER_HOUR: 60 * 60,
  SECONDS_PER_DAY: 24 * 60 * 60
} as const;

/**
 * Discordのメッセージフラグ
 */
export const DISCORD_FLAGS = {
  EPHEMERAL: 64,
  SUPPRESS_EMBEDS: 1 << 2,
  SUPPRESS_NOTIFICATIONS: 1 << 12
} as const;

/**
 * レート制限とバッチ処理
 */
export const RATE_LIMITS = {
  DEFAULT_BATCH_SIZE: 20,
  DEFAULT_BATCH_DELAY: 100,
  WEBHOOK_REQUESTS_PER_MINUTE: 30,
  CLOSURE_BATCH_SIZE: 15,
  CLOSURE_BATCH_DELAY: 100
} as const;

/**
 * KV操作関連
 */
export const KV_LIMITS = {
  FREE_TIER_WRITES_PER_DAY: 1000,
  FREE_TIER_READS_PER_DAY: 100000,
  PAID_TIER_STORAGE_GB: 1
} as const;

/**
 * 通知関連
 */
export const NOTIFICATION_SETTINGS = {
  PR_MESSAGE_DELAY_MS: 5000,
  CACHE_DURATION_MS: 5 * 60 * 1000, // 5分
  REMINDER_THRESHOLD_HOURS: 8
} as const;

/**
 * デフォルトリマインダータイミング
 */
export const DEFAULT_REMINDER_TIMINGS = [
  { type: '3d', hours: 72, message: '締切まで3日' },
  { type: '1d', hours: 24, message: '締切まで1日' },
  { type: '8h', hours: 8, message: '締切まで8時間' }
] as const;

/**
 * エラーメッセージ
 */
export const ERROR_MESSAGES = {
  SCHEDULE_NOT_FOUND: '日程調整が見つかりません。',
  INVALID_INPUT: '入力内容に問題があります。',
  INTERNAL_ERROR: '処理中にエラーが発生しました。',
  PERMISSION_DENIED: '権限がありません。',
  SCHEDULE_CLOSED: 'この日程調整は既に締め切られています。',
  UNKNOWN_BUTTON: '不明なボタンです。',
  UNKNOWN_MODAL: '不明なモーダルです。',
  UNKNOWN_COMMAND: '不明なコマンドです。'
} as const;

/**
 * 成功メッセージ
 */
export const SUCCESS_MESSAGES = {
  SCHEDULE_CREATED: '日程調整を作成しました！',
  SCHEDULE_UPDATED: '日程調整を更新しました！',
  SCHEDULE_DELETED: '日程調整を削除しました。',
  RESPONSE_SAVED: '回答を保存しました！',
  REMINDER_SENT: 'リマインダーを送信しました。'
} as const;

/**
 * 色コード
 */
export const COLORS = {
  PRIMARY: 0x5865f2,
  SUCCESS: 0x2ecc71,
  WARNING: 0xf39c12,
  ERROR: 0xe74c3c,
  INFO: 0x3498db,
  REMINDER: 0xffcc00
} as const;
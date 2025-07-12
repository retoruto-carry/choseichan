/**
 * アプリケーション定数
 *
 * アプリケーション全体で使用する定数を型安全に定義
 * Clean Architectureの各層で使用できる共通定数
 */

// 時間関連定数
export const TIME_CONSTANTS = {
  // ミリ秒
  MILLISECONDS_PER_SECOND: 1000,
  MILLISECONDS_PER_MINUTE: 60 * 1000,
  MILLISECONDS_PER_HOUR: 60 * 60 * 1000,
  MILLISECONDS_PER_DAY: 24 * 60 * 60 * 1000,

  // 秒
  SECONDS_PER_MINUTE: 60,
  SECONDS_PER_HOUR: 60 * 60,
  SECONDS_PER_DAY: 24 * 60 * 60,

  // TTL (生存時間) 設定
  SIX_MONTHS_SECONDS: 6 * 30 * 24 * 60 * 60, // 6ヶ月のTTL
  ONE_WEEK_SECONDS: 7 * 24 * 60 * 60,
  ONE_DAY_SECONDS: 24 * 60 * 60,
  ONE_HOUR_SECONDS: 60 * 60,

  // タイムアウト設定
  DEFAULT_TIMEOUT_MS: 30 * 1000, // 30秒
  DATABASE_TIMEOUT_MS: 10 * 1000, // 10秒
  API_TIMEOUT_MS: 5 * 1000, // 5秒
} as const;

// Discord関連定数
export const DISCORD_CONSTANTS = {
  // API制限
  MAX_EMBED_FIELDS: 25,
  MAX_EMBED_DESCRIPTION_LENGTH: 4096,
  MAX_EMBED_TITLE_LENGTH: 256,
  MAX_EMBED_FIELD_NAME_LENGTH: 256,
  MAX_EMBED_FIELD_VALUE_LENGTH: 1024,
  MAX_MESSAGE_CONTENT_LENGTH: 2000,
  MAX_COMPONENTS_PER_ROW: 5,
  MAX_ACTION_ROWS: 5,

  // レート制限
  WEBHOOK_RATE_LIMIT_PER_MINUTE: 30,
  MESSAGE_RATE_LIMIT_PER_SECOND: 5,

  // インタラクションタイムアウト
  INTERACTION_TOKEN_VALID_MINUTES: 15,
  INITIAL_RESPONSE_TIMEOUT_SECONDS: 3,
  FOLLOWUP_RESPONSE_TIMEOUT_SECONDS: 3,

  // メッセージフラグ
  FLAGS: {
    EPHEMERAL: 64,
  },

  // 色（Discord埋め込みメッセージ用）
  COLORS: {
    SUCCESS: 0x00ff00,
    ERROR: 0xff0000,
    WARNING: 0xffaa00,
    INFO: 0x0099ff,
    NEUTRAL: 0x99aab5,
    PRIMARY: 0x5865f2,
  },
} as const;

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

// バリデーション定数
export const VALIDATION_CONSTANTS = {
  // 正規表現
  REGEX: {
    SCHEDULE_ID: /^[a-zA-Z0-9_-]{8,32}$/,
    DATE_ID: /^[a-zA-Z0-9_-]{8,32}$/,
    USER_ID: /^\d{17,19}$/,
    GUILD_ID: /^\d{17,19}$/,
    CHANNEL_ID: /^\d{17,19}$/,
    MESSAGE_ID: /^\d{17,19}$/,
    REMINDER_TIMING: /^(\d+)([dhm])$/,
    ISO_DATE: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
  },

  // 長さ制限
  MIN_TITLE_LENGTH: 1,
  MAX_TITLE_LENGTH: 100,
  MIN_DESCRIPTION_LENGTH: 0,
  MAX_DESCRIPTION_LENGTH: 2000,
  MIN_USERNAME_LENGTH: 1,
  MAX_USERNAME_LENGTH: 80,
  MIN_COMMENT_LENGTH: 0,
  MAX_COMMENT_LENGTH: 1000,

  // 数量制限
  MIN_DATES_COUNT: 1,
  MAX_DATES_COUNT: 50,
  MIN_RESPONSES_COUNT: 0,
  MAX_RESPONSES_COUNT: 200,
} as const;

// 成功メッセージ定数
export const SUCCESS_MESSAGES = {
  SCHEDULE_CREATED: '日程調整を作成しました！',
  SCHEDULE_UPDATED: '日程調整を更新しました！',
  SCHEDULE_DELETED: '日程調整を削除しました。',
  RESPONSE_SAVED: '回答を保存しました！',
  REMINDER_SENT: 'リマインダーを送信しました。',
} as const;

// エラーメッセージ定数
export const ERROR_MESSAGES = {
  // バリデーションエラー
  REQUIRED_FIELD: (field: string) => `${field}は必須です`,
  INVALID_LENGTH: (field: string, min: number, max: number) =>
    `${field}は${min}文字以上${max}文字以内で入力してください`,
  INVALID_FORMAT: (field: string) => `${field}の形式が正しくありません`,

  // ビジネスロジックエラー
  SCHEDULE_NOT_FOUND: '日程調整が見つかりません。',
  SCHEDULE_ALREADY_CLOSED: 'この日程調整は既に締め切られています。',
  SCHEDULE_PERMISSION_DENIED: '権限がありません。',
  RESPONSE_NOT_FOUND: '回答が見つかりません',
  INVALID_RESPONSE_STATUS: '無効な回答ステータスです',
  INVALID_INPUT: '入力内容に問題があります。',
  INTERNAL_ERROR: '処理中にエラーが発生しました。',
  UNKNOWN_BUTTON: '不明なボタンです。',
  UNKNOWN_MODAL: '不明なモーダルです。',
  UNKNOWN_COMMAND: '不明なコマンドです。',

  // システムエラー
  DATABASE_ERROR: 'データベースエラーが発生しました',
  NETWORK_ERROR: 'ネットワークエラーが発生しました',
  TIMEOUT_ERROR: 'タイムアウトが発生しました',
  RATE_LIMIT_ERROR: 'レート制限に達しました',

  // Discordエラー
  DISCORD_API_ERROR: 'Discord APIエラーが発生しました',
  DISCORD_PERMISSION_ERROR: 'Discord上で必要な権限がありません',
  DISCORD_RATE_LIMIT: 'Discord APIのレート制限に達しました',
} as const;

// 通知関連定数
export const NOTIFICATION_CONSTANTS = {
  // PRメッセージ設定
  PR_MESSAGE_DELAY_MS: 5000, // 5秒後にPRメッセージを送信
  PR_MESSAGE_CONTENT:
    '[PR] 画像を貼るだけでリンク集/個人HPを作ろう！[ピクページ](https://piku.page/)\n\n> 調整ちゃんは無料で運営されています',

  // リマインダー設定
  DEFAULT_BATCH_SIZE: 20,
  DEFAULT_BATCH_DELAY_MS: 100,
  MAX_BATCH_SIZE: 50,
  MIN_BATCH_DELAY_MS: 50,

  // メンション パターン
  MENTION_PATTERNS: {
    EVERYONE: '@everyone',
    HERE: '@here',
    USER: /^<@!?(\d+)>$/,
    ROLE: /^<@&(\d+)>$/,
    USERNAME: /^@(.+)$/,
  },
} as const;

// キャッシュ定数
export const CACHE_CONSTANTS = {
  // TTL設定（秒単位）
  GUILD_MEMBERS_TTL: 5 * 60, // 5分
  SCHEDULE_CACHE_TTL: 1 * 60, // 1分
  RESPONSE_CACHE_TTL: 30, // 30秒

  // キャッシュキー
  CACHE_KEYS: {
    GUILD_MEMBERS: (guildId: string) => `guild:${guildId}:members`,
    SCHEDULE: (scheduleId: string, guildId: string) => `schedule:${guildId}:${scheduleId}`,
    RESPONSES: (scheduleId: string, guildId: string) => `responses:${guildId}:${scheduleId}`,
    USER_RESPONSE: (scheduleId: string, userId: string, guildId: string) =>
      `response:${guildId}:${scheduleId}:${userId}`,
  },
} as const;

// 定数の型定義
export type ScheduleStatus =
  (typeof BUSINESS_CONSTANTS.SCHEDULE_STATUS)[keyof typeof BUSINESS_CONSTANTS.SCHEDULE_STATUS];
export type ResponseStatus =
  (typeof BUSINESS_CONSTANTS.RESPONSE_STATUS)[keyof typeof BUSINESS_CONSTANTS.RESPONSE_STATUS];
export type ReminderType =
  (typeof BUSINESS_CONSTANTS.REMINDER_TYPES)[keyof typeof BUSINESS_CONSTANTS.REMINDER_TYPES];
export type DiscordColor = (typeof DISCORD_CONSTANTS.COLORS)[keyof typeof DISCORD_CONSTANTS.COLORS];

// 定数用ユーティリティ関数
export const Constants = {
  isValidScheduleStatus(status: string): status is ScheduleStatus {
    return Object.values(BUSINESS_CONSTANTS.SCHEDULE_STATUS).includes(status as ScheduleStatus);
  },

  isValidResponseStatus(status: string): status is ResponseStatus {
    return Object.values(BUSINESS_CONSTANTS.RESPONSE_STATUS).includes(status as ResponseStatus);
  },

  isValidReminderTiming(timing: string): boolean {
    return VALIDATION_CONSTANTS.REGEX.REMINDER_TIMING.test(timing);
  },

  parseReminderTiming(timing: string): { value: number; unit: 'd' | 'h' | 'm' } | null {
    const match = timing.match(VALIDATION_CONSTANTS.REGEX.REMINDER_TIMING);
    if (!match) return null;

    return {
      value: parseInt(match[1]),
      unit: match[2] as 'd' | 'h' | 'm',
    };
  },

  reminderTimingToMilliseconds(timing: string): number | null {
    const parsed = this.parseReminderTiming(timing);
    if (!parsed) return null;

    switch (parsed.unit) {
      case 'd':
        return parsed.value * TIME_CONSTANTS.MILLISECONDS_PER_DAY;
      case 'h':
        return parsed.value * TIME_CONSTANTS.MILLISECONDS_PER_HOUR;
      case 'm':
        return parsed.value * TIME_CONSTANTS.MILLISECONDS_PER_MINUTE;
    }
  },
} as const;

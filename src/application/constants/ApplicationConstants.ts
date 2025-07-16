/**
 * アプリケーション層定数
 *
 * Application層で使用する定数
 * UI表示メッセージ、バリデーション、通知設定など
 */

// 時間関連定数（共通で使用）
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

  ONE_WEEK_SECONDS: 7 * 24 * 60 * 60,
  ONE_DAY_SECONDS: 24 * 60 * 60,
  ONE_HOUR_SECONDS: 60 * 60,

  // タイムアウト設定
  DEFAULT_TIMEOUT_MS: 30 * 1000, // 30秒
  DATABASE_TIMEOUT_MS: 10 * 1000, // 10秒
  API_TIMEOUT_MS: 5 * 1000, // 5秒
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
  SCHEDULE_NOT_FOUND: '日程調整が見つかりません。',
  INVALID_INPUT: '入力内容に問題があります。',
  INTERNAL_ERROR: '処理中にエラーが発生しました。',
  PERMISSION_DENIED: '権限がありません。',
  SCHEDULE_CLOSED: 'この日程調整は既に締め切られています。',
  UNKNOWN_BUTTON: '不明なボタンです。',
  UNKNOWN_MODAL: '不明なモーダルです。',
  UNKNOWN_COMMAND: '不明なコマンドです。',
  DATES_REQUIRED: '日程候補を入力してください。',
  TITLE_REQUIRED: 'タイトルを入力してください。',
  INVALID_DEADLINE_FORMAT: '締切日時の形式が正しくありません。',
} as const;

// 通知関連定数
export const NOTIFICATION_CONSTANTS = {
  // PRメッセージ設定
  PR_MESSAGE_DELAY_MS: 5000, // 5秒後にPRメッセージを送信
  PR_MESSAGE_CONTENT:
    '[PR] 画像を貼るだけでリンク集/個人HPを作ろう！[ピクページ](https://piku.page/)\n\n> 調整ちゃんは無料で運営されています',

  // リマインダー設定
  DEFAULT_REMINDER_TIMINGS: ['3d', '1d', '8h'] as const,
  DEFAULT_REMINDER_MENTIONS: ['@here'] as const,
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

// 定数用ユーティリティ関数
export const Constants = {
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

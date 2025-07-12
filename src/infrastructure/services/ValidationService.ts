/**
 * Validation Service
 *
 * 再利用可能なバリデーション機能を提供
 * 入力データの検証とサニタイゼーションを統一化
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedValue?: unknown;
}

export class ValidationService {
  /**
   * 日付文字列のバリデーション
   */
  static validateDate(date: string): ValidationResult {
    if (!date || typeof date !== 'string') {
      return { isValid: false, error: '日付が空です' };
    }

    const trimmedDate = date.trim();
    if (!trimmedDate) {
      return { isValid: false, error: '日付が空です' };
    }

    const parsed = new Date(trimmedDate);
    if (Number.isNaN(parsed.getTime())) {
      return { isValid: false, error: '無効な日付形式です' };
    }

    // 過去の日付チェック（現在時刻より前）
    if (parsed < new Date()) {
      return { isValid: false, error: '過去の日付は指定できません' };
    }

    return {
      isValid: true,
      sanitizedValue: parsed,
    };
  }

  /**
   * Discord ID（Snowflake）のバリデーション
   */
  static validateDiscordId(id: string, type = 'ID'): ValidationResult {
    if (!id || typeof id !== 'string') {
      return { isValid: false, error: `${type}が入力されていません` };
    }

    const trimmedId = id.trim();
    if (!trimmedId) {
      return { isValid: false, error: `${type}が空です` };
    }

    // Discord Snowflakeのパターンチェック（17-19桁の数字）
    const pattern = /^\d{17,19}$/;
    if (!pattern.test(trimmedId)) {
      return { isValid: false, error: `無効な${type}形式です` };
    }

    return {
      isValid: true,
      sanitizedValue: trimmedId,
    };
  }

  /**
   * テキスト入力のサニタイゼーションとバリデーション
   */
  static validateAndSanitizeText(
    text: string,
    options: {
      maxLength?: number;
      minLength?: number;
      required?: boolean;
      allowEmpty?: boolean;
    } = {}
  ): ValidationResult {
    const { maxLength, minLength, required = false, allowEmpty = false } = options;

    if (!text || typeof text !== 'string') {
      if (required) {
        return { isValid: false, error: 'テキストが空です' };
      }
      return { isValid: true, sanitizedValue: '' };
    }

    // 基本的なサニタイゼーション（HTMLタグを完全に除去）
    const sanitized = text
      .trim()
      .replace(/<[^>]*>/g, '') // HTMLタグ除去
      .replace(/\r\n/g, '\n') // 改行統一
      .replace(/\r/g, '\n');

    if (!sanitized && !allowEmpty) {
      if (required) {
        return { isValid: false, error: 'テキストが空です' };
      }
      return { isValid: true, sanitizedValue: '' };
    }

    // 長さのバリデーション
    if (minLength && sanitized.length < minLength) {
      return {
        isValid: false,
        error: `${minLength}文字以上で入力してください`,
      };
    }

    if (maxLength && sanitized.length > maxLength) {
      return {
        isValid: false,
        error: `${maxLength}文字以内で入力してください`,
      };
    }

    return {
      isValid: true,
      sanitizedValue: sanitized,
    };
  }

  /**
   * スケジュールタイトルのバリデーション
   */
  static validateScheduleTitle(title: string): ValidationResult {
    return ValidationService.validateAndSanitizeText(title, {
      required: true,
      minLength: 1,
      maxLength: 100,
    });
  }

  /**
   * スケジュール説明のバリデーション
   */
  static validateScheduleDescription(description?: string): ValidationResult {
    if (!description) {
      return { isValid: true, sanitizedValue: undefined };
    }

    return ValidationService.validateAndSanitizeText(description, {
      maxLength: 1000,
      allowEmpty: true,
    });
  }

  /**
   * コメントのバリデーション
   */
  static validateComment(comment?: string): ValidationResult {
    if (!comment) {
      return { isValid: true, sanitizedValue: undefined };
    }

    return ValidationService.validateAndSanitizeText(comment, {
      maxLength: 500,
      allowEmpty: true,
    });
  }

  /**
   * リマインダータイミングのバリデーション
   */
  static validateReminderTiming(timing: string): ValidationResult {
    if (!timing || typeof timing !== 'string') {
      return { isValid: false, error: 'リマインダータイミングが入力されていません' };
    }

    const trimmed = timing.trim().toLowerCase();

    // 許可されるパターン: 数字 + 単位 (m, h, d)
    const pattern = /^(\d+)(m|h|d)$/;
    const match = trimmed.match(pattern);

    if (!match) {
      return {
        isValid: false,
        error: '無効なリマインダータイミングです（例: 30m, 8h, 3d）',
      };
    }

    const [, value, unit] = match;
    const numValue = parseInt(value, 10);

    // 制限値チェック
    if (unit === 'm' && (numValue < 1 || numValue > 1440)) {
      // 1分〜24時間
      return { isValid: false, error: '分指定は1-1440の範囲で入力してください' };
    }
    if (unit === 'h' && (numValue < 1 || numValue > 168)) {
      // 1時間〜7日
      return { isValid: false, error: '時間指定は1-168の範囲で入力してください' };
    }
    if (unit === 'd' && (numValue < 1 || numValue > 30)) {
      // 1日〜30日
      return { isValid: false, error: '日指定は1-30の範囲で入力してください' };
    }

    return {
      isValid: true,
      sanitizedValue: trimmed,
    };
  }

  /**
   * レスポンスステータスのバリデーション
   */
  static validateResponseStatus(status: string): ValidationResult {
    if (!status || typeof status !== 'string') {
      return { isValid: false, error: 'ステータスが入力されていません' };
    }

    const validStatuses = ['ok', 'maybe', 'ng'];
    const trimmed = status.trim().toLowerCase();

    if (!validStatuses.includes(trimmed)) {
      return {
        isValid: false,
        error: `無効なステータスです。使用可能: ${validStatuses.join(', ')}`,
      };
    }

    return {
      isValid: true,
      sanitizedValue: trimmed,
    };
  }

  /**
   * 複数の値を一度にバリデーション
   */
  static validateMultiple(validations: Array<() => ValidationResult>): ValidationResult {
    const errors: string[] = [];
    const sanitizedValues: unknown[] = [];

    for (const validation of validations) {
      const result = validation();
      if (!result.isValid) {
        errors.push(result.error || 'バリデーションエラー');
      } else {
        sanitizedValues.push(result.sanitizedValue);
      }
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        error: errors.join(', '),
      };
    }

    return {
      isValid: true,
      sanitizedValue: sanitizedValues,
    };
  }
}

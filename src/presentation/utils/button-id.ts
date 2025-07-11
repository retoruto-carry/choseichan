/**
 * ボタンIDの型安全な生成・パース機能
 */

export interface ButtonIdParams {
  action: string;
  scheduleId: string;
  additionalParams?: string[];
}

export interface ParsedButtonId {
  action: string;
  scheduleId: string;
  additionalParams: string[];
}

/**
 * ボタンIDパーサーエラー
 */
export class ButtonIdParseError extends Error {
  constructor(buttonId: string, reason: string) {
    super(`Failed to parse button ID "${buttonId}": ${reason}`);
    this.name = 'ButtonIdParseError';
  }
}

/**
 * ボタンID関連のユーティリティ
 */
export class ButtonIdUtils {
  private static readonly SEPARATOR = ':';
  private static readonly MIN_PARTS = 2; // action:scheduleId

  /**
   * 型安全なボタンID作成
   */
  static createButtonId(params: ButtonIdParams): string {
    const parts = [params.action, params.scheduleId];
    
    if (params.additionalParams && params.additionalParams.length > 0) {
      parts.push(...params.additionalParams);
    }
    
    // セパレータを含む値の検証
    for (const part of parts) {
      if (part.includes(this.SEPARATOR)) {
        throw new Error(`Button ID part cannot contain separator "${this.SEPARATOR}": ${part}`);
      }
      if (!part.trim()) {
        throw new Error('Button ID part cannot be empty');
      }
    }
    
    return parts.join(this.SEPARATOR);
  }

  /**
   * ボタンIDのパース
   */
  static parseButtonId(buttonId: string): ParsedButtonId {
    if (!buttonId || !buttonId.trim()) {
      throw new ButtonIdParseError(buttonId, 'Button ID is empty');
    }

    const parts = buttonId.split(this.SEPARATOR);
    
    if (parts.length < this.MIN_PARTS) {
      throw new ButtonIdParseError(
        buttonId, 
        `Expected at least ${this.MIN_PARTS} parts, got ${parts.length}`
      );
    }

    const [action, scheduleId, ...additionalParams] = parts;

    if (!action.trim()) {
      throw new ButtonIdParseError(buttonId, 'Action part is empty');
    }

    if (!scheduleId.trim()) {
      throw new ButtonIdParseError(buttonId, 'Schedule ID part is empty');
    }

    return {
      action: action.trim(),
      scheduleId: scheduleId.trim(),
      additionalParams: additionalParams.map(p => p.trim())
    };
  }

  /**
   * 特定のアクションのボタンIDかチェック
   */
  static isActionType(buttonId: string, expectedAction: string): boolean {
    try {
      const parsed = this.parseButtonId(buttonId);
      return parsed.action === expectedAction;
    } catch {
      return false;
    }
  }

  /**
   * ボタンIDからスケジュールIDを安全に取得
   */
  static extractScheduleId(buttonId: string): string | null {
    try {
      const parsed = this.parseButtonId(buttonId);
      return parsed.scheduleId;
    } catch {
      return null;
    }
  }
}

/**
 * よく使われるボタンIDパターンのヘルパー
 */
export class CommonButtonIds {
  static respond(scheduleId: string): string {
    return ButtonIdUtils.createButtonId({
      action: 'respond',
      scheduleId
    });
  }

  static edit(scheduleId: string): string {
    return ButtonIdUtils.createButtonId({
      action: 'edit',
      scheduleId
    });
  }

  static close(scheduleId: string): string {
    return ButtonIdUtils.createButtonId({
      action: 'close',
      scheduleId
    });
  }

  static reopen(scheduleId: string): string {
    return ButtonIdUtils.createButtonId({
      action: 'reopen',
      scheduleId
    });
  }

  static details(scheduleId: string): string {
    return ButtonIdUtils.createButtonId({
      action: 'details',
      scheduleId
    });
  }

  static delete(scheduleId: string): string {
    return ButtonIdUtils.createButtonId({
      action: 'delete',
      scheduleId
    });
  }

  static confirmDelete(scheduleId: string): string {
    return ButtonIdUtils.createButtonId({
      action: 'confirm_delete',
      scheduleId
    });
  }

  static cancelDelete(scheduleId: string): string {
    return ButtonIdUtils.createButtonId({
      action: 'cancel_delete',
      scheduleId
    });
  }

  static vote(scheduleId: string, dateId: string, status: string): string {
    return ButtonIdUtils.createButtonId({
      action: 'vote',
      scheduleId,
      additionalParams: [dateId, status]
    });
  }

  static editReminder(scheduleId: string): string {
    return ButtonIdUtils.createButtonId({
      action: 'edit_reminder',
      scheduleId
    });
  }
}

/**
 * レガシーボタンIDサポート（既存のcreateButtonId関数との互換性）
 */
export function createButtonId(action: string, scheduleId: string, ...additionalParams: string[]): string {
  return ButtonIdUtils.createButtonId({
    action,
    scheduleId,
    additionalParams: additionalParams.length > 0 ? additionalParams : undefined
  });
}

/**
 * レガシーボタンIDパーサー（既存のparseButtonId関数との互換性）
 */
export function parseButtonId(buttonId: string): { action: string; scheduleId: string; additionalParams: string[] } {
  return ButtonIdUtils.parseButtonId(buttonId);
}
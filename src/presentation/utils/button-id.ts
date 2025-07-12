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
const BUTTON_ID_SEPARATOR = ':';
const MIN_BUTTON_ID_PARTS = 2; // action:scheduleId

/**
 * 型安全なボタンID作成
 */
export function createButtonIdFromParams(params: ButtonIdParams): string {
  const parts = [params.action, params.scheduleId];

  if (params.additionalParams && params.additionalParams.length > 0) {
    parts.push(...params.additionalParams);
  }

  // セパレータを含む値の検証
  for (const part of parts) {
    if (part.includes(BUTTON_ID_SEPARATOR)) {
      throw new Error(
        `Button ID part cannot contain separator "${BUTTON_ID_SEPARATOR}": ${part}`
      );
    }
    if (!part.trim()) {
      throw new Error('Button ID part cannot be empty');
    }
  }

  return parts.join(BUTTON_ID_SEPARATOR);
}

/**
 * ボタンIDのパース
 */
export function parseButtonIdToComponents(buttonId: string): ParsedButtonId {
  if (!buttonId || !buttonId.trim()) {
    throw new ButtonIdParseError(buttonId, 'Button ID is empty');
  }

  const parts = buttonId.split(BUTTON_ID_SEPARATOR);

  if (parts.length < MIN_BUTTON_ID_PARTS) {
    throw new ButtonIdParseError(
      buttonId,
      `Expected at least ${MIN_BUTTON_ID_PARTS} parts, got ${parts.length}`
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
    additionalParams: additionalParams.map((p) => p.trim()),
  };
}

/**
 * 特定のアクションのボタンIDかチェック
 */
export function isButtonIdAction(buttonId: string, expectedAction: string): boolean {
  try {
    const parsed = parseButtonIdToComponents(buttonId);
    return parsed.action === expectedAction;
  } catch {
    return false;
  }
}

/**
 * ボタンIDからスケジュールIDを安全に取得
 */
export function extractScheduleIdFromButton(buttonId: string): string | null {
  try {
    const parsed = parseButtonIdToComponents(buttonId);
    return parsed.scheduleId;
  } catch {
    return null;
  }
}

/**
 * よく使われるボタンIDパターンのヘルパー関数
 */
export function createRespondButtonId(scheduleId: string): string {
  return createButtonIdFromParams({
    action: 'respond',
    scheduleId,
  });
}

export function createEditButtonId(scheduleId: string): string {
  return createButtonIdFromParams({
    action: 'edit',
    scheduleId,
  });
}

export function createCloseButtonId(scheduleId: string): string {
  return createButtonIdFromParams({
    action: 'close',
    scheduleId,
  });
}

export function createReopenButtonId(scheduleId: string): string {
  return createButtonIdFromParams({
    action: 'reopen',
    scheduleId,
  });
}

export function createDetailsButtonId(scheduleId: string): string {
  return createButtonIdFromParams({
    action: 'details',
    scheduleId,
  });
}

export function createDeleteButtonId(scheduleId: string): string {
  return createButtonIdFromParams({
    action: 'delete',
    scheduleId,
  });
}

export function createConfirmDeleteButtonId(scheduleId: string): string {
  return createButtonIdFromParams({
    action: 'confirm_delete',
    scheduleId,
  });
}

export function createCancelDeleteButtonId(scheduleId: string): string {
  return createButtonIdFromParams({
    action: 'cancel_delete',
    scheduleId,
  });
}

export function createVoteButtonId(scheduleId: string, dateId: string, status: string): string {
  return createButtonIdFromParams({
    action: 'vote',
    scheduleId,
    additionalParams: [dateId, status],
  });
}

export function createEditReminderButtonId(scheduleId: string): string {
  return createButtonIdFromParams({
    action: 'edit_reminder',
    scheduleId,
  });
}

/**
 * レガシーボタンIDサポート（既存のcreateButtonId関数との互換性）
 */
export function createButtonId(
  action: string,
  scheduleId: string,
  ...additionalParams: string[]
): string {
  return createButtonIdFromParams({
    action,
    scheduleId,
    additionalParams: additionalParams.length > 0 ? additionalParams : undefined,
  });
}

/**
 * レガシーボタンIDパーサー（既存のparseButtonId関数との互換性）
 */
export function parseButtonId(buttonId: string): {
  action: string;
  scheduleId: string;
  additionalParams: string[];
} {
  return parseButtonIdToComponents(buttonId);
}

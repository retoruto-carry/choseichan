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
    super(`ボタンID "${buttonId}" のパースに失敗しました: ${reason}`);
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
        `ボタンID部分に区切り文字 "${BUTTON_ID_SEPARATOR}" を含めることはできません: ${part}`
      );
    }
    if (!part.trim()) {
      throw new Error('ボタンID部分を空にすることはできません');
    }
  }

  return parts.join(BUTTON_ID_SEPARATOR);
}

/**
 * ボタンIDのパース
 */
export function parseButtonIdToComponents(buttonId: string): ParsedButtonId {
  if (!buttonId || !buttonId.trim()) {
    throw new ButtonIdParseError(buttonId, 'ボタンIDが空です');
  }

  const parts = buttonId.split(BUTTON_ID_SEPARATOR);

  if (parts.length < MIN_BUTTON_ID_PARTS) {
    throw new ButtonIdParseError(
      buttonId,
      `最低 ${MIN_BUTTON_ID_PARTS} 個の部分が必要ですが、${parts.length} 個でした`
    );
  }

  const [action, scheduleId, ...additionalParams] = parts;

  if (!action.trim()) {
    throw new ButtonIdParseError(buttonId, 'アクション部分が空です');
  }

  if (!scheduleId.trim()) {
    throw new ButtonIdParseError(buttonId, 'スケジュールID部分が空です');
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

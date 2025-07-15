/**
 * Presentation層のボタンID関連ユーティリティ
 *
 * Discord UIのボタンカスタムID処理
 */

/**
 * ボタンのカスタムIDをパース
 */
export function parseButtonId(customId: string): {
  action: string;
  params: string[];
} {
  const parts = customId.split(':');
  return {
    action: parts[0],
    params: parts.slice(1),
  };
}

/**
 * ボタンのカスタムIDを作成
 */
export function createButtonId(action: string, ...params: string[]): string {
  return [action, ...params].join(':');
}

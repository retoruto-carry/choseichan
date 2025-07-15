/**
 * Presentation層の日付フォーマットユーティリティ
 *
 * UI表示用の日付フォーマット処理
 */

/**
 * スケジュールの日付を短い形式で表示
 * @param dateString ISO形式の日付文字列
 * @returns 12/25 19:00 形式の文字列
 */
export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

/**
 * ISO形式の日付をJST形式で表示 (ブラウザ依存なし)
 * @param dateString ISO形式の日付文字列
 * @returns 12月25日(月) 19:00 形式の文字列
 */
export function formatDate(dateString: string): string {
  // 空文字列やnull/undefinedの場合はそのまま返す
  if (!dateString || typeof dateString !== 'string') {
    return String(dateString || '');
  }

  const date = new Date(dateString);

  // 無効な日付の場合はそのまま返す
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  // 明示的にJST（UTC+9）として変換
  const jstOffset = 9 * 60 * 60 * 1000; // 9時間をミリ秒で
  const jstDate = new Date(date.getTime() + jstOffset);

  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const month = jstDate.getUTCMonth() + 1;
  const day = jstDate.getUTCDate();
  const weekday = weekdays[jstDate.getUTCDay()];
  const hours = jstDate.getUTCHours().toString().padStart(2, '0');
  const minutes = jstDate.getUTCMinutes().toString().padStart(2, '0');

  // 各値が有効かチェック
  if (Number.isNaN(month) || Number.isNaN(day) || Number.isNaN(hours) || Number.isNaN(minutes)) {
    return dateString;
  }

  return `${month}月${day}日(${weekday}) ${hours}:${minutes}`;
}

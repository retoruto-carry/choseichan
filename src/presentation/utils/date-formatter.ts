/**
 * 日付フォーマット用ユーティリティ
 */

/**
 * 日時を MM/DD(曜日) HH:mm 形式でフォーマット
 */
export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // 明示的にJST（UTC+9）として変換
  const jstOffset = 9 * 60 * 60 * 1000; // 9時間をミリ秒で
  const jstDate = new Date(dateObj.getTime() + jstOffset);

  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const dayOfWeek = days[jstDate.getUTCDay()];

  const month = jstDate.getUTCMonth() + 1;
  const day = jstDate.getUTCDate();
  const hours = String(jstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');

  return `${month}/${day}(${dayOfWeek}) ${hours}:${minutes}`;
}

/**
 * 日時を短縮形式でフォーマット（MM/DD HH:mm）
 */
export function formatDateTimeShort(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // 明示的にJST（UTC+9）として変換
  const jstOffset = 9 * 60 * 60 * 1000; // 9時間をミリ秒で
  const jstDate = new Date(dateObj.getTime() + jstOffset);

  const month = jstDate.getUTCMonth() + 1;
  const day = jstDate.getUTCDate();
  const hours = String(jstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');

  return `${month}/${day} ${hours}:${minutes}`;
}

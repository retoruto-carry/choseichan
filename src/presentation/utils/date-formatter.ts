/**
 * 日付フォーマット用ユーティリティ
 */

/**
 * 日時を MM/DD(曜日) HH:mm 形式でフォーマット
 */
export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const dayOfWeek = days[dateObj.getDay()];

  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');

  return `${month}/${day}(${dayOfWeek}) ${hours}:${minutes}`;
}

/**
 * 日時を短縮形式でフォーマット（MM/DD HH:mm）
 */
export function formatDateTimeShort(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');

  return `${month}/${day} ${hours}:${minutes}`;
}

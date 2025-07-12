// import { parseISO } from 'date-fns'; // 未使用のインポートを削除

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
  const date = new Date(dateString);
  
  // 無効な日付の場合はそのまま返す
  if (isNaN(date.getTime())) {
    return dateString;
  }
  
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}月${day}日(${weekday}) ${hours}:${minutes}`;
}

/**
 * JST（日本標準時）として日付を作成
 * Dateコンストラクタは自動的にローカルタイムゾーンを使用するため、
 * 明示的にJSTオフセットを適用してUTCとして作成
 */
function createJSTDate(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0
): Date {
  // 9時間を引いて入力をJSTとして扱い、UTCで直接日付を作成
  // 注意: Date.UTCは日付ロールオーバーを自動的に処理（例: JST 23:59 → 同日 UTC 14:59）
  return new Date(Date.UTC(year, month, day, hour - 9, minute, second));
}

export function parseUserInputDate(input: string): Date | null {
  // 入力をクリーンアップ
  const cleanedInput = input.trim();

  const now = new Date();
  const currentYear = now.getFullYear();

  // 一般的な日本語形式
  // MM月DD日 HH:mm
  const matchJp1 = cleanedInput.match(/^(\d{1,2})月(\d{1,2})日\s*(\d{1,2})[:\s時](\d{2})分?$/);
  if (matchJp1) {
    const [, month, day, hour, minute] = matchJp1;
    const date = createJSTDate(
      currentYear,
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );
    if (date < now) {
      return createJSTDate(
        currentYear + 1,
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute)
      );
    }
    return date;
  }

  // MM月DD日
  const matchJp2 = cleanedInput.match(/^(\d{1,2})月(\d{1,2})日$/);
  if (matchJp2) {
    const [, month, day] = matchJp2;
    const date = createJSTDate(currentYear, parseInt(month) - 1, parseInt(day), 23, 59, 59);
    if (date < now) {
      return createJSTDate(currentYear + 1, parseInt(month) - 1, parseInt(day), 23, 59, 59);
    }
    return date;
  }

  // MM/DD HH:mm または MM-DD HH:mm
  const match1 = cleanedInput.match(/^(\d{1,2})[/-](\d{1,2})\s+(\d{1,2})[:\s](\d{2})$/);
  if (match1) {
    const [, month, day, hour, minute] = match1;
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);

    // 月と日を検証
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
      return null;
    }

    const date = createJSTDate(
      currentYear,
      monthNum - 1,
      dayNum,
      parseInt(hour),
      parseInt(minute)
    );
    if (date < now) {
      return createJSTDate(
        currentYear + 1,
        monthNum - 1,
        dayNum,
        parseInt(hour),
        parseInt(minute)
      );
    }
    return date;
  }

  // MM/DD または MM-DD
  const match2 = cleanedInput.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (match2) {
    const [, month, day] = match2;
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);

    // 月と日を検証
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
      return null;
    }

    const date = createJSTDate(currentYear, monthNum - 1, dayNum, 23, 59, 59);
    if (date < now) {
      return createJSTDate(currentYear + 1, monthNum - 1, dayNum, 23, 59, 59);
    }
    return date;
  }

  // HH:mm のみ（今日の日付）
  const match3 = cleanedInput.match(/^(\d{1,2})[:\s](\d{2})$/);
  if (match3) {
    const [, hour, minute] = match3;
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const date = createJSTDate(
      jstNow.getUTCFullYear(),
      jstNow.getUTCMonth(),
      jstNow.getUTCDate(),
      parseInt(hour),
      parseInt(minute)
    );
    if (date < now) {
      // 明日の同じ時刻
      const tomorrow = new Date(jstNow);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      return createJSTDate(
        tomorrow.getUTCFullYear(),
        tomorrow.getUTCMonth(),
        tomorrow.getUTCDate(),
        parseInt(hour),
        parseInt(minute)
      );
    }
    return date;
  }

  // 明日 HH:mm
  const match4 = cleanedInput.match(/^明日\s*(\d{1,2})[:\s](\d{2})$/);
  if (match4) {
    const [, hour, minute] = match4;
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const tomorrow = new Date(jstNow);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return createJSTDate(
      tomorrow.getUTCFullYear(),
      tomorrow.getUTCMonth(),
      tomorrow.getUTCDate(),
      parseInt(hour),
      parseInt(minute)
    );
  }

  // YYYY年MM月DD日 HH:mm
  const match5 = cleanedInput.match(
    /^(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2})[:\s時](\d{2})分?$/
  );
  if (match5) {
    const [, year, month, day, hour, minute] = match5;
    return createJSTDate(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );
  }

  // YYYY/MM/DD HH:mm
  const match6 = cleanedInput.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (match6) {
    const [, year, month, day, hour, minute] = match6;
    return createJSTDate(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );
  }

  // YYYY/MM/DD または YYYY-MM-DD (時刻なし)
  const match6b = cleanedInput.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (match6b) {
    const [, year, month, day] = match6b;
    return createJSTDate(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      23,
      59,
      59
    );
  }

  // ISO-8601形式
  const match7 = cleanedInput.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/);
  if (match7) {
    return new Date(cleanedInput);
  }

  // YYYYMMDD (締切日)
  const match8Digit = cleanedInput.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match8Digit) {
    const [, year, month, day] = match8Digit;
    return createJSTDate(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59);
  }

  // YYMMDD (締切日の短縮版)
  const match6Digit = cleanedInput.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (match6Digit) {
    const [, year, month, day] = match6Digit;
    const fullYear = 2000 + parseInt(year);
    return createJSTDate(fullYear, parseInt(month) - 1, parseInt(day), 23, 59, 59);
  }

  return null;
}

/**
 * 相対的な日時を絶対的な日時に変換
 * 例: "1d" -> 1日後の日時
 */
export function parseRelativeTime(input: string, baseTime: Date = new Date()): Date | null {
  const match = input.match(/^(\d+)([dhm])$/);
  if (!match) return null;

  const [, valueStr, unit] = match;
  const value = parseInt(valueStr);

  const result = new Date(baseTime);
  switch (unit) {
    case 'd':
      result.setDate(result.getDate() + value);
      break;
    case 'h':
      result.setHours(result.getHours() + value);
      break;
    case 'm':
      result.setMinutes(result.getMinutes() + value);
      break;
  }

  return result;
}

/**
 * 日付が有効な未来の日付かチェック
 */
export function isFutureDate(date: Date): boolean {
  return date > new Date();
}

/**
 * 時刻を丸める（分単位）
 * @param date 対象の日時
 * @param intervalMinutes 丸める間隔（分）
 * @returns 丸められた日時
 */
export function roundToNearestMinutes(date: Date, intervalMinutes: number): Date {
  const minutes = date.getMinutes();
  const roundedMinutes = Math.round(minutes / intervalMinutes) * intervalMinutes;
  const result = new Date(date);
  result.setMinutes(roundedMinutes);
  result.setSeconds(0);
  result.setMilliseconds(0);
  return result;
}
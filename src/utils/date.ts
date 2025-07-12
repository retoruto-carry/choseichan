export function formatDate(dateString: string): string {
  // 有効な日付形式の場合、綺麗にフォーマット
  const date = new Date(dateString);

  if (!Number.isNaN(date.getTime())) {
    // JSTオフセットを取得（UTC+9）
    const jstOffset = 9 * 60; // 9 hours in minutes
    const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
    const jstTime = new Date(utcTime + jstOffset * 60000);

    const month = jstTime.getMonth() + 1;
    const day = jstTime.getDate();
    const hours = jstTime.getHours();
    const minutes = jstTime.getMinutes();

    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][jstTime.getDay()];

    let result = `${month}/${day}(${dayOfWeek})`;

    if (hours !== 0 || minutes !== 0) {
      result += ` ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    return result;
  }

  // そうでなければそのまま返す
  return dateString;
}

// JST入力からUTC日付を作成するヘルパー関数
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
  input = input.trim();

  const now = new Date();
  const currentYear = now.getFullYear();

  // 一般的な日本語形式
  // MM月DD日 HH:mm
  const matchJp1 = input.match(/^(\d{1,2})月(\d{1,2})日\s*(\d{1,2})[:\s時](\d{2})分?$/);
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
  const matchJp2 = input.match(/^(\d{1,2})月(\d{1,2})日$/);
  if (matchJp2) {
    const [, month, day] = matchJp2;
    const date = createJSTDate(currentYear, parseInt(month) - 1, parseInt(day), 23, 59, 59);
    if (date < now) {
      return createJSTDate(currentYear + 1, parseInt(month) - 1, parseInt(day), 23, 59, 59);
    }
    return date;
  }

  // MM/DD HH:mm または MM-DD HH:mm
  const match1 = input.match(/^(\d{1,2})[/-](\d{1,2})\s+(\d{1,2})[:\s](\d{2})$/);
  if (match1) {
    const [, month, day, hour, minute] = match1;
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);

    // 月と日を検証
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      const date = createJSTDate(
        currentYear,
        monthNum - 1,
        dayNum,
        parseInt(hour),
        parseInt(minute)
      );

      // 過去の日付の場合、来年と仮定
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
  }

  // MM/DD または MM-DD
  const match2 = input.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (match2) {
    const [, month, day] = match2;
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);

    // 月と日を検証
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      const date = createJSTDate(currentYear, monthNum - 1, dayNum, 23, 59, 59);

      // 過去の日付の場合、来年と仮定
      if (date < now) {
        return createJSTDate(currentYear + 1, monthNum - 1, dayNum, 23, 59, 59);
      }

      return date;
    }
  }

  // YYYY/MM/DD HH:mm または YYYY-MM-DD HH:mm
  const match3 = input.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})\s+(\d{1,2})[:\s](\d{2})$/);
  if (match3) {
    const [, year, month, day, hour, minute] = match3;
    return createJSTDate(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute)
    );
  }

  // YYYY/MM/DD または YYYY-MM-DD
  const match4 = input.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (match4) {
    const [, year, month, day] = match4;
    return createJSTDate(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59);
  }

  // 最後の手段としてネイティブDateパーシングを試すが、特定の形式のみ
  // 「invalid」を有効な日付としてパーシングすることを避けるため
  if (input.match(/^[a-zA-Z]+ \d{1,2}$/i) || input.match(/^\d{1,2} [a-zA-Z]+$/i)) {
    // 「July 11」、「11 Jul」などの形式
    const nativeDate = new Date(`${input} ${currentYear}`);
    if (!Number.isNaN(nativeDate.getTime())) {
      // If the date is in the past, try next year
      if (nativeDate < now) {
        nativeDate.setFullYear(currentYear + 1);
      }
      // 日付のみの形式の場合は23:59:59に設定してUTCに変換
      const jstDate = createJSTDate(
        nativeDate.getFullYear(),
        nativeDate.getMonth(),
        nativeDate.getDate(),
        23,
        59,
        59
      );
      return jstDate;
    }
  }

  // ISO日付やその他の特定形式用
  if (input.match(/^\d{4}-\d{2}-\d{2}T/) || input.match(/^\d{4}\/\d{2}\/\d{2}T/)) {
    const nativeDate = new Date(input);
    if (!Number.isNaN(nativeDate.getTime())) {
      return nativeDate;
    }
  }

  return null;
}

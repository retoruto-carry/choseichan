/**
 * Date Parser Service
 *
 * ユーザー入力の日付文字列をパースするサービス
 * Domain層のユーティリティをApplication層でラップ
 */

import { parseUserInputDate } from '../../domain/utils/date';
import { generateId } from '../../domain/utils/id';

export class DateParserService {
  /**
   * ユーザー入力の日付文字列をDateオブジェクトに変換
   */
  parseUserDate(input: string): Date | null {
    return parseUserInputDate(input);
  }

  /**
   * ユニークなIDを生成
   */
  generateUniqueId(): string {
    return generateId();
  }
}

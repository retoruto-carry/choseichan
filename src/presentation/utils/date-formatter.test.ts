import { describe, expect, it } from 'vitest';
import { formatDate, formatDateShort } from './date-formatter';

describe('date-formatter', () => {
  describe('formatDateShort', () => {
    it('ISO形式の日付を短い形式でフォーマットできる', () => {
      // 2024-12-25T10:30:00.000Z (UTC) = 2024-12-25T19:30:00 (JST)
      expect(formatDateShort('2024-12-25T10:30:00.000Z')).toBe('12/25 19:30');
    });

    it('時刻が0時台でも正しくフォーマットできる', () => {
      // 2024-01-01T15:05:00.000Z (UTC) = 2024-01-02T00:05:00 (JST)
      expect(formatDateShort('2024-01-01T15:05:00.000Z')).toBe('1/2 00:05');
    });

    it('分が1桁でも0埋めされる', () => {
      // 2024-03-15T01:03:00.000Z (UTC) = 2024-03-15T10:03:00 (JST)
      expect(formatDateShort('2024-03-15T01:03:00.000Z')).toBe('3/15 10:03');
    });
  });

  describe('formatDate', () => {
    it('ISO形式の日付をJST形式でフォーマットできる', () => {
      // 2024-12-25T10:30:00.000Z (UTC) = 2024-12-25T19:30:00 (JST)
      expect(formatDate('2024-12-25T10:30:00.000Z')).toBe('12月25日(水) 19:30');
    });

    it('曜日が正しく表示される', () => {
      // 各曜日をテスト (すべてJST 12:00になるようUTC 03:00を指定)
      expect(formatDate('2024-01-01T03:00:00.000Z')).toBe('1月1日(月) 12:00'); // 月曜日
      expect(formatDate('2024-01-02T03:00:00.000Z')).toBe('1月2日(火) 12:00'); // 火曜日
      expect(formatDate('2024-01-03T03:00:00.000Z')).toBe('1月3日(水) 12:00'); // 水曜日
      expect(formatDate('2024-01-04T03:00:00.000Z')).toBe('1月4日(木) 12:00'); // 木曜日
      expect(formatDate('2024-01-05T03:00:00.000Z')).toBe('1月5日(金) 12:00'); // 金曜日
      expect(formatDate('2024-01-06T03:00:00.000Z')).toBe('1月6日(土) 12:00'); // 土曜日
      expect(formatDate('2024-01-07T03:00:00.000Z')).toBe('1月7日(日) 12:00'); // 日曜日
    });

    it('日付が変わる境界でも正しく処理される', () => {
      // 2024-12-31T15:00:00.000Z (UTC) = 2025-01-01T00:00:00 (JST)
      expect(formatDate('2024-12-31T15:00:00.000Z')).toBe('1月1日(水) 00:00');
    });

    it('空文字列はそのまま返される', () => {
      expect(formatDate('')).toBe('');
    });

    it('nullやundefinedは文字列に変換される', () => {
      expect(formatDate(null as any)).toBe('');
      expect(formatDate(undefined as any)).toBe('');
    });

    it('文字列以外の型は文字列に変換される', () => {
      expect(formatDate(123 as any)).toBe('123');
      expect(formatDate({} as any)).toBe('[object Object]');
    });

    it('無効な日付文字列はそのまま返される', () => {
      expect(formatDate('invalid-date')).toBe('invalid-date');
      expect(formatDate('2024-13-40T25:70:00.000Z')).toBe('2024-13-40T25:70:00.000Z');
    });

    it('時刻と分が0埋めされる', () => {
      // 2024-03-15T16:05:00.000Z (UTC) = 2024-03-16T01:05:00 (JST)
      expect(formatDate('2024-03-15T16:05:00.000Z')).toBe('3月16日(土) 01:05');
    });

    it('異なるタイムゾーンオフセットでも正しくJSTに変換される', () => {
      // +00:00 (UTC)
      expect(formatDate('2024-06-15T03:30:00+00:00')).toBe('6月15日(土) 12:30');
      // -05:00 (EST)
      expect(formatDate('2024-06-15T07:30:00-05:00')).toBe('6月15日(土) 21:30');
      // +09:00 (JST) - すでにJSTの場合
      expect(formatDate('2024-06-15T12:30:00+09:00')).toBe('6月15日(土) 12:30');
    });
  });
});

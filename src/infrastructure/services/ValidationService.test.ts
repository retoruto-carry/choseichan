import { describe, expect, it } from 'vitest';
import { ValidationService } from './ValidationService';

describe('バリデーションサービス', () => {
  describe('日付バリデーション', () => {
    it('有効な将来日付を適切にバリデーションする', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const result = ValidationService.validateDate(futureDate);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBeInstanceOf(Date);
    });

    it('過去の日付を拒否する', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const result = ValidationService.validateDate(pastDate);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('過去の日付');
    });

    it('無効な日付形式を拒否する', () => {
      const result = ValidationService.validateDate('invalid-date');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('無効な日付形式');
    });

    it('空の日付を拒否する', () => {
      const result = ValidationService.validateDate('');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('日付が空');
    });
  });

  describe('Discord IDバリデーション', () => {
    it('有効なDiscord IDをバリデーションする', () => {
      const validId = '123456789012345678';
      const result = ValidationService.validateDiscordId(validId);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe(validId);
    });

    it('短すぎるIDを拒否する', () => {
      const result = ValidationService.validateDiscordId('123456');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('無効なID形式');
    });

    it('非数値IDを拒否する', () => {
      const result = ValidationService.validateDiscordId('12345678901234567a');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('無効なID形式');
    });
  });

  describe('スケジュールタイトルバリデーション', () => {
    it('有効なタイトルをバリデーションする', () => {
      const result = ValidationService.validateScheduleTitle('テストスケジュール');

      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('テストスケジュール');
    });

    it('空のタイトルを拒否する', () => {
      const result = ValidationService.validateScheduleTitle('');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('テキストが空');
    });

    it('長すぎるタイトルを拒否する', () => {
      const longTitle = 'a'.repeat(101);
      const result = ValidationService.validateScheduleTitle(longTitle);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('100文字以内');
    });

    it('HTMLタグをサニタイズする', () => {
      const result = ValidationService.validateScheduleTitle('Test <script>alert("xss")</script>');

      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('Test alert("xss")');
    });
  });

  describe('リマインダータイミングバリデーション', () => {
    it('分単位のタイミングをバリデーションする', () => {
      const result = ValidationService.validateReminderTiming('30m');

      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('30m');
    });

    it('時間単位のタイミングをバリデーションする', () => {
      const result = ValidationService.validateReminderTiming('8h');

      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('8h');
    });

    it('日単位のタイミングをバリデーションする', () => {
      const result = ValidationService.validateReminderTiming('3d');

      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('3d');
    });

    it('無効な形式を拒否する', () => {
      const result = ValidationService.validateReminderTiming('invalid');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('無効なリマインダータイミング');
    });

    it('範囲外の分を拒否する', () => {
      const result = ValidationService.validateReminderTiming('2000m');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('1-1440の範囲');
    });

    it('範囲外の時間を拒否する', () => {
      const result = ValidationService.validateReminderTiming('200h');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('1-168の範囲');
    });

    it('範囲外の日数を拒否する', () => {
      const result = ValidationService.validateReminderTiming('50d');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('1-30の範囲');
    });
  });

  describe('回答ステータスバリデーション', () => {
    it('OKステータスをバリデーションする', () => {
      const result = ValidationService.validateResponseStatus('ok');

      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('ok');
    });

    it('未定ステータスをバリデーションする', () => {
      const result = ValidationService.validateResponseStatus('maybe');

      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('maybe');
    });

    it('NGステータスをバリデーションする', () => {
      const result = ValidationService.validateResponseStatus('ng');

      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('ng');
    });

    it('大文字小文字を区別しない入力を処理する', () => {
      const result = ValidationService.validateResponseStatus('OK');

      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('ok');
    });

    it('無効なステータスを拒否する', () => {
      const result = ValidationService.validateResponseStatus('invalid');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('無効なステータス');
    });
  });

  describe('複数バリデーション', () => {
    it('全てのバリデーションが成功した場合にパスする', () => {
      const result = ValidationService.validateMultiple([
        () => ValidationService.validateDiscordId('123456789012345678'),
        () => ValidationService.validateScheduleTitle('Test Title'),
        () => ValidationService.validateResponseStatus('ok'),
      ]);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toHaveLength(3);
    });

    it('いずれかのバリデーションが失敗した場合に失敗する', () => {
      const result = ValidationService.validateMultiple([
        () => ValidationService.validateDiscordId('123456789012345678'),
        () => ValidationService.validateScheduleTitle(''), // This will fail
        () => ValidationService.validateResponseStatus('ok'),
      ]);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('テキストが空');
    });

    it('should aggregate multiple errors', () => {
      const result = ValidationService.validateMultiple([
        () => ValidationService.validateDiscordId('invalid'), // Fail
        () => ValidationService.validateScheduleTitle(''), // Fail
      ]);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('無効なID形式');
      expect(result.error).toContain('テキストが空');
    });
  });
});

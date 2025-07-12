import { describe, expect, it } from 'vitest';
import { ValidationService } from './ValidationService';

describe('ValidationService', () => {
  describe('validateDate', () => {
    it('should validate valid future dates', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const result = ValidationService.validateDate(futureDate);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBeInstanceOf(Date);
    });

    it('should reject past dates', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const result = ValidationService.validateDate(pastDate);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('過去の日付');
    });

    it('should reject invalid date formats', () => {
      const result = ValidationService.validateDate('invalid-date');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('無効な日付形式');
    });

    it('should reject empty dates', () => {
      const result = ValidationService.validateDate('');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('日付が空');
    });
  });

  describe('validateDiscordId', () => {
    it('should validate valid Discord IDs', () => {
      const validId = '123456789012345678';
      const result = ValidationService.validateDiscordId(validId);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe(validId);
    });

    it('should reject too short IDs', () => {
      const result = ValidationService.validateDiscordId('123456');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('無効なID形式');
    });

    it('should reject non-numeric IDs', () => {
      const result = ValidationService.validateDiscordId('12345678901234567a');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('無効なID形式');
    });
  });

  describe('validateScheduleTitle', () => {
    it('should validate valid titles', () => {
      const result = ValidationService.validateScheduleTitle('テストスケジュール');
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('テストスケジュール');
    });

    it('should reject empty titles', () => {
      const result = ValidationService.validateScheduleTitle('');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('テキストが空');
    });

    it('should reject too long titles', () => {
      const longTitle = 'a'.repeat(101);
      const result = ValidationService.validateScheduleTitle(longTitle);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('100文字以内');
    });

    it('should sanitize HTML tags', () => {
      const result = ValidationService.validateScheduleTitle('Test <script>alert("xss")</script>');
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('Test alert("xss")');
    });
  });

  describe('validateReminderTiming', () => {
    it('should validate minute timings', () => {
      const result = ValidationService.validateReminderTiming('30m');
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('30m');
    });

    it('should validate hour timings', () => {
      const result = ValidationService.validateReminderTiming('8h');
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('8h');
    });

    it('should validate day timings', () => {
      const result = ValidationService.validateReminderTiming('3d');
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('3d');
    });

    it('should reject invalid formats', () => {
      const result = ValidationService.validateReminderTiming('invalid');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('無効なリマインダータイミング');
    });

    it('should reject out of range minutes', () => {
      const result = ValidationService.validateReminderTiming('2000m');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('1-1440の範囲');
    });

    it('should reject out of range hours', () => {
      const result = ValidationService.validateReminderTiming('200h');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('1-168の範囲');
    });

    it('should reject out of range days', () => {
      const result = ValidationService.validateReminderTiming('50d');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('1-30の範囲');
    });
  });

  describe('validateResponseStatus', () => {
    it('should validate ok status', () => {
      const result = ValidationService.validateResponseStatus('ok');
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('ok');
    });

    it('should validate maybe status', () => {
      const result = ValidationService.validateResponseStatus('maybe');
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('maybe');
    });

    it('should validate ng status', () => {
      const result = ValidationService.validateResponseStatus('ng');
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('ng');
    });

    it('should handle case insensitive input', () => {
      const result = ValidationService.validateResponseStatus('OK');
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toBe('ok');
    });

    it('should reject invalid statuses', () => {
      const result = ValidationService.validateResponseStatus('invalid');
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('無効なステータス');
    });
  });

  describe('validateMultiple', () => {
    it('should pass when all validations succeed', () => {
      const result = ValidationService.validateMultiple([
        () => ValidationService.validateDiscordId('123456789012345678'),
        () => ValidationService.validateScheduleTitle('Test Title'),
        () => ValidationService.validateResponseStatus('ok'),
      ]);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitizedValue).toHaveLength(3);
    });

    it('should fail when any validation fails', () => {
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
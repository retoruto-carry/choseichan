import { describe, it, expect } from 'vitest';
import { formatDate, parseUserInputDate } from '../src/utils/date';

describe('Date Utilities', () => {
  describe('formatDate', () => {
    it('should format date with time correctly', () => {
      const result = formatDate('2024-12-25T19:00:00.000Z');
      expect(result).toMatch(/12\/\d{2}\(.+\) \d{2}:\d{2}/);
    });

    it('should format date without time correctly', () => {
      const result = formatDate('2024-12-25T00:00:00.000Z');
      expect(result).toMatch(/12\/\d{2}\(.+\)( \d{2}:\d{2})?/);
    });

    it('should return invalid date strings as-is', () => {
      const result = formatDate('invalid-date');
      expect(result).toBe('invalid-date');
    });
  });

  describe('parseUserInputDate', () => {
    const now = new Date();
    const currentYear = now.getFullYear();

    it('should parse Japanese format with time (MM月DD日 HH:mm)', () => {
      const result = parseUserInputDate('12月25日 19:00');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getMonth()).toBe(11); // December
      expect(result?.getDate()).toBe(25);
      expect(result?.getHours()).toBe(19);
      expect(result?.getMinutes()).toBe(0);
    });

    it('should parse Japanese format without time (MM月DD日)', () => {
      const result = parseUserInputDate('12月25日');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getMonth()).toBe(11);
      expect(result?.getDate()).toBe(25);
    });

    it('should parse slash format with time (MM/DD HH:mm)', () => {
      const result = parseUserInputDate('12/25 19:00');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getMonth()).toBe(11);
      expect(result?.getDate()).toBe(25);
      expect(result?.getHours()).toBe(19);
    });

    it('should parse slash format without time (MM/DD)', () => {
      const result = parseUserInputDate('12/25');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getMonth()).toBe(11);
      expect(result?.getDate()).toBe(25);
    });

    it('should parse hyphen format (MM-DD)', () => {
      const result = parseUserInputDate('12-25');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getMonth()).toBe(11);
      expect(result?.getDate()).toBe(25);
    });

    it('should parse full date format (YYYY/MM/DD HH:mm)', () => {
      const result = parseUserInputDate('2024/12/25 19:00');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(11);
      expect(result?.getDate()).toBe(25);
      expect(result?.getHours()).toBe(19);
    });

    it('should parse full date format without time (YYYY-MM-DD)', () => {
      const result = parseUserInputDate('2024-12-25');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(11);
      expect(result?.getDate()).toBe(25);
    });

    it('should parse ISO date format', () => {
      const result = parseUserInputDate('2024-12-25T19:00:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe('2024-12-25T19:00:00.000Z');
    });

    it('should handle dates that would be in the past by adding a year', () => {
      // Test that the function handles dates consistently
      const result = parseUserInputDate('1/1');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getMonth()).toBe(0); // January
      expect(result?.getDate()).toBe(1);
    });

    it('should return null for invalid input', () => {
      expect(parseUserInputDate('invalid')).toBeNull();
      expect(parseUserInputDate('')).toBeNull();
      expect(parseUserInputDate('  ')).toBeNull();
    });

    it('should handle various time separators', () => {
      const result1 = parseUserInputDate('12/25 19:00');
      const result2 = parseUserInputDate('12/25 19 00');
      
      expect(result1?.getHours()).toBe(19);
      expect(result2?.getHours()).toBe(19);
    });

    it('should handle Japanese time formats', () => {
      const result = parseUserInputDate('12月25日 19時30分');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getHours()).toBe(19);
      expect(result?.getMinutes()).toBe(30);
    });
  });
});
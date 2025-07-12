import { describe, expect, it } from 'vitest';
import { formatDate, parseUserInputDate } from './date';

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
    const _currentYear = now.getFullYear();

    it('should parse Japanese format with time (MM月DD日 HH:mm)', () => {
      const result = parseUserInputDate('12月25日 19:00');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCMonth()).toBe(11); // December
      expect(result?.getUTCDate()).toBe(25);
      expect(result?.getUTCHours()).toBe(10); // 19:00 JST = 10:00 UTC
      expect(result?.getUTCMinutes()).toBe(0);
    });

    it('should parse Japanese format without time (MM月DD日)', () => {
      const result = parseUserInputDate('12月25日');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCMonth()).toBe(11);
      expect(result?.getUTCDate()).toBe(25);
      expect(result?.getUTCHours()).toBe(14); // 23:59 JST = 14:59 UTC
      expect(result?.getUTCMinutes()).toBe(59);
      expect(result?.getUTCSeconds()).toBe(59);
    });

    it('should parse slash format with time (MM/DD HH:mm)', () => {
      const result = parseUserInputDate('12/25 19:00');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCMonth()).toBe(11);
      expect(result?.getUTCDate()).toBe(25);
      expect(result?.getUTCHours()).toBe(10); // 19:00 JST = 10:00 UTC
    });

    it('should parse slash format without time (MM/DD)', () => {
      const result = parseUserInputDate('12/25');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCMonth()).toBe(11);
      expect(result?.getUTCDate()).toBe(25);
      expect(result?.getUTCHours()).toBe(14); // 23:59 JST = 14:59 UTC
      expect(result?.getUTCMinutes()).toBe(59);
      expect(result?.getUTCSeconds()).toBe(59);
    });

    it('should parse hyphen format (MM-DD)', () => {
      const result = parseUserInputDate('12-25');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCMonth()).toBe(11);
      expect(result?.getUTCDate()).toBe(25);
      expect(result?.getUTCHours()).toBe(14); // 23:59 JST = 14:59 UTC
      expect(result?.getUTCMinutes()).toBe(59);
      expect(result?.getUTCSeconds()).toBe(59);
    });

    it('should parse full date format (YYYY/MM/DD HH:mm)', () => {
      const result = parseUserInputDate('2024/12/25 19:00');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCFullYear()).toBe(2024);
      expect(result?.getUTCMonth()).toBe(11);
      expect(result?.getUTCDate()).toBe(25);
      expect(result?.getUTCHours()).toBe(10); // 19:00 JST = 10:00 UTC
    });

    it('should parse full date format without time (YYYY-MM-DD)', () => {
      const result = parseUserInputDate('2024-12-25');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCFullYear()).toBe(2024);
      expect(result?.getUTCMonth()).toBe(11);
      expect(result?.getUTCDate()).toBe(25);
      expect(result?.getUTCHours()).toBe(14); // 23:59 JST = 14:59 UTC
      expect(result?.getUTCMinutes()).toBe(59);
      expect(result?.getUTCSeconds()).toBe(59);
    });

    it('should parse 2026/01/04 as JST 23:59', () => {
      const result = parseUserInputDate('2026/01/04');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCFullYear()).toBe(2026);
      expect(result?.getUTCMonth()).toBe(0); // January is month 0
      expect(result?.getUTCDate()).toBe(4);
      expect(result?.getUTCHours()).toBe(14); // 23:59 JST = 14:59 UTC
      expect(result?.getUTCMinutes()).toBe(59);
      expect(result?.getUTCSeconds()).toBe(59);

      // Test that it formats back to JST correctly
      const formatted = formatDate(result?.toISOString() || '');
      expect(formatted).toContain('1/4');
      expect(formatted).toContain('23:59');
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
      expect(result?.getUTCMonth()).toBe(0); // January
      expect(result?.getUTCDate()).toBe(1);
    });

    it('should return null for invalid input', () => {
      expect(parseUserInputDate('invalid')).toBeNull();
      expect(parseUserInputDate('')).toBeNull();
      expect(parseUserInputDate('  ')).toBeNull();
    });

    it('should parse single number with slash as month/day (e.g. 7/11)', () => {
      const currentYear = new Date().getFullYear();
      const result = parseUserInputDate('7/11');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCMonth()).toBe(6); // July is month 6 (0-based)
      expect(result?.getUTCDate()).toBe(11);
      // Should be current year or next year if past
      expect(result?.getUTCFullYear()).toBeGreaterThanOrEqual(currentYear);
      expect(result?.getUTCHours()).toBe(14); // 23:59 JST = 14:59 UTC
      expect(result?.getUTCMinutes()).toBe(59);
      expect(result?.getUTCSeconds()).toBe(59);
    });

    it('should parse 04/23 as current year April 23rd 23:59 JST', () => {
      const currentYear = new Date().getFullYear();
      const result = parseUserInputDate('04/23');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCMonth()).toBe(3); // April is month 3 (0-based)
      expect(result?.getUTCDate()).toBe(23);
      expect(result?.getUTCFullYear()).toBeGreaterThanOrEqual(currentYear);
      expect(result?.getUTCHours()).toBe(14); // 23:59 JST = 14:59 UTC
      expect(result?.getUTCMinutes()).toBe(59);
      expect(result?.getUTCSeconds()).toBe(59);

      // Test that it formats back to JST correctly
      const formatted = formatDate(result?.toISOString() || '');
      expect(formatted).toContain('4/23');
      expect(formatted).toContain('23:59');
    });

    it('should validate month and day ranges', () => {
      expect(parseUserInputDate('13/1')).toBeNull(); // Invalid month
      expect(parseUserInputDate('12/32')).toBeNull(); // Invalid day
      expect(parseUserInputDate('0/15')).toBeNull(); // Invalid month
      expect(parseUserInputDate('6/0')).toBeNull(); // Invalid day
    });

    it('should handle various time separators', () => {
      const result1 = parseUserInputDate('12/25 19:00');
      const result2 = parseUserInputDate('12/25 19 00');

      expect(result1?.getUTCHours()).toBe(10); // 19:00 JST = 10:00 UTC
      expect(result2?.getUTCHours()).toBe(10); // 19:00 JST = 10:00 UTC
    });

    it('should handle Japanese time formats', () => {
      const result = parseUserInputDate('12月25日 19時30分');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCHours()).toBe(10); // 19:00 JST = 10:00 UTC
      expect(result?.getUTCMinutes()).toBe(30);
    });
  });
});

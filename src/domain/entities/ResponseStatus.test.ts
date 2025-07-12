import { describe, expect, it } from 'vitest';
import { ResponseStatus, ResponseStatusValue } from './ResponseStatus';

describe('ResponseStatus', () => {
  describe('create', () => {
    it('should create status with OK value', () => {
      const status = ResponseStatus.create(ResponseStatusValue.OK);
      expect(status.value).toBe(ResponseStatusValue.OK);
    });

    it('should create status with MAYBE value', () => {
      const status = ResponseStatus.create(ResponseStatusValue.MAYBE);
      expect(status.value).toBe(ResponseStatusValue.MAYBE);
    });

    it('should create status with NG value', () => {
      const status = ResponseStatus.create(ResponseStatusValue.NG);
      expect(status.value).toBe(ResponseStatusValue.NG);
    });

    it('should throw error for invalid value', () => {
      expect(() => ResponseStatus.create('invalid' as any)).toThrow('無効な回答ステータスです');
    });
  });

  describe('fromString', () => {
    it('should create from valid string values', () => {
      expect(ResponseStatus.fromString('ok').value).toBe(ResponseStatusValue.OK);
      expect(ResponseStatus.fromString('maybe').value).toBe(ResponseStatusValue.MAYBE);
      expect(ResponseStatus.fromString('ng').value).toBe(ResponseStatusValue.NG);
    });

    it('should return ng for invalid string', () => {
      expect(ResponseStatus.fromString('invalid').value).toBe(ResponseStatusValue.NG);
    });

    it('should return ng for empty string', () => {
      expect(ResponseStatus.fromString('').value).toBe(ResponseStatusValue.NG);
    });
  });

  describe('status checks', () => {
    it('should correctly identify OK status', () => {
      const status = ResponseStatus.create(ResponseStatusValue.OK);
      expect(status.isOK()).toBe(true);
      expect(status.isMaybe()).toBe(false);
      expect(status.isNG()).toBe(false);
    });

    it('should correctly identify MAYBE status', () => {
      const status = ResponseStatus.create(ResponseStatusValue.MAYBE);
      expect(status.isOK()).toBe(false);
      expect(status.isMaybe()).toBe(true);
      expect(status.isNG()).toBe(false);
    });

    it('should correctly identify NG status', () => {
      const status = ResponseStatus.create(ResponseStatusValue.NG);
      expect(status.isOK()).toBe(false);
      expect(status.isMaybe()).toBe(false);
      expect(status.isNG()).toBe(true);
    });
  });

  describe('toEmoji', () => {
    it('should return correct emoji for each status', () => {
      expect(ResponseStatus.create(ResponseStatusValue.OK).toEmoji()).toBe('○');
      expect(ResponseStatus.create(ResponseStatusValue.MAYBE).toEmoji()).toBe('△');
      expect(ResponseStatus.create(ResponseStatusValue.NG).toEmoji()).toBe('×');
    });
  });

  describe('toString', () => {
    it('should return string value', () => {
      expect(ResponseStatus.create(ResponseStatusValue.OK).toString()).toBe('ok');
      expect(ResponseStatus.create(ResponseStatusValue.MAYBE).toString()).toBe('maybe');
      expect(ResponseStatus.create(ResponseStatusValue.NG).toString()).toBe('ng');
    });
  });

  describe('equals', () => {
    it('should return true for same status', () => {
      const status1 = ResponseStatus.create(ResponseStatusValue.OK);
      const status2 = ResponseStatus.create(ResponseStatusValue.OK);
      expect(status1.equals(status2)).toBe(true);
    });

    it('should return false for different status', () => {
      const status1 = ResponseStatus.create(ResponseStatusValue.OK);
      const status2 = ResponseStatus.create(ResponseStatusValue.NG);
      expect(status1.equals(status2)).toBe(false);
    });
  });

  describe('ResponseStatusValue enum', () => {
    it('should have correct values', () => {
      expect(ResponseStatusValue.OK).toBe('ok');
      expect(ResponseStatusValue.MAYBE).toBe('maybe');
      expect(ResponseStatusValue.NG).toBe('ng');
    });
  });

  describe('static utilities', () => {
    it('should provide all valid values', () => {
      const values = ResponseStatus.getValidValues();
      expect(values).toEqual(['ok', 'maybe', 'ng']);
    });

    it('should validate status strings', () => {
      expect(ResponseStatus.isValidStatus('ok')).toBe(true);
      expect(ResponseStatus.isValidStatus('maybe')).toBe(true);
      expect(ResponseStatus.isValidStatus('ng')).toBe(true);
      expect(ResponseStatus.isValidStatus('invalid')).toBe(false);
      expect(ResponseStatus.isValidStatus('')).toBe(false);
      expect(ResponseStatus.isValidStatus(null as any)).toBe(false);
    });
  });

  describe('score calculation', () => {
    it('should return correct scores for each status', () => {
      expect(ResponseStatus.create(ResponseStatusValue.OK).getScore()).toBe(1);
      expect(ResponseStatus.create(ResponseStatusValue.MAYBE).getScore()).toBe(0.5);
      expect(ResponseStatus.create(ResponseStatusValue.NG).getScore()).toBe(0);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { generateId, createButtonId, parseButtonId } from '../src/utils/id';

describe('ID Utilities', () => {
  describe('generateId', () => {
    it('should generate a string ID', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('createButtonId', () => {
    it('should create button ID with action only', () => {
      const id = createButtonId('respond');
      expect(id).toBe('respond');
    });

    it('should create button ID with action and one parameter', () => {
      const id = createButtonId('respond', 'schedule123');
      expect(id).toBe('respond:schedule123');
    });

    it('should create button ID with action and multiple parameters', () => {
      const id = createButtonId('vote', 'schedule123', 'date456', 'yes');
      expect(id).toBe('vote:schedule123:date456:yes');
    });

    it('should handle empty parameters', () => {
      const id = createButtonId('action', '', 'param2');
      expect(id).toBe('action::param2');
    });

    it('should handle undefined parameters', () => {
      const id = createButtonId('action', undefined as any, 'param2');
      expect(id).toBe('action::param2');
    });
  });

  describe('parseButtonId', () => {
    it('should parse button ID with action only', () => {
      const result = parseButtonId('respond');
      expect(result.action).toBe('respond');
      expect(result.params).toEqual([]);
    });

    it('should parse button ID with action and one parameter', () => {
      const result = parseButtonId('respond:schedule123');
      expect(result.action).toBe('respond');
      expect(result.params).toEqual(['schedule123']);
    });

    it('should parse button ID with action and multiple parameters', () => {
      const result = parseButtonId('vote:schedule123:date456:yes');
      expect(result.action).toBe('vote');
      expect(result.params).toEqual(['schedule123', 'date456', 'yes']);
    });

    it('should handle empty parameters', () => {
      const result = parseButtonId('action::param2');
      expect(result.action).toBe('action');
      expect(result.params).toEqual(['', 'param2']);
    });

    it('should handle empty string', () => {
      const result = parseButtonId('');
      expect(result.action).toBe('');
      expect(result.params).toEqual([]);
    });

    it('should handle colons in parameters', () => {
      const result = parseButtonId('action:param:with:colons');
      expect(result.action).toBe('action');
      expect(result.params).toEqual(['param', 'with', 'colons']);
    });
  });

  describe('createButtonId and parseButtonId integration', () => {
    it('should round-trip correctly', () => {
      const original = {
        action: 'vote',
        params: ['schedule123', 'date456', 'yes']
      };
      
      const id = createButtonId(original.action, ...original.params);
      const parsed = parseButtonId(id);
      
      expect(parsed.action).toBe(original.action);
      expect(parsed.params).toEqual(original.params);
    });

    it('should handle complex scenarios', () => {
      const testCases = [
        { action: 'simple', params: [] },
        { action: 'with-dash', params: ['param1'] },
        { action: 'multiple', params: ['p1', 'p2', 'p3'] },
        { action: 'empty', params: ['', 'notEmpty', ''] }
      ];

      for (const testCase of testCases) {
        const id = createButtonId(testCase.action, ...testCase.params);
        const parsed = parseButtonId(id);
        expect(parsed.action).toBe(testCase.action);
        expect(parsed.params).toEqual(testCase.params.map(p => p || ''));
      }
    });
  });
});
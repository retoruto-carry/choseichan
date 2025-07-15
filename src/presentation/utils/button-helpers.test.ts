import { describe, expect, it } from 'vitest';
import { createButtonId, parseButtonId } from './button-helpers';

describe('Button Helpers', () => {
  describe('parseButtonId', () => {
    it('should parse single action button ID', () => {
      const result = parseButtonId('vote');
      expect(result.action).toBe('vote');
      expect(result.params).toEqual([]);
    });

    it('should parse button ID with parameters', () => {
      const result = parseButtonId('vote:schedule123:date456');
      expect(result.action).toBe('vote');
      expect(result.params).toEqual(['schedule123', 'date456']);
    });

    it('should handle empty string', () => {
      const result = parseButtonId('');
      expect(result.action).toBe('');
      expect(result.params).toEqual([]);
    });

    it('should handle colons in parameters', () => {
      const result = parseButtonId('action:param1:param:with:colons');
      expect(result.action).toBe('action');
      expect(result.params).toEqual(['param1', 'param', 'with', 'colons']);
    });

    it('should handle special characters', () => {
      const result = parseButtonId('edit_schedule:sch-123:日本語');
      expect(result.action).toBe('edit_schedule');
      expect(result.params).toEqual(['sch-123', '日本語']);
    });
  });

  describe('createButtonId', () => {
    it('should create button ID without parameters', () => {
      const id = createButtonId('vote');
      expect(id).toBe('vote');
    });

    it('should create button ID with single parameter', () => {
      const id = createButtonId('vote', 'schedule123');
      expect(id).toBe('vote:schedule123');
    });

    it('should create button ID with multiple parameters', () => {
      const id = createButtonId('vote', 'schedule123', 'date456', 'user789');
      expect(id).toBe('vote:schedule123:date456:user789');
    });

    it('should handle empty action', () => {
      const id = createButtonId('', 'param1');
      expect(id).toBe(':param1');
    });

    it('should handle empty parameters', () => {
      const id = createButtonId('action', '', '', 'param3');
      expect(id).toBe('action:::param3');
    });

    it('should handle special characters in parameters', () => {
      const id = createButtonId('edit', 'sch-123', '日本語');
      expect(id).toBe('edit:sch-123:日本語');
    });
  });

  describe('parseButtonId and createButtonId integration', () => {
    it('should be reversible', () => {
      const original = { action: 'vote', params: ['schedule123', 'date456'] };
      const id = createButtonId(original.action, ...original.params);
      const parsed = parseButtonId(id);
      expect(parsed).toEqual(original);
    });

    it('should handle complex cases', () => {
      const action = 'complex_action';
      const params = ['param-1', 'param_2', '日本語パラメータ', ''];
      const id = createButtonId(action, ...params);
      const parsed = parseButtonId(id);
      expect(parsed.action).toBe(action);
      expect(parsed.params).toEqual(params);
    });
  });
});

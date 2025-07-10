/**
 * User Domain Entity Unit Tests
 * 
 * ユーザーエンティティのユニットテスト
 */

import { describe, it, expect } from 'vitest';
import { User } from '../../../../src/domain/entities/User';

describe('User Domain Entity', () => {
  describe('User Creation', () => {
    it('should create a valid user with required fields', () => {
      const user = User.create('user123', 'testuser');
      
      expect(user.id).toBe('user123');
      expect(user.username).toBe('testuser');
    });

    it('should throw error for empty id', () => {
      expect(() => {
        User.create('', 'testuser');
      }).toThrow('ユーザーIDは必須です');
    });

    it('should throw error for empty username', () => {
      expect(() => {
        User.create('user123', '');
      }).toThrow('ユーザー名は必須です');
    });

    it('should throw error for too long username', () => {
      const longUsername = 'a'.repeat(33); // Over 32 characters
      
      expect(() => {
        User.create('user123', longUsername);
      }).toThrow('ユーザー名は32文字以下で入力してください');
    });

    it('should handle unicode characters in username', () => {
      const unicodeUsername = '日本語ユーザー';
      const user = User.create('user123', unicodeUsername);
      
      expect(user.username).toBe(unicodeUsername);
    });
  });

  describe('User Operations', () => {
    it('should convert to primitives', () => {
      const user = User.create('user123', 'testuser');
      const primitives = user.toPrimitives();
      
      expect(primitives.id).toBe('user123');
      expect(primitives.username).toBe('testuser');
    });

    it('should create user from primitives', () => {
      const primitives = {
        id: 'user123',
        username: 'testuser'
      };

      const user = User.fromPrimitives(primitives);
      
      expect(user.id).toBe('user123');
      expect(user.username).toBe('testuser');
    });

    it('should check equality', () => {
      const user1 = User.create('user123', 'testuser');
      const user2 = User.create('user123', 'testuser');
      const user3 = User.create('user456', 'testuser');
      
      expect(user1.equals(user2)).toBe(true);
      expect(user1.equals(user3)).toBe(false);
    });

    it('should update username', () => {
      const user = User.create('user123', 'oldname');
      const updatedUser = user.updateUsername('newname');
      
      expect(updatedUser.username).toBe('newname');
      expect(updatedUser.id).toBe('user123');
      expect(user.username).toBe('oldname'); // Original unchanged
    });
  });

  describe('User Immutability', () => {
    it('should not modify original user when updating', () => {
      const originalUser = User.create('user123', 'original');
      const updatedUser = originalUser.updateUsername('updated');
      
      expect(originalUser.username).toBe('original');
      expect(updatedUser.username).toBe('updated');
      expect(originalUser).not.toBe(updatedUser);
    });
  });
});
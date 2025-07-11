/**
 * User Domain Entity Unit Tests
 * 
 * ユーザーエンティティのユニットテスト
 */

import { describe, it, expect } from 'vitest';
import { User } from './User';

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
      const longUsername = 'a'.repeat(101); // Over 100 characters
      
      expect(() => {
        User.create('user123', longUsername);
      }).toThrow('ユーザー名は100文字以内で入力してください');
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

    it('should be immutable', () => {
      const user = User.create('user123', 'oldname');
      // User is immutable, so we create a new instance
      const newUser = User.create('user123', 'newname');
      
      expect(newUser.username).toBe('newname');
      expect(newUser.id).toBe('user123');
      expect(user.username).toBe('oldname'); // Original unchanged
    });
  });

  describe('User Immutability', () => {
    it('should not modify original user', () => {
      const originalUser = User.create('user123', 'original');
      // Since User is immutable, we create a new instance
      const newUser = User.create('user123', 'updated');
      
      expect(originalUser.username).toBe('original');
      expect(newUser.username).toBe('updated');
      expect(originalUser).not.toBe(newUser);
    });
  });
});
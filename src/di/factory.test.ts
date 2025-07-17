/**
 * factory テスト
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { D1RepositoryFactory } from '../infrastructure/repositories/d1/factory';
import type { Env } from '../infrastructure/types/discord';
import {
  createDatabaseConfig,
  createRepositoryFactory,
  getRepositoryFactory,
} from './factory';

vi.mock('../infrastructure/repositories/d1/factory');

describe('factory', () => {
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEnv = {
      DB: {} as D1Database,
      DISCORD_PUBLIC_KEY: 'test-key',
      DISCORD_APPLICATION_ID: 'test-app',
      DISCORD_TOKEN: 'test-token',
      MESSAGE_UPDATE_QUEUE: {} as any,
    } as Env;
  });

  describe('createDatabaseConfig', () => {
    it('should create D1 database config from environment', () => {
      const config = createDatabaseConfig(mockEnv);

      expect(config).toEqual({
        type: 'd1',
        d1Database: mockEnv.DB,
      });
    });

    it('should throw error when DB is not configured', () => {
      const envWithoutDB = {
        ...mockEnv,
        DB: undefined,
      } as any;

      expect(() => createDatabaseConfig(envWithoutDB)).toThrow(
        'D1 database (DB) is required but not configured'
      );
    });
  });

  describe('createRepositoryFactory', () => {
    it('should create D1RepositoryFactory', () => {
      const factory = createRepositoryFactory(mockEnv);

      expect(D1RepositoryFactory).toHaveBeenCalledWith({
        type: 'd1',
        d1Database: mockEnv.DB,
      });
      expect(factory).toBeInstanceOf(D1RepositoryFactory);
    });

    it('should throw error when DB is not configured', () => {
      const envWithoutDB = {
        ...mockEnv,
        DB: undefined,
      } as any;

      expect(() => createRepositoryFactory(envWithoutDB)).toThrow(
        'D1 database (DB) is required but not configured'
      );
    });
  });

  describe('getRepositoryFactory', () => {
    it('should create and return a repository factory', () => {
      const factory = getRepositoryFactory(mockEnv);

      expect(D1RepositoryFactory).toHaveBeenCalledWith({
        type: 'd1',
        d1Database: mockEnv.DB,
      });
      expect(factory).toBeInstanceOf(D1RepositoryFactory);
    });

    it('should create new factory when forceNew is true', () => {
      // forceNew=trueで新しいファクトリが作成されることを確認
      getRepositoryFactory(mockEnv, true);

      expect(D1RepositoryFactory).toHaveBeenCalledWith({
        type: 'd1',
        d1Database: mockEnv.DB,
      });
    });

  });
});
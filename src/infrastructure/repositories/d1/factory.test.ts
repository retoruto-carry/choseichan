import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1DatabaseConfig } from '../../types/database';
import { D1RepositoryFactory } from './factory';
import { D1ResponseRepository } from './response-repository';
import { D1ScheduleRepository } from './schedule-repository';

// Mock Logger
vi.mock('../../logging/Logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock D1Database
const createMockD1Database = () => {
  const mockStatement = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true }),
  };

  return {
    prepare: vi.fn().mockReturnValue(mockStatement),
    batch: vi.fn().mockResolvedValue([]),
    _mockStatement: mockStatement,
  };
};

describe('D1RepositoryFactory', () => {
  let factory: D1RepositoryFactory;
  let mockDb: ReturnType<typeof createMockD1Database>;
  let config: D1DatabaseConfig;

  beforeEach(() => {
    mockDb = createMockD1Database();
    config = {
      type: 'd1',
      d1Database: mockDb as unknown as D1Database,
    };
    factory = new D1RepositoryFactory(config);
  });

  describe('constructor', () => {
    it('should create factory with D1 config', () => {
      expect(factory).toBeDefined();
      expect(factory.getScheduleRepository()).toBeInstanceOf(D1ScheduleRepository);
      expect(factory.getResponseRepository()).toBeInstanceOf(D1ResponseRepository);
    });

    it('should throw error with invalid config', () => {
      const invalidConfig: D1DatabaseConfig = {
        type: 'kv' as any,
        d1Database: null as any,
      };

      expect(() => new D1RepositoryFactory(invalidConfig)).toThrow(
        'Invalid configuration for D1 repository factory'
      );
    });
  });

  describe('getScheduleRepository', () => {
    it('should return the same instance', () => {
      const repo1 = factory.getScheduleRepository();
      const repo2 = factory.getScheduleRepository();

      expect(repo1).toBe(repo2);
    });
  });

  describe('getResponseRepository', () => {
    it('should return the same instance', () => {
      const repo1 = factory.getResponseRepository();
      const repo2 = factory.getResponseRepository();

      expect(repo1).toBe(repo2);
    });
  });

  describe('beginTransaction', () => {
    it('should create a new transaction', async () => {
      const transaction = await factory.beginTransaction();

      expect(transaction).toBeDefined();
      expect((transaction as any).isActive()).toBe(true);
    });
  });

  describe('initialize', () => {
    it('should complete without errors', async () => {
      await expect(factory.initialize()).resolves.not.toThrow();
    });
  });

  // Note: cleanupExpiredData removed - expires_at fields no longer exist
});

describe('D1Transaction', () => {
  let mockDb: ReturnType<typeof createMockD1Database>;
  let config: D1DatabaseConfig;
  let factory: D1RepositoryFactory;

  beforeEach(() => {
    mockDb = createMockD1Database();
    config = {
      type: 'd1',
      d1Database: mockDb as unknown as D1Database,
    };
    factory = new D1RepositoryFactory(config);
  });

  describe('addOperation', () => {
    it('should add operations to transaction', async () => {
      const transaction = await factory.beginTransaction();
      const operation = vi.fn().mockResolvedValue('result');

      await (transaction as any).addOperation(operation);

      expect((transaction as any).isActive()).toBe(true);
    });

    it('should throw error if transaction already completed', async () => {
      const transaction = await factory.beginTransaction();
      await transaction.commit();

      const operation = vi.fn();
      await expect((transaction as any).addOperation(operation)).rejects.toThrow(
        'Transaction already completed'
      );
    });
  });

  describe('commit', () => {
    it('should execute all operations', async () => {
      const transaction = await factory.beginTransaction();
      const operation1 = vi.fn().mockResolvedValue('result1');
      const operation2 = vi.fn().mockResolvedValue('result2');

      await (transaction as any).addOperation(operation1);
      await (transaction as any).addOperation(operation2);
      await transaction.commit();

      expect(operation1).toHaveBeenCalled();
      expect(operation2).toHaveBeenCalled();
      expect((transaction as any).isActive()).toBe(false);
    });

    it('should rollback on operation failure', async () => {
      const transaction = await factory.beginTransaction();
      const operation1 = vi.fn().mockResolvedValue('result1');
      const operation2 = vi.fn().mockRejectedValue(new Error('Operation failed'));

      await (transaction as any).addOperation(operation1);
      await (transaction as any).addOperation(operation2);

      await expect(transaction.commit()).rejects.toThrow('Transaction commit failed');
      expect((transaction as any).isActive()).toBe(false);
    });

    it('should throw error if already committed', async () => {
      const transaction = await factory.beginTransaction();
      await transaction.commit();

      await expect(transaction.commit()).rejects.toThrow('Transaction already completed');
    });
  });

  describe('rollback', () => {
    it('should mark transaction as rolled back', async () => {
      const transaction = await factory.beginTransaction();
      const operation = vi.fn();

      await (transaction as any).addOperation(operation);
      await transaction.rollback();

      expect((transaction as any).isActive()).toBe(false);
    });

    it('should throw error if already completed', async () => {
      const transaction = await factory.beginTransaction();
      await transaction.commit();

      await expect(transaction.rollback()).rejects.toThrow('Transaction already completed');
    });
  });

  describe('isActive', () => {
    it('should return true for new transaction', async () => {
      const transaction = await factory.beginTransaction();

      expect((transaction as any).isActive()).toBe(true);
    });

    it('should return false after commit', async () => {
      const transaction = await factory.beginTransaction();
      await transaction.commit();

      expect((transaction as any).isActive()).toBe(false);
    });

    it('should return false after rollback', async () => {
      const transaction = await factory.beginTransaction();
      await transaction.rollback();

      expect((transaction as any).isActive()).toBe(false);
    });
  });
});

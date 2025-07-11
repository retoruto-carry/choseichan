import { describe, it, expect, vi, beforeEach } from 'vitest';
import { D1RepositoryFactory } from './factory';
import { DatabaseConfig, TransactionError } from '../../../domain/repositories/interfaces';
import { D1ScheduleRepository } from './schedule-repository';
import { D1ResponseRepository } from './response-repository';

// Mock D1Database
const createMockD1Database = () => {
  const mockStatement = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true })
  };
  
  return {
    prepare: vi.fn().mockReturnValue(mockStatement),
    batch: vi.fn().mockResolvedValue([]),
    _mockStatement: mockStatement
  };
};

describe('D1RepositoryFactory', () => {
  let factory: D1RepositoryFactory;
  let mockDb: ReturnType<typeof createMockD1Database>;
  let config: DatabaseConfig;

  beforeEach(() => {
    mockDb = createMockD1Database();
    config = {
      type: 'd1',
      d1Database: mockDb as unknown as D1Database
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
      const invalidConfig: DatabaseConfig = {
        type: 'kv' as any
      };

      expect(() => new D1RepositoryFactory(invalidConfig)).toThrow('Invalid configuration for D1 repository factory');
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
      expect(transaction.isActive()).toBe(true);
    });
  });

  describe('initialize', () => {
    it('should log initialization', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await factory.initialize();

      expect(consoleSpy).toHaveBeenCalledWith('D1 database initialized');
      
      consoleSpy.mockRestore();
    });
  });

  describe('cleanupExpiredData', () => {
    it('should cleanup expired schedules and responses', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await factory.cleanupExpiredData();

      // Verify cleanup queries were executed
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM schedules WHERE expires_at < ?'));
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM responses WHERE expires_at < ?'));
      
      expect(consoleSpy).toHaveBeenCalledWith('Expired data cleanup completed');
      
      consoleSpy.mockRestore();
    });

    it('should handle cleanup errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockDb._mockStatement.run.mockRejectedValueOnce(new Error('Database error'));

      await expect(factory.cleanupExpiredData()).rejects.toThrow(TransactionError);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to cleanup expired data:', expect.any(Error));
      
      consoleErrorSpy.mockRestore();
    });
  });
});

describe('D1Transaction', () => {
  let mockDb: ReturnType<typeof createMockD1Database>;
  let config: DatabaseConfig;
  let factory: D1RepositoryFactory;

  beforeEach(() => {
    mockDb = createMockD1Database();
    config = {
      type: 'd1',
      d1Database: mockDb as unknown as D1Database
    };
    factory = new D1RepositoryFactory(config);
  });

  describe('addOperation', () => {
    it('should add operations to transaction', async () => {
      const transaction = await factory.beginTransaction();
      const operation = vi.fn().mockResolvedValue('result');

      await transaction.addOperation(operation);

      expect(transaction.isActive()).toBe(true);
    });

    it('should throw error if transaction already completed', async () => {
      const transaction = await factory.beginTransaction();
      await transaction.commit();

      const operation = vi.fn();
      await expect(transaction.addOperation(operation)).rejects.toThrow('Transaction already completed');
    });
  });

  describe('commit', () => {
    it('should execute all operations', async () => {
      const transaction = await factory.beginTransaction();
      const operation1 = vi.fn().mockResolvedValue('result1');
      const operation2 = vi.fn().mockResolvedValue('result2');

      await transaction.addOperation(operation1);
      await transaction.addOperation(operation2);
      await transaction.commit();

      expect(operation1).toHaveBeenCalled();
      expect(operation2).toHaveBeenCalled();
      expect(transaction.isActive()).toBe(false);
    });

    it('should rollback on operation failure', async () => {
      const transaction = await factory.beginTransaction();
      const operation1 = vi.fn().mockResolvedValue('result1');
      const operation2 = vi.fn().mockRejectedValue(new Error('Operation failed'));

      await transaction.addOperation(operation1);
      await transaction.addOperation(operation2);

      await expect(transaction.commit()).rejects.toThrow('Transaction commit failed');
      expect(transaction.isActive()).toBe(false);
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

      await transaction.addOperation(operation);
      await transaction.rollback();

      expect(transaction.isActive()).toBe(false);
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

      expect(transaction.isActive()).toBe(true);
    });

    it('should return false after commit', async () => {
      const transaction = await factory.beginTransaction();
      await transaction.commit();

      expect(transaction.isActive()).toBe(false);
    });

    it('should return false after rollback', async () => {
      const transaction = await factory.beginTransaction();
      await transaction.rollback();

      expect(transaction.isActive()).toBe(false);
    });
  });
});
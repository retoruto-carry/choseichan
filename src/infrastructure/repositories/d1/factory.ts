/**
 * D1実装のリポジトリファクトリ
 */

import { 
  IRepositoryFactory, 
  IScheduleRepository, 
  IResponseRepository, 
  ITransaction,
  DatabaseConfig,
  TransactionError 
} from '../../../domain/repositories/interfaces';
import { D1ScheduleRepository } from './schedule-repository';
import { D1ResponseRepository } from './response-repository';
import { DomainScheduleRepositoryAdapter } from '../adapters/DomainScheduleRepositoryAdapter';
import { DomainResponseRepositoryAdapter } from '../adapters/DomainResponseRepositoryAdapter';

/**
 * D1トランザクション実装
 */
class D1Transaction implements ITransaction {
  private committed = false;
  private rolledBack = false;
  private operations: Array<() => Promise<any>> = [];

  constructor(private db: D1Database) {}

  async addOperation(operation: () => Promise<any>): Promise<void> {
    if (this.committed || this.rolledBack) {
      throw new TransactionError('Transaction already completed');
    }
    this.operations.push(operation);
  }

  async commit(): Promise<void> {
    if (this.committed || this.rolledBack) {
      throw new TransactionError('Transaction already completed');
    }

    try {
      // D1 doesn't support true transactions across multiple statements,
      // but we can use batch for atomic operations
      if (this.operations.length > 0) {
        await Promise.all(this.operations.map(op => op()));
      }
      this.committed = true;
    } catch (error) {
      await this.rollback();
      throw new TransactionError('Transaction commit failed', error as Error);
    }
  }

  async rollback(): Promise<void> {
    if (this.committed || this.rolledBack) {
      throw new TransactionError('Transaction already completed');
    }
    
    // In D1, we can't truly rollback, but we can prevent further operations
    this.rolledBack = true;
    this.operations = [];
  }

  isActive(): boolean {
    return !this.committed && !this.rolledBack;
  }
}

export class D1RepositoryFactory implements IRepositoryFactory {
  private scheduleRepository: IScheduleRepository;
  private responseRepository: IResponseRepository;
  private db: D1Database;

  constructor(config: DatabaseConfig) {
    if (config.type !== 'd1' || !config.d1Database) {
      throw new Error('Invalid configuration for D1 repository factory');
    }

    this.db = config.d1Database;
    const d1ScheduleRepo = new D1ScheduleRepository(this.db);
    const d1ResponseRepo = new D1ResponseRepository(this.db, d1ScheduleRepo);
    
    this.scheduleRepository = new DomainScheduleRepositoryAdapter(d1ScheduleRepo);
    this.responseRepository = new DomainResponseRepositoryAdapter(d1ResponseRepo);
  }

  getScheduleRepository(): IScheduleRepository {
    return this.scheduleRepository;
  }

  getResponseRepository(): IResponseRepository {
    return this.responseRepository;
  }

  async beginTransaction(): Promise<ITransaction> {
    return new D1Transaction(this.db);
  }

  /**
   * データベースの初期化（マイグレーション実行）
   */
  async initialize(): Promise<void> {
    // This would typically run migrations, but for now we assume
    // migrations are handled by wrangler d1 migrations
    console.log('D1 database initialized');
  }

  /**
   * 期限切れデータのクリーンアップ
   */
  async cleanupExpiredData(): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      
      // Delete expired schedules (cascade will handle related tables)
      await this.db.prepare(`
        DELETE FROM schedules WHERE expires_at < ?
      `).bind(now).run();
      
      // Delete orphaned expired responses
      await this.db.prepare(`
        DELETE FROM responses WHERE expires_at < ?
      `).bind(now).run();
      
      console.log('Expired data cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup expired data:', error);
      throw new TransactionError('Cleanup failed', error as Error);
    }
  }
}
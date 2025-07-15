/**
 * D1実装のリポジトリファクトリ
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  IRepositoryFactory,
  IResponseRepository,
  IScheduleRepository,
  ITransaction,
} from '../../../domain/repositories/interfaces';
import { getLogger } from '../../logging/Logger';
import type { D1DatabaseConfig } from '../../types/database';
import { TransactionError } from '../errors';
import { D1ResponseRepository } from './response-repository';
import { D1ScheduleRepository } from './schedule-repository';

const logger = getLogger();

/**
 * D1トランザクション実装
 */
class D1Transaction implements ITransaction {
  private committed = false;
  private rolledBack = false;
  private operations: Array<() => Promise<unknown>> = [];

  constructor(private db: D1Database) {}

  async addOperation(operation: () => Promise<unknown>): Promise<void> {
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
        await Promise.all(this.operations.map((op) => op()));
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

  constructor(config: D1DatabaseConfig) {
    if (config.type !== 'd1' || !config.d1Database) {
      throw new Error('Invalid configuration for D1 repository factory');
    }

    this.db = config.d1Database;
    this.scheduleRepository = new D1ScheduleRepository(this.db);
    this.responseRepository = new D1ResponseRepository(this.db, this.scheduleRepository);
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
    // マイグレーションはwrangler d1 migrationsで管理
    logger.info('D1データベースを初期化しました');
  }

  /**
   * 期限切れデータのクリーンアップ
   */
  async cleanupExpiredData(): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);

      // Delete expired schedules (cascade will handle related tables)
      await this.db
        .prepare(`
        DELETE FROM schedules WHERE expires_at < ?
      `)
        .bind(now)
        .run();

      // Delete orphaned expired responses
      await this.db
        .prepare(`
        DELETE FROM responses WHERE expires_at < ?
      `)
        .bind(now)
        .run();

      logger.info('期限切れデータのクリーンアップが完了しました');
    } catch (error) {
      logger.error(
        '期限切れデータのクリーンアップに失敗しました',
        error instanceof Error ? error : new Error(String(error))
      );
      throw new TransactionError('Cleanup failed', error as Error);
    }
  }
}

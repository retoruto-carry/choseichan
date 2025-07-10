/**
 * リポジトリインターフェース定義
 * KVとD1の実装を切り替え可能にするための抽象層
 */

import { Schedule, Response, ScheduleSummary } from '../types/schedule-v2';

/**
 * スケジュールリポジトリのインターフェース
 */
export interface IScheduleRepository {
  /**
   * スケジュールを保存
   */
  save(schedule: Schedule): Promise<void>;

  /**
   * スケジュールを取得
   */
  findById(scheduleId: string, guildId: string): Promise<Schedule | null>;

  /**
   * チャンネル内のスケジュール一覧を取得
   */
  findByChannel(channelId: string, guildId: string, limit?: number): Promise<Schedule[]>;

  /**
   * 締切が指定期間内のスケジュールを取得
   */
  findByDeadlineRange(
    startTime: Date, 
    endTime: Date, 
    guildId?: string
  ): Promise<Schedule[]>;

  /**
   * スケジュールを削除
   */
  delete(scheduleId: string, guildId: string): Promise<void>;

  /**
   * メッセージIDでスケジュールを検索
   */
  findByMessageId(messageId: string, guildId: string): Promise<Schedule | null>;

  /**
   * ギルド内の全スケジュール数を取得
   */
  countByGuild(guildId: string): Promise<number>;
}

/**
 * レスポンスリポジトリのインターフェース
 */
export interface IResponseRepository {
  /**
   * レスポンスを保存（アップサート）
   */
  save(response: Response, guildId: string): Promise<void>;

  /**
   * 特定のユーザーのレスポンスを取得
   */
  findByUser(
    scheduleId: string, 
    userId: string, 
    guildId: string
  ): Promise<Response | null>;

  /**
   * スケジュールの全レスポンスを取得
   */
  findBySchedule(scheduleId: string, guildId: string): Promise<Response[]>;

  /**
   * レスポンスを削除
   */
  delete(scheduleId: string, userId: string, guildId: string): Promise<void>;

  /**
   * スケジュールの全レスポンスを削除
   */
  deleteBySchedule(scheduleId: string, guildId: string): Promise<void>;

  /**
   * スケジュールのサマリー情報を取得（集計済み）
   */
  getScheduleSummary(scheduleId: string, guildId: string): Promise<ScheduleSummary | null>;
}

/**
 * トランザクション管理インターフェース
 */
export interface ITransaction {
  /**
   * トランザクションをコミット
   */
  commit(): Promise<void>;

  /**
   * トランザクションをロールバック
   */
  rollback(): Promise<void>;
}

/**
 * リポジトリファクトリインターフェース
 */
export interface IRepositoryFactory {
  /**
   * スケジュールリポジトリを取得
   */
  getScheduleRepository(): IScheduleRepository;

  /**
   * レスポンスリポジトリを取得
   */
  getResponseRepository(): IResponseRepository;

  /**
   * トランザクションを開始
   */
  beginTransaction?(): Promise<ITransaction | undefined>;
}

/**
 * データベース接続設定
 */
export interface DatabaseConfig {
  type: 'kv' | 'd1';
  kvNamespaces?: {
    schedules: KVNamespace;
    responses: KVNamespace;
  };
  d1Database?: D1Database;
}

/**
 * クエリオプション
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

/**
 * バッチ操作結果
 */
export interface BatchOperationResult {
  success: number;
  failed: number;
  errors?: Error[];
}

/**
 * リポジトリエラークラス
 */
export class RepositoryError extends Error {
  constructor(
    message: string, 
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class NotFoundError extends RepositoryError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, 'NOT_FOUND');
  }
}

export class ConflictError extends RepositoryError {
  constructor(message: string) {
    super(message, 'CONFLICT');
  }
}

export class TransactionError extends RepositoryError {
  constructor(message: string, originalError?: Error) {
    super(message, 'TRANSACTION_ERROR', originalError);
  }
}
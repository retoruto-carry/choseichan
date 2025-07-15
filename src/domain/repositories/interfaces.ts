/**
 * リポジトリインターフェース定義
 * KVとD1の実装を切り替え可能にするための抽象層
 */

import type { DomainResponse, DomainSchedule, DomainScheduleSummary } from '../types/DomainTypes';

/**
 * スケジュールリポジトリのインターフェース
 */
export interface IScheduleRepository {
  /**
   * スケジュールを保存
   */
  save(schedule: DomainSchedule): Promise<void>;

  /**
   * スケジュールを取得
   */
  findById(scheduleId: string, guildId: string): Promise<DomainSchedule | null>;

  /**
   * チャンネル内のスケジュール一覧を取得
   */
  findByChannel(channelId: string, guildId: string, limit?: number): Promise<DomainSchedule[]>;

  /**
   * 締切が指定期間内のスケジュールを取得
   */
  findByDeadlineRange(startTime: Date, endTime: Date, guildId?: string): Promise<DomainSchedule[]>;

  /**
   * スケジュールを削除
   */
  delete(scheduleId: string, guildId: string): Promise<void>;

  /**
   * メッセージIDでスケジュールを検索
   */
  findByMessageId(messageId: string, guildId: string): Promise<DomainSchedule | null>;

  /**
   * ギルド内の全スケジュール数を取得
   */
  countByGuild(guildId: string): Promise<number>;

  /**
   * リマインダー送信状況を更新
   */
  updateReminders(params: {
    scheduleId: string;
    guildId: string;
    remindersSent: string[];
    reminderSent?: boolean;
  }): Promise<void>;
}

/**
 * レスポンスリポジトリのインターフェース
 */
export interface IResponseRepository {
  /**
   * レスポンスを保存（アップサート）
   */
  save(response: DomainResponse, guildId: string): Promise<void>;

  /**
   * 特定のユーザーのレスポンスを取得
   */
  findByUser(scheduleId: string, userId: string, guildId: string): Promise<DomainResponse | null>;

  /**
   * スケジュールの全レスポンスを取得
   */
  findByScheduleId(scheduleId: string, guildId: string): Promise<DomainResponse[]>;

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
  getScheduleSummary(scheduleId: string, guildId: string): Promise<DomainScheduleSummary | null>;
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
 * 具体的な実装詳細はInfrastructure層で定義
 */
export interface DatabaseConfig {
  type: string;
  [key: string]: unknown;
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
 * リポジトリエラーは Infrastructure/repositories/errors.ts に移動されました
 * Domain層はインフラ技術の詳細を知るべきではないため、
 * 具体的なエラー処理はInfrastructure層で行います
 */

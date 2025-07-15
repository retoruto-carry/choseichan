/**
 * データベースタイプに応じたリポジトリファクトリを作成
 */

import type { IRepositoryFactory } from '../domain/repositories/interfaces';
import { D1RepositoryFactory } from '../infrastructure/repositories/d1/factory';
import type { D1DatabaseConfig } from '../infrastructure/types/database';
import type { Env } from '../infrastructure/types/discord';

/**
 * 環境変数からデータベース設定を作成
 */
export function createDatabaseConfig(env: Env): D1DatabaseConfig {
  // D1データベースのみサポート
  if (!env.DB) {
    throw new Error('D1 database (DB) is required but not configured');
  }

  return {
    type: 'd1',
    d1Database: env.DB,
  };
}

/**
 * 環境に応じたリポジトリファクトリを作成
 */
export function createRepositoryFactory(env: Env): IRepositoryFactory {
  const config = createDatabaseConfig(env);
  return new D1RepositoryFactory(config);
}

/**
 * リポジトリファクトリのキャッシュ（Worker内で再利用）
 */
let cachedFactory: IRepositoryFactory | null = null;

export function getRepositoryFactory(env: Env, forceNew = false): IRepositoryFactory {
  if (!cachedFactory || forceNew) {
    cachedFactory = createRepositoryFactory(env);
  }
  return cachedFactory;
}

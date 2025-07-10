/**
 * データベースタイプに応じたリポジトリファクトリを作成
 */

import { IRepositoryFactory, DatabaseConfig } from './interfaces';
import { KVRepositoryFactory } from './kv/factory';
import { D1RepositoryFactory } from './d1/factory';
import { Env } from '../types/discord';

/**
 * 環境変数からデータベース設定を作成
 */
export function createDatabaseConfig(env: Env): DatabaseConfig {
  // DATABASE_TYPE環境変数でKVとD1を切り替え
  const dbType = env.DATABASE_TYPE || 'kv';
  
  if (dbType === 'd1' && env.DB) {
    return {
      type: 'd1',
      d1Database: env.DB
    };
  }
  
  // デフォルトはKV
  return {
    type: 'kv',
    kvNamespaces: {
      schedules: env.SCHEDULES,
      responses: env.RESPONSES
    }
  };
}

/**
 * 環境に応じたリポジトリファクトリを作成
 */
export function createRepositoryFactory(env: Env): IRepositoryFactory {
  const config = createDatabaseConfig(env);
  
  switch (config.type) {
    case 'd1':
      return new D1RepositoryFactory(config);
    case 'kv':
    default:
      return new KVRepositoryFactory(config);
  }
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
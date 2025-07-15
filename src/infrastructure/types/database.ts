/**
 * Infrastructure層のデータベース設定
 * Cloudflare D1特有の実装詳細を含む
 */

import type { D1Database } from '@cloudflare/workers-types';

/**
 * D1データベース設定
 */
export interface D1DatabaseConfig {
  type: 'd1';
  d1Database: D1Database;
}

/**
 * データベース設定のユニオン型
 * 将来的に他のデータベースタイプを追加可能
 */
export type InfrastructureDatabaseConfig = D1DatabaseConfig;

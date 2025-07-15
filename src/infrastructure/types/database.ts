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

/**
 * D1データベースの行型定義
 */
export interface D1ResponseRow {
  id: string;
  schedule_id: string;
  user_id: string;
  user_name: string;
  user_display_name?: string;
  comment?: string;
  guild_id: string;
  created_at: string;
  updated_at: string;
}

export interface D1ResponseStatusRow {
  response_id: string;
  date_id: string;
  status: string;
}

export interface D1ScheduleRow {
  id: string;
  title: string;
  description?: string;
  created_by_id: string;
  created_by_username: string;
  author_id: string;
  guild_id: string;
  channel_id: string;
  message_id?: string;
  status: string;
  deadline?: number;
  reminder_timings?: string;
  reminder_mentions?: string;
  reminders_sent?: string;
  notification_sent: number;
  total_responses: number;
  created_at: number;
  updated_at: number;
  expires_at: number;
  date_id?: string;
  datetime?: string;
  display_order?: number;
}

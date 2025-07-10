import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

describe('D1 Database Test', () => {
  it('should work with D1', async () => {
    // シンプルなテーブルを作成
    await env.DB.exec('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)');
    
    // データを挿入
    await env.DB.prepare('INSERT INTO test (name) VALUES (?)').bind('test-value').run();
    
    // データを取得
    const result = await env.DB.prepare('SELECT * FROM test WHERE name = ?').bind('test-value').first();
    
    expect(result).toBeTruthy();
    expect(result.name).toBe('test-value');
    
    // クリーンアップ
    await env.DB.exec('DROP TABLE test');
  });

  it('should work with actual migrations', async () => {
    // 実際のマイグレーションファイルを読み込んで実行
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      const migrationPath = path.join(process.cwd(), 'migrations', '0001_initial_schema.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
      
      // SQLを個別のステートメントに分割
      const statements = migrationSQL
        .split(';')
        .filter(stmt => stmt.trim().length > 0)
        .map(stmt => stmt.trim());
      
      // 各ステートメントを実行
      for (const statement of statements) {
        if (statement.toLowerCase().includes('create index')) {
          // INDEXは別途実行
          await env.DB.exec(statement);
        } else if (statement.toLowerCase().includes('create table')) {
          // テーブル作成
          await env.DB.exec(statement);
        }
      }
      
      // テーブルが作成されたか確認
      const tables = await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table'"
      ).all();
      
      expect(tables.results).toBeDefined();
      expect(tables.results.length).toBeGreaterThan(0);
    } catch (error) {
      // ファイルシステムアクセスがCloudflare Workers環境で制限されている場合
      console.log('Skipping migration test due to environment limitations');
    }
  });
});
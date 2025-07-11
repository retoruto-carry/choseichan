import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Env } from '../../src/infrastructure/types/discord';

// D1Database互換のインターフェース
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
  dump(): Promise<ArrayBuffer>;
  withSession<T>(callback: (tx: D1Database) => Promise<T>): Promise<T>;
}

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  all<T = any>(): Promise<D1Result<T>>;
  first<T = any>(colName?: string): Promise<T>;
  run<T = any>(): Promise<D1Result<T>>;
  raw<T = any>(): Promise<T[]>;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta: D1Meta;
}

export interface D1Meta {
  duration: number;
  changes: number;
  last_row_id: number | null;
  rows_read: number;
  rows_written: number;
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

// better-sqlite3をD1互換のAPIでラップ
class D1DatabaseWrapper implements D1Database {
  private _isClosed = false;
  
  constructor(private db: Database.Database) {}
  
  get isClosed() {
    return this._isClosed;
  }
  
  close() {
    this._isClosed = true;
    this.db.close();
  }

  prepare(query: string): D1PreparedStatement {
    if (this._isClosed || !this.db.open) {
      throw new Error('Database connection is closed');
    }
    const stmt = this.db.prepare(query);
    const boundValues: any[] = [];
    const db = this.db; // スコープ問題を解決するためのローカル参照

    const preparedStatement: D1PreparedStatement = {
      bind(...values: any[]) {
        boundValues.push(...values);
        return preparedStatement;
      },

      async all<T = any>(): Promise<D1Result<T>> {
        try {
          const start = Date.now();
          const boundStmt = boundValues.length > 0 ? stmt.bind(...boundValues) : stmt;
          const results = boundStmt.all() as T[];
          const duration = (Date.now() - start) / 1000;
          
          return {
            results,
            success: true,
            meta: {
              duration,
              changes: (db as any).changes,
              last_row_id: (db as any).lastInsertRowid as number | null,
              rows_read: results.length,
              rows_written: 0
            }
          };
        } catch (error) {
          return {
            results: [],
            success: false,
            error: (error as Error).message,
            meta: {
              duration: 0,
              changes: 0,
              last_row_id: null,
              rows_read: 0,
              rows_written: 0
            }
          };
        }
      },

      async first<T = any>(colName?: string): Promise<T> {
        try {
          const start = Date.now();
          const boundStmt = boundValues.length > 0 ? stmt.bind(...boundValues) : stmt;
          const row = boundStmt.get() as T;
          const duration = (Date.now() - start) / 1000;
          
          if (row && colName) {
            return (row as any)[colName];
          }
          return row;
        } catch (error) {
          throw new Error(`D1 error: ${(error as Error).message}`);
        }
      },

      async run<T = any>(): Promise<D1Result<T>> {
        try {
          const start = Date.now();
          const boundStmt = boundValues.length > 0 ? stmt.bind(...boundValues) : stmt;
          const info = boundStmt.run();
          const duration = (Date.now() - start) / 1000;
          
          return {
            results: [] as T[],
            success: true,
            meta: {
              duration,
              changes: info.changes,
              last_row_id: info.lastInsertRowid as number | null,
              rows_read: 0,
              rows_written: info.changes
            }
          };
        } catch (error) {
          return {
            results: [] as T[],
            success: false,
            error: (error as Error).message,
            meta: {
              duration: 0,
              changes: 0,
              last_row_id: null,
              rows_read: 0,
              rows_written: 0
            }
          };
        }
      },

      async raw<T = any>(): Promise<T[]> {
        const result = await preparedStatement.all<T>();
        return result.results || [];
      }
    };

    return preparedStatement;
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = [];
    
    // Check if we're already in a transaction
    const inTransaction = this.db.inTransaction;
    
    // Only start a transaction if we're not already in one
    if (!inTransaction) {
      this.db.exec('BEGIN');
    }
    
    try {
      for (const stmt of statements) {
        // run()メソッドを使用してINSERT/UPDATE/DELETE文を実行
        const result = await stmt.run<T>();
        results.push(result);
      }
      
      // Only commit if we started the transaction
      if (!inTransaction) {
        this.db.exec('COMMIT');
      }
    } catch (error) {
      // Only rollback if we started the transaction
      if (!inTransaction) {
        this.db.exec('ROLLBACK');
      }
      throw error;
    }
    
    return results;
  }

  async exec(query: string): Promise<D1ExecResult> {
    try {
      const start = Date.now();
      this.db.exec(query);
      const duration = (Date.now() - start) / 1000;
      
      return {
        count: (this.db as any).changes,
        duration
      };
    } catch (error) {
      throw new Error(`D1 exec error: ${(error as Error).message}`);
    }
  }

  async dump(): Promise<ArrayBuffer> {
    const buffer = this.db.serialize();
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }
  
  async withSession<T>(callback: (tx: D1Database) => Promise<T>): Promise<T> {
    // In tests, we just pass through the same database instance
    return callback(this);
  }
}

// 各テストで異なるデータベースインスタンスを管理するためのマップ
const testDatabases = new Map<D1Database, Database.Database>();

export function createTestD1Database(): D1Database {
  // テスト用のインメモリデータベースを作成
  const db = new Database(':memory:');
  
  // 外部キー制約を有効化
  db.pragma('foreign_keys = ON');
  
  const wrapper = new D1DatabaseWrapper(db);
  testDatabases.set(wrapper, db);
  
  return wrapper;
}

export function closeTestDatabase(wrapper?: D1Database): void {
  if (wrapper && wrapper instanceof D1DatabaseWrapper) {
    wrapper.close();
    testDatabases.delete(wrapper);
  } else if (!wrapper) {
    // すべてのデータベースを閉じる
    for (const [w] of testDatabases) {
      if (w instanceof D1DatabaseWrapper) {
        w.close();
      }
    }
    testDatabases.clear();
  }
}

export async function applyMigrations(db: D1Database): Promise<void> {
  // マイグレーションファイルを読み込んで適用
  const migrationsPath = join(process.cwd(), 'migrations');
  const migrationFiles = [
    '0001_20240115_initial_schema.sql',
    '0003_20240117_foreign_key_optimization.sql'
  ];
  
  for (const file of migrationFiles) {
    const migrationPath = join(migrationsPath, file);
    try {
      const migrationSQL = readFileSync(migrationPath, 'utf-8');
      
      // SQLを個別のステートメントに分割（CREATE TRIGGERを考慮）
      const statements: string[] = [];
      let currentStatement = '';
      let inTrigger = false;
      
      const lines = migrationSQL.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // CREATE TRIGGER開始を検出
        if (trimmedLine.toUpperCase().startsWith('CREATE TRIGGER')) {
          inTrigger = true;
        }
        
        currentStatement += line + '\n';
        
        // END;でトリガー終了
        if (inTrigger && trimmedLine.toUpperCase() === 'END;') {
          statements.push(currentStatement.trim());
          currentStatement = '';
          inTrigger = false;
          continue;
        }
        
        // トリガー外でセミコロンで終わる行
        if (!inTrigger && trimmedLine.endsWith(';')) {
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
      }
      
      // 最後の文が残っている場合
      if (currentStatement.trim().length > 0) {
        statements.push(currentStatement.trim());
      }
      
      for (const statement of statements) {
        // 空白やコメントのみの文を除外
        const cleanStatement = statement.replace(/--.*$/gm, '').trim();
        if (cleanStatement.length > 0 && cleanStatement !== ';') {
          await db.exec(statement);
        }
      }
    } catch (error) {
      console.error(`Could not apply migration ${file}:`, error);
      throw error;
    }
  }
}

export function createTestEnv(db: D1Database): Env {
  // Create a properly typed Env object with DB as our test D1Database
  const env = {
    DISCORD_PUBLIC_KEY: 'test-public-key',
    DISCORD_APPLICATION_ID: 'test-app-id',
    DISCORD_TOKEN: 'test-token',
    DB: db,
  } as any as Env;
  
  return env;
}
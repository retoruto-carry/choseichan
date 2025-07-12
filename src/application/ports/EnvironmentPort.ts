/**
 * Environment Port Interface
 *
 * Application層での環境設定の抽象化
 * Infrastructure層のEnv型への依存を解消
 */

export interface IEnvironmentPort {
  get(key: string): string | undefined;
  getOptional(key: string): string | undefined;
  getRequired(key: string): string;
}

/**
 * バッチ処理設定
 */
export interface BatchConfig {
  batchSize: number;
  delayMs: number;
  maxRetries: number;
}

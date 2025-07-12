/**
 * Rate Limiter Port Interface
 *
 * Application層でのレート制限処理の抽象化
 * Infrastructure層のrate-limiter実装への依存を解消
 */

export interface IRateLimiterPort {
  /**
   * バッチ処理を実行
   */
  processBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options: {
      batchSize: number;
      delayMs: number;
      maxRetries?: number;
    }
  ): Promise<R[]>;
}

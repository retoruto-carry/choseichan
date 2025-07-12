/**
 * 適応的バッチ処理とエラーハンドリング機能付きAPIコール用レートリミッター
 */
export class RateLimiter {
  private queue: (() => Promise<unknown>)[] = [];
  private processing = false;
  private errorCount = 0;
  private successCount = 0;
  private lastError: Error | null = null;

  constructor(
    private maxConcurrent: number = 3,
    private delayBetweenBatches: number = 1000,
    private maxRetries: number = 3,
    private adaptiveBatching: boolean = true
  ) {}

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          this.successCount++;
          resolve(result);
        } catch (error) {
          this.errorCount++;
          this.lastError = error as Error;
          reject(error);
        }
      });

      if (!this.processing) {
        this.process();
      }
    });
  }

  private async process() {
    this.processing = true;

    while (this.queue.length > 0) {
      // エラー率に基づく適応的バッチサイズ調整
      const currentBatchSize = this.adaptiveBatching
        ? this.calculateAdaptiveBatchSize()
        : this.maxConcurrent;

      // キューから最大currentBatchSize件のアイテムを取得
      const batch = this.queue.splice(0, currentBatchSize);

      // エラーハンドリング付きでバッチを並列処理
      const results = await Promise.allSettled(batch.map((fn) => fn()));

      // 成功/エラー率に基づく適応的遅延計算
      const delay = this.calculateAdaptiveDelay(results);

      // 次のバッチ処理前の待機
      if (this.queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    this.processing = false;
  }

  private calculateAdaptiveBatchSize(): number {
    if (!this.adaptiveBatching) return this.maxConcurrent;

    const totalRequests = this.successCount + this.errorCount;
    if (totalRequests === 0) return this.maxConcurrent;

    const errorRate = this.errorCount / totalRequests;

    // エラー率が高い場合はバッチサイズを縮小
    if (errorRate > 0.5) return Math.max(1, Math.floor(this.maxConcurrent / 4));
    if (errorRate > 0.2) return Math.max(1, Math.floor(this.maxConcurrent / 2));

    return this.maxConcurrent;
  }

  private calculateAdaptiveDelay(results: PromiseSettledResult<unknown>[]): number {
    const errorCount = results.filter((r) => r.status === 'rejected').length;
    const errorRate = errorCount / results.length;

    // エラーが多い場合は遅延を増加（レート制限、サーバー問題）
    if (errorRate > 0.5) return this.delayBetweenBatches * 3;
    if (errorRate > 0.2) return this.delayBetweenBatches * 2;

    return this.delayBetweenBatches;
  }

  getStats() {
    return {
      successCount: this.successCount,
      errorCount: this.errorCount,
      lastError: this.lastError,
      queueLength: this.queue.length,
      processing: this.processing,
    };
  }

  reset() {
    this.errorCount = 0;
    this.successCount = 0;
    this.lastError = null;
  }
}

/**
 * 強化されたレート制限とエラーハンドリングでアイテムをバッチ処理
 */
export async function processBatches<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  options: {
    batchSize?: number;
    delayBetweenBatches?: number;
    maxRetries?: number;
    onProgress?: (processed: number, total: number, errors: number) => void;
    onError?: (item: T, error: Error, retryCount: number) => boolean; // リトライする場合はtrueを返す
  } = {}
): Promise<{ processed: number; errors: Error[]; retried: number }> {
  const {
    batchSize = 3,
    delayBetweenBatches = 1000,
    maxRetries = 2,
    onProgress,
    onError,
  } = options;

  let processed = 0;
  let retried = 0;
  const errors: Error[] = [];
  const retryQueue: { item: T; retryCount: number }[] = [];

  // 初期バッチの処理
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    // バッチを並列処理
    const _results = await Promise.allSettled(
      batch.map(async (item, _index) => {
        try {
          await processor(item);
          processed++;
        } catch (error) {
          const err = error as Error;
          errors.push(err);

          // このアイテムをリトライすべきかチェック
          const shouldRetry = onError ? onError(item, err, 0) : true;
          if (shouldRetry && maxRetries > 0) {
            retryQueue.push({ item, retryCount: 0 });
          }
        }
      })
    );

    onProgress?.(processed, items.length, errors.length);

    // 次のバッチ前の遅延（最後のバッチ以外）
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }

  // リトライキューの処理
  while (retryQueue.length > 0) {
    const retryBatch = retryQueue.splice(0, Math.min(batchSize, retryQueue.length));

    await Promise.allSettled(
      retryBatch.map(async ({ item, retryCount }) => {
        try {
          await processor(item);
          processed++;
          retried++;
        } catch (error) {
          const err = error as Error;
          errors.push(err);

          // 再びリトライすべきかチェック
          const shouldRetry = onError ? onError(item, err, retryCount + 1) : true;
          if (shouldRetry && retryCount < maxRetries) {
            retryQueue.push({ item, retryCount: retryCount + 1 });
          }
        }
      })
    );

    onProgress?.(processed, items.length, errors.length);

    // リトライの指数バックオフ
    if (retryQueue.length > 0) {
      const retryDelay = delayBetweenBatches * 2 ** (retryBatch[0]?.retryCount || 0);
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryDelay, 10000))); // 10秒でキャップ
    }
  }

  return { processed, errors, retried };
}

/**
 * RateLimiterインスタンスでアイテムを処理
 */
export async function processWithRateLimiter<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  rateLimiter?: RateLimiter
): Promise<{ results: R[]; errors: Error[] }> {
  const limiter = rateLimiter || new RateLimiter();
  const results: R[] = [];
  const errors: Error[] = [];

  const promises = items.map((item) =>
    limiter
      .add(() => processor(item))
      .then((result) => {
        results.push(result);
      })
      .catch((error) => {
        errors.push(error);
      })
  );

  await Promise.allSettled(promises);

  return { results, errors };
}

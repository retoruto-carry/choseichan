/**
 * Cloudflare Workers用バッチ処理クラス
 *
 * 注意: Workers環境ではsetTimeoutが使えないため、真のレート制限は実装されません
 * 実際のレート制限はCloudflare QueuesのDelay機能を使用してください
 * このクラスは主にバッチ処理とエラーハンドリングに特化
 */
export class WorkersBatchProcessor {
  private queue: (() => Promise<unknown>)[] = [];
  private processing = false;
  private errorCount = 0;
  private successCount = 0;
  private lastError: Error | null = null;

  constructor(
    private maxConcurrent: number = 3,
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
      const _results = await Promise.allSettled(batch.map((fn) => fn()));

      // Workers環境では遅延なしで次のバッチを処理
      // 実際のレート制限はQueuesのDelay機能で実装してください
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

  // Workers環境では遅延ができないため、削除

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
 * Workers環境用バッチ処理（遅延なし）
 */
export async function processBatches<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  options: {
    batchSize?: number;
    maxRetries?: number;
    onProgress?: (processed: number, total: number, errors: number) => void;
    onError?: (item: T, error: Error, retryCount: number) => boolean; // リトライする場合はtrueを返す
  } = {}
): Promise<{ processed: number; errors: Error[]; retried: number }> {
  const { batchSize = 3, maxRetries = 2, onProgress, onError } = options;

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
    // Cloudflare Workers環境では setTimeout が使えないため代替実装
    if (i + batchSize < items.length) {
      // Workers環境では遅延なしで継続（実際の遅延は Queues で制御）
      await Promise.resolve();
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
    // Cloudflare Workers環境では setTimeout が使えないため代替実装
    if (retryQueue.length > 0) {
      // Workers環境では遅延なしで継続（実際のバックオフは Queues で制御）
      await Promise.resolve();
    }
  }

  return { processed, errors, retried };
}

/**
 * BatchProcessorインスタンスでアイテムを処理
 */
export async function processWithBatchProcessor<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchProcessor?: WorkersBatchProcessor
): Promise<{ results: R[]; errors: Error[] }> {
  const limiter = batchProcessor || new WorkersBatchProcessor();
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

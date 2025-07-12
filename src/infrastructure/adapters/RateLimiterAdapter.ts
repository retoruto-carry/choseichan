/**
 * Rate Limiter Adapter
 *
 * Application層のIRateLimiterPortの実装
 * Infrastructure層のrate-limiterを適合
 */

import type { IRateLimiterPort } from '../../application/ports/RateLimiterPort';

export class RateLimiterAdapter implements IRateLimiterPort {
  async processBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options: {
      batchSize: number;
      delayMs: number;
      maxRetries?: number;
    }
  ): Promise<R[]> {
    const results: R[] = [];
    const chunks: T[][] = [];

    // Create batches
    for (let i = 0; i < items.length; i += options.batchSize) {
      chunks.push(items.slice(i, i + options.batchSize));
    }

    // Process batches sequentially with delay
    for (const chunk of chunks) {
      const batchResults = await processor(chunk);
      results.push(...batchResults);

      // Add delay between batches
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      }
    }

    return results;
  }
}

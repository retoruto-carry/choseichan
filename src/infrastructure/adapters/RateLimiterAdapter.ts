/**
 * Rate Limiter Adapter
 *
 * Application層のIRateLimiterPortの実装
 * Infrastructure層のrate-limiterを適合
 */

import type { IRateLimiterPort } from '../../application/ports/RateLimiterPort';
import { processBatches } from '../utils/rate-limiter';

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
    return await processBatches(
      items,
      processor,
      options.batchSize,
      options.delayMs,
      options.maxRetries
    );
  }
}

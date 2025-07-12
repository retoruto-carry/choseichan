import { describe, expect, it } from 'vitest';
import { processBatches, RateLimiter } from './rate-limiter';

describe('Rate Limiter', () => {
  describe('processBatches', () => {
    it('should process items in batches', async () => {
      const items = [1, 2, 3, 4, 5];
      const processed: number[] = [];
      const startTime = Date.now();

      await processBatches(
        items,
        async (item) => {
          processed.push(item);
        },
        {
          batchSize: 2,
          delayBetweenBatches: 100,
        }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All items should be processed
      expect(processed).toHaveLength(5);
      expect(processed.sort()).toEqual([1, 2, 3, 4, 5]);

      // Should have delays between batches (3 batches: 2, 2, 1)
      // Minimum duration should be 2 delays * 100ms = 200ms
      expect(duration).toBeGreaterThanOrEqual(200);
    });

    it('should handle errors without stopping other items', async () => {
      const items = [1, 2, 3, 4, 5];
      const processed: number[] = [];
      const errors: number[] = [];

      await processBatches(
        items,
        async (item) => {
          if (item === 3) {
            errors.push(item);
            throw new Error(`Error processing ${item}`);
          }
          processed.push(item);
        },
        {
          batchSize: 2,
          delayBetweenBatches: 10,
        }
      );

      // All items except 3 should be processed
      expect(processed).toHaveLength(4);
      expect(processed.sort()).toEqual([1, 2, 4, 5]);
      // Item 3 should fail 4 times (initial + 3 retries)
      expect(errors).toHaveLength(4);
      expect(errors.every((err) => err === 3)).toBe(true);
    });

    it('should process all items in one batch if batchSize is large', async () => {
      const items = [1, 2, 3];
      const processed: number[] = [];
      const startTime = Date.now();

      await processBatches(
        items,
        async (item) => {
          processed.push(item);
        },
        {
          batchSize: 10,
          delayBetweenBatches: 1000,
        }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All items should be processed
      expect(processed).toHaveLength(3);

      // No delays needed for single batch
      expect(duration).toBeLessThan(100);
    });
  });

  describe('RateLimiter', () => {
    it('should limit concurrent executions', async () => {
      const limiter = new RateLimiter(2, 50);
      const concurrent: number[] = [];
      let maxConcurrent = 0;

      const tasks = Array(5)
        .fill(0)
        .map((_, i) =>
          limiter.add(async () => {
            concurrent.push(i);
            maxConcurrent = Math.max(maxConcurrent, concurrent.length);

            await new Promise((resolve) => setTimeout(resolve, 10));

            concurrent.splice(concurrent.indexOf(i), 1);
            return i;
          })
        );

      const results = await Promise.all(tasks);

      expect(results.sort()).toEqual([0, 1, 2, 3, 4]);
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    }, 10000);

    it('should delay between batches', async () => {
      const limiter = new RateLimiter(1, 50);
      const times: number[] = [];

      const tasks = Array(3)
        .fill(0)
        .map(() =>
          limiter.add(async () => {
            times.push(Date.now());
          })
        );

      await Promise.all(tasks);

      // Check delays between executions (with small tolerance for timing variations)
      expect(times[1] - times[0]).toBeGreaterThanOrEqual(45);
      expect(times[2] - times[1]).toBeGreaterThanOrEqual(45);
    }, 10000);
  });
});

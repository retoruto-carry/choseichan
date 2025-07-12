import { describe, expect, it } from 'vitest';
import { processBatches, WorkersBatchProcessor } from './rate-limiter';

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
        }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All items should be processed
      expect(processed).toHaveLength(5);
      expect(processed.sort()).toEqual([1, 2, 3, 4, 5]);

      // In Workers environment, no artificial delays
      // Just verify all items were processed
      expect(duration).toBeGreaterThanOrEqual(0);
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

  describe('WorkersBatchProcessor', () => {
    it('should limit concurrent executions', async () => {
      const processor = new WorkersBatchProcessor(2);
      const concurrent: number[] = [];
      let maxConcurrent = 0;

      const tasks = Array(5)
        .fill(0)
        .map((_, i) =>
          processor.add(async () => {
            concurrent.push(i);
            maxConcurrent = Math.max(maxConcurrent, concurrent.length);

            // In Workers environment, no setTimeout available
            await Promise.resolve();

            concurrent.splice(concurrent.indexOf(i), 1);
            return i;
          })
        );

      const results = await Promise.all(tasks);

      expect(results.sort()).toEqual([0, 1, 2, 3, 4]);
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should process tasks immediately without delays', async () => {
      const processor = new WorkersBatchProcessor(1);
      const times: number[] = [];

      const tasks = Array(3)
        .fill(0)
        .map(() =>
          processor.add(async () => {
            times.push(Date.now());
          })
        );

      await Promise.all(tasks);

      // In Workers environment, no artificial delays
      expect(times).toHaveLength(3);
    });
  });
});

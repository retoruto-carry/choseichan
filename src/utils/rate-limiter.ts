/**
 * Simple rate limiter for API calls
 */
export class RateLimiter {
  private queue: (() => Promise<unknown>)[] = [];
  private processing = false;
  
  constructor(
    private maxConcurrent: number = 3,
    private delayBetweenBatches: number = 1000
  ) {}
  
  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
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
      // Take up to maxConcurrent items from the queue
      const batch = this.queue.splice(0, this.maxConcurrent);
      
      // Process batch in parallel
      await Promise.allSettled(batch.map(fn => fn()));
      
      // Wait before processing next batch
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
      }
    }
    
    this.processing = false;
  }
}

/**
 * Process items in batches with rate limiting
 */
export async function processBatches<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  options: {
    batchSize?: number;
    delayBetweenBatches?: number;
  } = {}
): Promise<void> {
  const { batchSize = 3, delayBetweenBatches = 1000 } = options;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // Process batch in parallel
    await Promise.allSettled(
      batch.map(item => processor(item))
    );
    
    // Delay before next batch (except for last batch)
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
}
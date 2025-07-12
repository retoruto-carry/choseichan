/**
 * Parallel Processing Utilities
 *
 * Utilities for optimizing async operations in Clean Architecture
 */

export interface ParallelProcessingOptions {
  maxConcurrency?: number;
  timeout?: number;
  failFast?: boolean;
}

/**
 * Execute functions in parallel with controlled concurrency
 */
export async function executeInParallel<T>(
  tasks: (() => Promise<T>)[],
  options: ParallelProcessingOptions = {}
): Promise<PromiseSettledResult<T>[]> {
  const { maxConcurrency = 5, timeout = 30000, failFast = false } = options;

  if (tasks.length === 0) return [];

  // If no concurrency limit or tasks fit within limit, run all in parallel
  if (maxConcurrency >= tasks.length) {
    const promises = tasks.map((task) => (timeout > 0 ? withTimeout(task(), timeout) : task()));

    if (failFast) {
      const results = await Promise.all(promises);
      return results.map((result) => ({ status: 'fulfilled' as const, value: result }));
    } else {
      return await Promise.allSettled(promises);
    }
  }

  // Process in batches with controlled concurrency
  const results: PromiseSettledResult<T>[] = [];

  for (let i = 0; i < tasks.length; i += maxConcurrency) {
    const batch = tasks.slice(i, i + maxConcurrency);
    const batchPromises = batch.map((task) =>
      timeout > 0 ? withTimeout(task(), timeout) : task()
    );

    if (failFast) {
      const batchResults = await Promise.all(batchPromises);
      results.push(
        ...batchResults.map((result) => ({
          status: 'fulfilled' as const,
          value: result,
        }))
      );
    } else {
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
    }
  }

  return results;
}

/**
 * Map over an array with parallel processing
 */
export async function parallelMap<T, R>(
  items: T[],
  mapper: (item: T, index: number) => Promise<R>,
  options: ParallelProcessingOptions = {}
): Promise<PromiseSettledResult<R>[]> {
  const tasks = items.map((item, index) => () => mapper(item, index));
  return executeInParallel(tasks, options);
}

/**
 * Filter items using async predicate with parallel processing
 */
export async function parallelFilter<T>(
  items: T[],
  predicate: (item: T, index: number) => Promise<boolean>,
  options: ParallelProcessingOptions = {}
): Promise<T[]> {
  const results = await parallelMap(items, predicate, options);

  return items.filter((_, index) => {
    const result = results[index];
    return result.status === 'fulfilled' && result.value === true;
  });
}

/**
 * Add timeout to a promise
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Batch processing with parallel execution within each batch
 */
export async function batchParallelProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    batchSize?: number;
    maxConcurrency?: number;
    delayBetweenBatches?: number;
    onBatchComplete?: (results: PromiseSettledResult<R>[], batchIndex: number) => void;
  } = {}
): Promise<{ results: R[]; errors: Error[] }> {
  const {
    batchSize = 10,
    maxConcurrency = 3,
    delayBetweenBatches = 100,
    onBatchComplete,
  } = options;

  const allResults: R[] = [];
  const allErrors: Error[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const batchResults = await parallelMap(batch, processor, { maxConcurrency });

    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        allResults.push(result.value);
      } else {
        allErrors.push(result.reason);
      }
    });

    onBatchComplete?.(batchResults, Math.floor(i / batchSize));

    // Delay between batches (except for the last batch)
    if (i + batchSize < items.length && delayBetweenBatches > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }

  return { results: allResults, errors: allErrors };
}

/**
 * Parallel reduce operation
 */
export async function parallelReduce<T, R>(
  items: T[],
  reducer: (accumulator: R, current: T, index: number) => Promise<R>,
  initialValue: R,
  options: ParallelProcessingOptions = {}
): Promise<R> {
  if (items.length === 0) return initialValue;

  // For reduce operations, we need to process sequentially to maintain order
  // But we can optimize by processing in chunks and then reducing the results
  const { maxConcurrency = 3 } = options;

  let accumulator = initialValue;

  for (let i = 0; i < items.length; i += maxConcurrency) {
    const chunk = items.slice(i, i + maxConcurrency);

    // Process chunk items sequentially to maintain reduce semantics
    for (let j = 0; j < chunk.length; j++) {
      accumulator = await reducer(accumulator, chunk[j], i + j);
    }
  }

  return accumulator;
}

/**
 * Pipeline processing - sequential stages with parallel processing within each stage
 */
export async function parallelPipeline<T>(
  items: T[],
  stages: Array<(item: T) => Promise<T>>,
  options: ParallelProcessingOptions = {}
): Promise<{ results: T[]; errors: Error[] }> {
  let currentItems = items;
  const allErrors: Error[] = [];

  for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
    const stage = stages[stageIndex];

    const stageResults = await parallelMap(currentItems, stage, options);

    const nextItems: T[] = [];
    stageResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        nextItems.push(result.value);
      } else {
        allErrors.push(result.reason);
      }
    });

    currentItems = nextItems;
  }

  return { results: currentItems, errors: allErrors };
}

/**
 * Utility to collect successful results and errors from PromiseSettledResult array
 */
export function collectResults<T>(results: PromiseSettledResult<T>[]): {
  success: T[];
  errors: Error[];
} {
  const success: T[] = [];
  const errors: Error[] = [];

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      success.push(result.value);
    } else {
      errors.push(result.reason);
    }
  });

  return { success, errors };
}

/**
 * Test environment type definitions
 */

import type { D1Database as TestD1Database } from '../helpers/d1-database';

declare global {
  /**
   * Extended Env type for tests that includes waitUntilPromises tracking
   */
  interface TestEnv extends Env {
    _waitUntilPromises?: Promise<any>[];
  }
}
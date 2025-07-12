/**
 * Test environment type definitions
 */

declare global {
  /**
   * Extended Env type for tests that includes waitUntilPromises tracking
   */
  interface TestEnv extends Env {
    _waitUntilPromises?: Promise<any>[];
  }
}

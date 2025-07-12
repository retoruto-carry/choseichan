/**
 * Environment Adapter
 *
 * Application層のIEnvironmentPortの実装
 * Infrastructure層のEnv型を適合
 */

import type { IEnvironmentPort } from '../../application/ports/EnvironmentPort';

export class EnvironmentAdapter implements IEnvironmentPort {
  constructor(private env: Env) {}

  get(key: string): string | undefined {
    return this.env[key] as string | undefined;
  }

  getOptional(key: string): string | undefined {
    return this.get(key);
  }

  getRequired(key: string): string {
    const value = this.get(key);
    if (!value) {
      throw new Error(`Required environment variable ${key} is missing`);
    }
    return value;
  }
}

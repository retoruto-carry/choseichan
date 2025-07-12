/**
 * Environment Adapter
 *
 * Application層のIEnvironmentPortの実装
 * Infrastructure層のEnv型を適合
 */

import type { IEnvironmentPort } from '../../application/ports/EnvironmentPort';
import type { Env } from '../types/discord';

export class EnvironmentAdapter implements IEnvironmentPort {
  constructor(private env: Env) {}

  get(key: string): string | undefined {
    const value = this.env[key];
    return typeof value === 'string' ? value : undefined;
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

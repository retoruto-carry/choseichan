/**
 * Cloudflare Workers用のバックグラウンド実行実装
 */

import type { BackgroundExecutorPort } from '../../application/ports/BackgroundExecutorPort';

export class WorkersBackgroundExecutor implements BackgroundExecutorPort {
  constructor(private ctx: ExecutionContext) {}

  execute(task: () => Promise<void>): void {
    // Cloudflare Workers: waitUntilでバックグラウンド実行
    this.ctx.waitUntil(task());
  }
}
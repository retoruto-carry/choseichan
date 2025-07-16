/**
 * テスト/開発環境用のバックグラウンド実行実装
 */

import type { BackgroundExecutorPort } from '../../application/ports/BackgroundExecutorPort';
import { getLogger } from '../logging/Logger';

export class TestBackgroundExecutorAdapter implements BackgroundExecutorPort {
  private readonly logger = getLogger();

  execute(task: () => Promise<void>): void {
    // テスト環境: 即座にタスクを実行（fire-and-forget）
    task().catch((error) => {
      this.logger.error(
        'Background task failed',
        error instanceof Error ? error : new Error(String(error))
      );
    });
  }
}

/**
 * テスト/開発環境用のバックグラウンド実行実装
 */

import type { BackgroundExecutorPort } from '../../application/ports/BackgroundExecutorPort';

export class TestBackgroundExecutorAdapter implements BackgroundExecutorPort {
  execute(task: () => Promise<void>): void {
    // テスト環境: 即座にタスクを実行（fire-and-forget）
    task().catch((error) => {
      console.error('Background task failed:', error);
    });
  }
}

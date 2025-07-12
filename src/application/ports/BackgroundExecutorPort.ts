/**
 * バックグラウンド実行のポート
 * 環境に応じた非同期タスク実行を抽象化
 */

export interface BackgroundExecutorPort {
  /**
   * タスクをバックグラウンドで実行
   * @param task 実行するタスク
   */
  execute(task: () => Promise<void>): void;
}
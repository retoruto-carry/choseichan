/**
 * メッセージ更新戦略
 * 
 * Cloudflare Workers環境での制限を考慮した実装戦略:
 * 1. レート制限: 短時間での過度な更新を防ぐ
 * 2. 最終更新の保証: 必ず最新の状態が反映される
 * 3. Discord APIレート制限の考慮: 1秒に5回まで
 */

export class MessageUpdateStrategy {
  private static instance: MessageUpdateStrategy;
  private lastExecutionTime = new Map<string, number>();
  private updateCounter = new Map<string, number>();
  private readonly minIntervalMs: number;
  private readonly maxUpdatesPerWindow: number;
  private readonly windowMs: number;

  private constructor(
    minIntervalMs = 1000, // 最小更新間隔: 1秒
    maxUpdatesPerWindow = 3, // 時間窓内の最大更新数
    windowMs = 10000 // 時間窓: 10秒
  ) {
    this.minIntervalMs = minIntervalMs;
    this.maxUpdatesPerWindow = maxUpdatesPerWindow;
    this.windowMs = windowMs;
  }

  static getInstance(): MessageUpdateStrategy {
    if (!MessageUpdateStrategy.instance) {
      MessageUpdateStrategy.instance = new MessageUpdateStrategy();
    }
    return MessageUpdateStrategy.instance;
  }

  /**
   * 更新を実行すべきか判断
   * 
   * @returns true: 実行すべき, false: スキップすべき
   */
  shouldUpdate(scheduleId: string, messageId: string): boolean {
    const key = `${scheduleId}:${messageId}`;
    const now = Date.now();
    const lastExecution = this.lastExecutionTime.get(key) || 0;

    // 最小間隔チェック
    if (now - lastExecution < this.minIntervalMs) {
      return false;
    }

    // レート制限チェック
    const counterKey = `${key}:${Math.floor(now / this.windowMs)}`;
    const count = this.updateCounter.get(counterKey) || 0;
    
    if (count >= this.maxUpdatesPerWindow) {
      return false;
    }

    return true;
  }

  /**
   * 更新実行を記録
   */
  recordUpdate(scheduleId: string, messageId: string): void {
    const key = `${scheduleId}:${messageId}`;
    const now = Date.now();
    
    // 実行時刻を記録
    this.lastExecutionTime.set(key, now);
    
    // カウンターを更新
    const counterKey = `${key}:${Math.floor(now / this.windowMs)}`;
    const count = this.updateCounter.get(counterKey) || 0;
    this.updateCounter.set(counterKey, count + 1);
    
    // 古いカウンターをクリーンアップ
    this.cleanupOldCounters();
  }

  /**
   * 強制更新（投票終了時など）
   */
  forceUpdate(scheduleId: string, messageId: string): void {
    const key = `${scheduleId}:${messageId}`;
    // 最後の実行時刻をリセットして即座に更新可能にする
    this.lastExecutionTime.delete(key);
  }

  /**
   * 統計情報取得
   */
  getStats(): {
    trackedMessages: number;
    recentUpdates: Array<{
      key: string;
      lastUpdateAge: number;
      updateCount: number;
    }>;
  } {
    const now = Date.now();
    const currentWindow = Math.floor(now / this.windowMs);
    
    const recentUpdates = Array.from(this.lastExecutionTime.entries()).map(([key, time]) => {
      const counterKey = `${key}:${currentWindow}`;
      const count = this.updateCounter.get(counterKey) || 0;
      
      return {
        key,
        lastUpdateAge: now - time,
        updateCount: count,
      };
    });

    return {
      trackedMessages: this.lastExecutionTime.size,
      recentUpdates,
    };
  }

  /**
   * 古いカウンターをクリーンアップ
   */
  private cleanupOldCounters(): void {
    const now = Date.now();
    const currentWindow = Math.floor(now / this.windowMs);
    const oldWindow = currentWindow - 2; // 2つ前の時間窓より古いものを削除

    for (const [key] of this.updateCounter) {
      const window = parseInt(key.split(':').pop() || '0');
      if (window < oldWindow) {
        this.updateCounter.delete(key);
      }
    }
  }

  /**
   * テスト用: 全状態をクリア
   */
  clear(): void {
    this.lastExecutionTime.clear();
    this.updateCounter.clear();
  }
}

/**
 * シングルトンインスタンスを取得
 */
export function getMessageUpdateStrategy(): MessageUpdateStrategy {
  return MessageUpdateStrategy.getInstance();
}
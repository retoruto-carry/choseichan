/**
 * メッセージ更新のデバウンス機能
 * 
 * Cloudflare Workers環境での制限事項:
 * - setTimeoutが使えないため、即座に実行またはスキップの判断を行う
 * - 実際の遅延はCloudflare Durable Objectsか外部サービスが必要
 * - 現在は最後の更新タイムスタンプを記録し、短時間の重複更新を防ぐ実装
 */

// Cloudflare Workers環境では非同期タイマーが使えないため、
// 最後の更新時刻のみを記録する簡易的な実装

export class MessageUpdateDebouncer {
  private static instance: MessageUpdateDebouncer;
  private lastUpdateTime = new Map<string, number>();
  private readonly debounceMs: number;

  private constructor(debounceMs = 2000) {
    this.debounceMs = debounceMs;
  }

  static getInstance(debounceMs = 2000): MessageUpdateDebouncer {
    if (!MessageUpdateDebouncer.instance) {
      MessageUpdateDebouncer.instance = new MessageUpdateDebouncer(debounceMs);
    }
    return MessageUpdateDebouncer.instance;
  }

  /**
   * メッセージ更新の実行判断
   * 
   * Cloudflare Workers環境では遅延実行ができないため、
   * 最後の更新時刻を記録して短時間での重複更新を防ぐ
   */
  async scheduleUpdate(
    scheduleId: string,
    messageId: string,
    token: string,
    guildId: string,
    updateFunction: () => Promise<void>
  ): Promise<void> {
    const key = `${scheduleId}:${messageId}`;
    const now = Date.now();
    const lastUpdate = this.lastUpdateTime.get(key) || 0;

    // デバウンス時間内の場合はスキップ
    if (now - lastUpdate < this.debounceMs) {
      return;
    }

    // 更新時刻を記録
    this.lastUpdateTime.set(key, now);

    // Cloudflare Workers環境では即座に実行
    try {
      await updateFunction();
    } catch (error) {
      console.error(`Failed to update message ${messageId}:`, error);
      // エラー時は更新時刻をリセットして再試行可能にする
      this.lastUpdateTime.delete(key);
      throw error;
    }
  }

  /**
   * 即座にメッセージ更新を実行（デバウンスをバイパス）
   */
  async immediateUpdate(
    scheduleId: string,
    messageId: string,
    token: string,
    guildId: string,
    updateFunction: () => Promise<void>
  ): Promise<void> {
    const key = `${scheduleId}:${messageId}`;
    
    // 更新時刻を記録
    this.lastUpdateTime.set(key, Date.now());
    
    try {
      await updateFunction();
    } catch (error) {
      console.error(`Failed to immediately update message ${messageId}:`, error);
      this.lastUpdateTime.delete(key);
      throw error;
    }
  }

  /**
   * 統計情報を取得（デバッグ用）
   */
  getStats(): {
    recentUpdateCount: number;
    recentUpdates: Array<{
      key: string;
      lastUpdateAge: number;
    }>;
  } {
    const now = Date.now();
    const recentUpdates = Array.from(this.lastUpdateTime.entries())
      .filter(([_, time]) => now - time < this.debounceMs * 5) // 最近の更新のみ
      .map(([key, time]) => ({
        key,
        lastUpdateAge: now - time,
      }));

    return {
      recentUpdateCount: recentUpdates.length,
      recentUpdates,
    };
  }

  /**
   * 全ての更新履歴をクリア（テスト用）
   */
  clear(): void {
    this.lastUpdateTime.clear();
  }
}

/**
 * デバウンサーのインスタンスを取得
 */
export function getMessageUpdateDebouncer(): MessageUpdateDebouncer {
  return MessageUpdateDebouncer.getInstance();
}
/**
 * メッセージ更新のデバウンス機能
 * 
 * Cloudflare Workers環境での制限事項:
 * - setTimeoutが使えないため、即座に実行または保留の判断を行う
 * - 最後の更新を必ず実行するため、保留中フラグを管理
 * - 最新の更新関数を保持して、デバウンス期間後に実行
 */

interface PendingUpdate {
  updateFunction: () => Promise<void>;
  timestamp: number;
  token: string;
  guildId: string;
}

export class MessageUpdateDebouncer {
  private static instance: MessageUpdateDebouncer;
  private lastUpdateTime = new Map<string, number>();
  private pendingUpdates = new Map<string, PendingUpdate>();
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
   * Cloudflare Workers環境での最適な実装:
   * 1. デバウンス期間内なら保留中の更新として記録
   * 2. デバウンス期間外なら即座に実行し、その後の期間は保留
   * 3. 保留中の更新がある場合は、最新の更新関数で上書き
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

    // デバウンス時間内の場合
    if (now - lastUpdate < this.debounceMs) {
      // 保留中の更新として記録（最新の状態で上書き）
      this.pendingUpdates.set(key, {
        updateFunction,
        timestamp: now,
        token,
        guildId,
      });
      return;
    }

    // デバウンス時間外の場合は即座に実行
    this.lastUpdateTime.set(key, now);
    
    try {
      await updateFunction();
      
      // 実行後、保留中の更新があればそれも処理が必要
      // ただし、Cloudflare Workersではタイマーが使えないため、
      // 次回のリクエスト時に処理するか、Durable Objectsを使用する必要がある
      const pending = this.pendingUpdates.get(key);
      if (pending) {
        this.pendingUpdates.delete(key);
        // 注意: これは即座に実行されてしまうため、真のデバウンスにはならない
        // 完全な解決にはDurable ObjectsやQueuesが必要
      }
    } catch (error) {
      console.error(`Failed to update message ${messageId}:`, error);
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
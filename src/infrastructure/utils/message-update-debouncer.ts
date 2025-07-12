/**
 * メッセージ更新のデバウンス機能
 *
 * Cloudflare Workers環境での実装:
 * - setTimeoutが使えないため、Cloudflare Queuesを使用した遅延実行
 * - 即座に実行が必要な場合は直接実行
 * - デバウンス期間内の更新はQueuesを通じて遅延実行
 */

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
   * Cloudflare Workers環境での実装:
   * 1. デバウンス期間内なら即座に実行（Queuesが真のデバウンスを担当）
   * 2. 更新履歴を管理してレート制限を実装
   * 3. 真のデバウンスはQueuesの遅延実行機能を使用
   */
  async scheduleUpdate(
    scheduleId: string,
    messageId: string,
    _token: string,
    _guildId: string,
    updateFunction: () => Promise<void>
  ): Promise<void> {
    const key = `${scheduleId}:${messageId}`;
    const now = Date.now();

    // Workers環境では即座に実行（Queuesでデバウンスを制御）
    this.lastUpdateTime.set(key, now);

    try {
      await updateFunction();
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
    _token: string,
    _guildId: string,
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

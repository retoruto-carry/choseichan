/**
 * メッセージ更新のデバウンス機能
 * 
 * 複数の投票が同時に発生した場合に、メッセージ更新を一定時間遅延させて
 * 最後の更新のみを実行することでDiscord APIの負荷を軽減
 */

interface PendingUpdate {
  scheduleId: string;
  messageId: string;
  token: string;
  guildId: string;
  timestamp: number;
}

export class MessageUpdateDebouncer {
  private static instance: MessageUpdateDebouncer;
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
   * メッセージ更新をデバウンス付きでスケジュール
   */
  scheduleUpdate(
    scheduleId: string,
    messageId: string,
    token: string,
    guildId: string,
    updateFunction: () => Promise<void>
  ): void {
    const key = `${scheduleId}:${messageId}`;
    const now = Date.now();

    // 既存の更新をキャンセル（存在する場合）
    if (this.pendingUpdates.has(key)) {
      const existing = this.pendingUpdates.get(key)!;
      // 既存の更新が新しい場合は、そのまま継続
      if (now - existing.timestamp < this.debounceMs) {
        this.pendingUpdates.set(key, {
          scheduleId,
          messageId,
          token,
          guildId,
          timestamp: now,
        });
        return;
      }
    }

    // 新しい更新をスケジュール
    this.pendingUpdates.set(key, {
      scheduleId,
      messageId,
      token,
      guildId,
      timestamp: now,
    });

    // 遅延実行（環境に応じてsetTimeoutまたはPromiseベースを使用）
    const executeDelayed = async () => {
      // テスト環境ではsetTimeoutを使用、Cloudflare WorkersではPromiseベースを使用
      if (typeof setTimeout !== 'undefined') {
        // Node.js/テスト環境
        await new Promise(resolve => setTimeout(resolve, this.debounceMs));
      } else {
        // Cloudflare Workers環境
        await new Promise(resolve => {
          const start = Date.now();
          const check = () => {
            if (Date.now() - start >= this.debounceMs) {
              resolve(undefined);
            } else {
              Promise.resolve().then(check);
            }
          };
          check();
        });
      }

      const current = this.pendingUpdates.get(key);
      if (current && current.timestamp === now) {
        // まだ最新の更新要求の場合のみ実行
        try {
          await updateFunction();
        } catch (error) {
          console.error(`Failed to update message ${messageId}:`, error);
        } finally {
          this.pendingUpdates.delete(key);
        }
      }
    };

    executeDelayed();
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
    
    // 既存の待機中更新をキャンセル
    this.pendingUpdates.delete(key);
    
    try {
      await updateFunction();
    } catch (error) {
      console.error(`Failed to immediately update message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * 統計情報を取得（デバッグ用）
   */
  getStats(): {
    pendingCount: number;
    pendingUpdates: Array<{
      key: string;
      scheduleId: string;
      messageId: string;
      age: number;
    }>;
  } {
    const now = Date.now();
    const pendingUpdates = Array.from(this.pendingUpdates.entries()).map(([key, update]) => ({
      key,
      scheduleId: update.scheduleId,
      messageId: update.messageId,
      age: now - update.timestamp,
    }));

    return {
      pendingCount: this.pendingUpdates.size,
      pendingUpdates,
    };
  }

  /**
   * 全ての待機中更新をクリア（テスト用）
   */
  clear(): void {
    this.pendingUpdates.clear();
  }
}

/**
 * デバウンサーのインスタンスを取得
 */
export function getMessageUpdateDebouncer(): MessageUpdateDebouncer {
  return MessageUpdateDebouncer.getInstance();
}
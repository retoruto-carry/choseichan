/**
 * Rate Limit Service
 *
 * ユーザーとギルドごとのレート制限を実装
 * Discord Botの過度な使用を防止
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // ウィンドウ時間（ミリ秒）
  identifier: string; // ユーザーID、ギルドIDなど
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimitService {
  private static readonly stores = new Map<string, Map<string, RateLimitEntry>>();

  /**
   * レート制限チェック
   */
  static check(config: RateLimitConfig): RateLimitResult {
    const { maxRequests, windowMs, identifier } = config;
    const now = Date.now();
    const resetTime = Math.floor(now / windowMs) * windowMs + windowMs;

    // ストアの取得または作成
    const storeKey = `${maxRequests}:${windowMs}`;
    if (!RateLimitService.stores.has(storeKey)) {
      RateLimitService.stores.set(storeKey, new Map());
    }
    const store = RateLimitService.stores.get(storeKey);
    if (!store) {
      throw new Error(`Rate limit store not found for ${storeKey}`);
    }

    // 既存エントリの取得
    let entry = store.get(identifier);

    // エントリが存在しないか、リセット時間を過ぎている場合は新規作成
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime,
      };
      store.set(identifier, entry);
    }

    // リクエストカウントを増加
    entry.count++;

    // 制限チェック
    const allowed = entry.count <= maxRequests;
    const remaining = Math.max(0, maxRequests - entry.count);
    const retryAfter = allowed ? undefined : Math.ceil((resetTime - now) / 1000);

    return {
      allowed,
      remaining,
      resetTime,
      retryAfter,
    };
  }

  /**
   * ユーザーごとのレート制限チェック
   * デフォルト: 10リクエスト/分
   */
  static checkUser(userId: string, maxRequests = 10, windowMs = 60 * 1000): RateLimitResult {
    return RateLimitService.check({
      maxRequests,
      windowMs,
      identifier: `user:${userId}`,
    });
  }

  /**
   * ギルドごとのレート制限チェック
   * デフォルト: 50リクエスト/分
   */
  static checkGuild(guildId: string, maxRequests = 50, windowMs = 60 * 1000): RateLimitResult {
    return RateLimitService.check({
      maxRequests,
      windowMs,
      identifier: `guild:${guildId}`,
    });
  }

  /**
   * スケジュール作成のレート制限チェック
   * より厳しい制限: 5作成/時間
   */
  static checkScheduleCreation(
    userId: string,
    maxRequests = 5,
    windowMs = 60 * 60 * 1000
  ): RateLimitResult {
    return RateLimitService.check({
      maxRequests,
      windowMs,
      identifier: `schedule_create:${userId}`,
    });
  }

  /**
   * レスポンス送信のレート制限チェック
   * 中程度の制限: 30送信/分
   */
  static checkResponseSubmission(
    userId: string,
    maxRequests = 30,
    windowMs = 60 * 1000
  ): RateLimitResult {
    return RateLimitService.check({
      maxRequests,
      windowMs,
      identifier: `response_submit:${userId}`,
    });
  }

  /**
   * 期限切れエントリのクリーンアップ
   * 定期的に呼び出してメモリ使用量を制御
   */
  static cleanup(): void {
    const now = Date.now();

    for (const [storeKey, store] of RateLimitService.stores.entries()) {
      for (const [identifier, entry] of store.entries()) {
        if (now >= entry.resetTime) {
          store.delete(identifier);
        }
      }

      // 空になったストアを削除
      if (store.size === 0) {
        RateLimitService.stores.delete(storeKey);
      }
    }
  }

  /**
   * 特定のIdentifierのレート制限をリセット
   * 管理者操作やテスト用
   */
  static reset(identifier: string): void {
    for (const store of RateLimitService.stores.values()) {
      for (const key of store.keys()) {
        if (key.includes(identifier)) {
          store.delete(key);
        }
      }
    }
  }

  /**
   * 全てのレート制限をクリア
   * テスト用
   */
  static clear(): void {
    RateLimitService.stores.clear();
  }

  /**
   * レート制限情報の取得（デバッグ用）
   */
  static getStats(): Record<string, unknown> {
    const stats: Record<string, unknown> = {};

    for (const [storeKey, store] of RateLimitService.stores.entries()) {
      stats[storeKey] = {
        entryCount: store.size,
        entries: Array.from(store.entries()).map(([id, entry]) => ({
          identifier: id,
          count: entry.count,
          resetTime: new Date(entry.resetTime).toISOString(),
        })),
      };
    }

    return stats;
  }
}

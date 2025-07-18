/**
 * Domain層のID生成ユーティリティ
 *
 * ビジネスロジックで使用するID生成機能
 * Cloudflare Workers環境でも動作する暗号学的に安全なID生成
 */

/**
 * セキュアなID生成関数
 * @returns ユニークなID文字列
 */
export function generateId(): string {
  // Cloudflare Workers環境では crypto.randomUUID() が利用可能
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // フォールバック: タイムスタンプ + セキュアなランダム値
  const timestamp = Date.now().toString(36);
  const randomBytes = new Uint8Array(16);

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(randomBytes);
  } else {
    // 最後の手段としてMath.randomを使用（テスト環境用）
    // 本番環境では上記のcryptoが必ず利用可能
    for (let i = 0; i < randomBytes.length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const randomStr = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${timestamp}-${randomStr}`;
}

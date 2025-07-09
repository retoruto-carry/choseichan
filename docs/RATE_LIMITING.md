# レート制限ガイド

Discord 調整ちゃんでは、Discord APIのレート制限を考慮して、大量の通知を送信する際のレート制限機能を実装しています。

## 概要

GitHub Actionsで毎時実行される締切リマインダー機能では、複数のスケジュールに対して同時に通知を送信する必要があります。Discord APIにはレート制限があるため、適切に制御する必要があります。

## 実装

### RateLimiter ユーティリティ

`src/utils/rate-limiter.ts` に実装されたユーティリティで、以下の機能を提供します：

1. **バッチ処理**: 指定された数の処理を並列実行
2. **遅延制御**: バッチ間に遅延を挿入
3. **エラーハンドリング**: Promise.allSettled を使用してエラーが発生しても他の処理を継続

### 使用例

```typescript
import { processBatches } from '../utils/rate-limiter';

// 3つずつ並列処理、バッチ間に1秒の遅延
await processBatches(items, async (item) => {
  await sendNotification(item);
}, {
  batchSize: 3,
  delayBetweenBatches: 1000
});
```

## 設定

### デフォルト値

- **リマインダー通知**:
  - バッチサイズ: 20
  - バッチ間遅延: 100ms (0.1秒)

- **締切通知**:
  - バッチサイズ: 15（各通知で2つのメッセージを送信するため、計30メッセージ）
  - バッチ間遅延: 100ms (0.1秒)

### 環境変数での調整

以下の環境変数で動作を調整できます：

- `REMINDER_BATCH_SIZE`: 一度に処理するリマインダーの数
- `REMINDER_BATCH_DELAY`: バッチ間の遅延時間（ミリ秒）

### Cloudflare Workers での設定

```bash
wrangler secret put REMINDER_BATCH_SIZE
# 値を入力: 5

wrangler secret put REMINDER_BATCH_DELAY
# 値を入力: 2000
```

## Discord API レート制限

Discord APIの主なレート制限：

- **グローバルレート制限**: 50リクエスト/秒
- **チャンネルごと**: 5メッセージ/5秒
- **DM作成**: 5 DM/5秒
- **Webhook**: 5リクエスト/2秒（グローバル制限の対象外）

## パフォーマンス

### 現在のデフォルト設定でのスループット

**リマインダー通知**:
- 最大 12,000通知/分（20並列 × 600バッチ/分）
- DM制限により実際は最大 60 DM/分
- グローバル制限により実際は最大 3,000リクエスト/分

**締切通知**:
- 最大 9,000通知/分（15並列 × 600バッチ/分）
- 18,000 Discord APIコール/分（理論値）
- グローバル制限により実際は最大 3,000リクエスト/分
- 各チャンネルは最大 60メッセージ/分に制限

### 実際の処理能力

Discord APIの制限を考慮すると：
- **安全な処理速度**: 30-40リクエスト/秒（グローバル50/秒の80%）
- **DM送信**: 最大60/分（5 DM/5秒の制限）
- **チャンネルメッセージ**: チャンネルごと60/分（5メッセージ/5秒の制限）

### 推奨設定

**小規模（〜1,000スケジュール）**:
- デフォルト設定で十分（`BATCH_SIZE=20`, `DELAY=100`）

**中規模（1,000〜10,000スケジュール）**:
- `REMINDER_BATCH_SIZE=30`
- `REMINDER_BATCH_DELAY=50`

**大規模（10,000スケジュール以上）**:
- `REMINDER_BATCH_SIZE=40`
- `REMINDER_BATCH_DELAY=50`
- 注意: 15秒のWorker実行時間制限に注意
- 複数のWorker実行に分割することを検討

## ベストプラクティス

1. **積極的なバッチサイズ**: 20-40に設定（グローバル制限50/秒の80%を目安）
2. **最小限の遅延**: 50-100ms（バースト制御のため）
3. **429エラー処理**: Retry-Afterヘッダーに従って自動再試行
4. **レート制限ヘッダー監視**: X-RateLimit-Remainingが10以下になったら遅延を増やす
5. **チャンネル分散**: 同一チャンネルは60メッセージ/分の制限を考慮

## トラブルシューティング

### レート制限エラーが発生する場合

1. バッチサイズを小さくする
2. バッチ間の遅延を長くする
3. Discord APIのレスポンスヘッダーで制限状況を確認

### 処理が遅い場合

1. バッチサイズを大きくする（ただし5以下を推奨）
2. 不要な通知を送信しないようにロジックを見直す

## 監視

Cloudflare Workers のログで以下を確認できます：

```
Processing 10 upcoming reminders and 5 closure notifications
Sent deadline reminder for schedule schedule-123
Failed to send reminder for schedule schedule-456: Error: Rate limited
```
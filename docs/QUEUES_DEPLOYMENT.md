# Cloudflare Queues デプロイメントガイド

このドキュメントでは、Discord 調整ちゃんで使用されるCloudflare Queuesのセットアップと運用について説明します。

## 概要

Cloudflare Queuesは、以下の2つの機能で使用されています：

1. **メッセージ更新Queue**: 投票時のメッセージ更新を最適化
2. **締切リマインダーQueue**: Discord APIレート制限を考慮した締切処理の非同期化

## アーキテクチャ

### Clean Architecture に準拠した実装

```
Domain Layer (ドメイン層)
├── MessageUpdateService - メッセージ更新のビジネスルール定義
└── MessageUpdateType - 更新タイプの定義（VOTE_UPDATE, CLOSE_UPDATE, SUMMARY_UPDATE）

Application Layer (アプリケーション層)
├── MessageUpdateServiceImpl - ビジネスルールの実装
└── ProcessMessageUpdateUseCase - メッセージ更新処理のユースケース

Infrastructure Layer (インフラストラクチャ層)
├── CloudflareQueueAdapter - Cloudflare Queuesアダプター
├── MessageUpdateQueuePort - キューのポート定義
└── DiscordApiService - Discord API通信の実装
```

## セットアップ手順

### 1. Cloudflare Queuesの作成

```bash
# メッセージ更新用のQueueを作成
wrangler queues create message-update-queue
wrangler queues create message-update-dlq

# 締切リマインダー用のQueueを作成
wrangler queues create deadline-reminder-queue
wrangler queues create deadline-reminder-dlq
```

### 2. wrangler.toml の設定

```toml
# メッセージ更新Queue
[[queues.producers]]
queue = "message-update-queue"
binding = "MESSAGE_UPDATE_QUEUE"

[[queues.consumers]]
queue = "message-update-queue"
max_batch_size = 10          # 一度に処理する最大メッセージ数
max_batch_timeout = 5        # バッチタイムアウト（秒）
max_retries = 3              # 最大リトライ回数
dead_letter_queue = "message-update-dlq"  # エラー時の送信先

# 締切リマインダーQueue
[[queues.producers]]
queue = "deadline-reminder-queue"
binding = "DEADLINE_REMINDER_QUEUE"

[[queues.consumers]]
queue = "deadline-reminder-queue"
max_batch_size = 20          # Discord APIレート制限を考慮
max_batch_timeout = 10       # バッチタイムアウト（秒）
max_retries = 3              # 最大リトライ回数
dead_letter_queue = "deadline-reminder-dlq"
```

### 3. 環境変数の確認

Queues機能を使用するには、以下の環境変数が必要です：

```bash
# Discord認証情報（必須）
wrangler secret put DISCORD_TOKEN
wrangler secret put DISCORD_APPLICATION_ID
```

## 動作の仕組み

### メッセージ更新Queue

#### 1. スケジューリング

投票や締切時にメッセージ更新がスケジュールされます：

```typescript
// VoteControllerから
await scheduleMessageUpdate(
  env,
  scheduleId,
  messageId,
  channelId,
  guildId,
  'vote_update'  // または 'close_update', 'summary_update'
);
```

#### 2. 遅延実行

- **投票更新（VOTE_UPDATE）**: 2秒の遅延でデバウンス効果
- **締切更新（CLOSE_UPDATE）**: 即座に実行
- **サマリー更新（SUMMARY_UPDATE）**: 2秒の遅延

#### 3. バッチ処理

- 同じメッセージへの複数の更新は最新のものだけを実行
- 最大10個のメッセージを同時処理
- Discord APIのレート制限を考慮した効率的な更新

### 締切リマインダーQueue

#### 1. タスクタイプ

締切リマインダーQueueは3種類のタスクを処理：

```typescript
interface DeadlineReminderTask {
  type: 'send_reminder' | 'close_schedule' | 'send_summary';
  scheduleId: string;
  guildId: string;
  customMessage?: string;
}
```

#### 2. 処理フロー

1. **Cronジョブ** → ProcessDeadlineRemindersUseCase実行
2. 締切チェック → リマインダー対象の抽出
3. Queueへタスク送信（バッチ処理）
4. 各タスクの非同期処理（Discord API呼び出し）

#### 3. レート制限対策

- 最大20件/バッチでDiscord APIレート制限を回避
- Search Guild Members API（10リクエスト/10秒）を考慮
- 自然なペースでメッセージを送信

### 4. エラーハンドリング

- 自動リトライ: 最大3回まで自動的にリトライ
- デッドレターキュー: 失敗したメッセージはDLQに送信

## 運用とモニタリング

### ログの確認

```bash
# リアルタイムログの確認
wrangler tail

# Queuesの状態確認（Cloudflareダッシュボード）
# Workers & Pages > Queues > message-update-queue
```

### メトリクス

Cloudflareダッシュボードで以下のメトリクスを確認できます：

- **Message Rate**: 秒あたりのメッセージ数
- **Backlog Size**: 処理待ちメッセージ数
- **Consumer Success Rate**: 成功率
- **Dead Letter Queue Size**: エラーメッセージ数

### トラブルシューティング

#### 1. メッセージが処理されない

```bash
# Queuesのバインディングを確認
wrangler whoami
wrangler queues list

# ログでエラーを確認
wrangler tail --format pretty
```

#### 2. DLQにメッセージが溜まる

```bash
# DLQの内容を確認（Cloudflareダッシュボード経由）
# 必要に応じて手動でリトライまたは削除
```

#### 3. レート制限エラー

Discord APIのレート制限に達した場合：
- `max_batch_size` を減らす
- `max_batch_timeout` を増やす

## ベストプラクティス

### 1. 適切なバッチサイズ

```toml
max_batch_size = 10  # Discord APIのレート制限を考慮
```

### 2. タイムアウト設定

```toml
max_batch_timeout = 5  # 5秒でバッチを強制実行
```

### 3. エラー監視

- DLQのサイズを定期的に確認
- エラーログをモニタリング
- 必要に応じてアラートを設定

### 4. コスト最適化

- 不要な更新を避ける（デバウンス効果の活用）
- バッチ処理で効率化
- DLQの定期的なクリーンアップ

## 開発環境での注意事項

### ローカル開発

```bash
# ローカルでQueuesを使用しない場合
wrangler dev --local

# Queuesを含めてテストする場合
wrangler dev  # リモートQueuesを使用
```

### テスト

Queues機能のテストでは、モックを使用：

```typescript
// テストでのモック例
vi.mock('../../infrastructure/utils/message-update-queue', () => ({
  scheduleMessageUpdate: vi.fn().mockResolvedValue(undefined),
}));
```

## よくある質問

### Q: Queuesを使用しない場合の動作は？

A: 各Queueが設定されていない場合の動作：
- `MESSAGE_UPDATE_QUEUE`: メッセージ更新がスキップされます（ログに警告）
- `DEADLINE_REMINDER_QUEUE`: 直接処理にフォールバック（テスト環境用）

### Q: 更新の遅延時間を変更したい

A: `MessageUpdateServiceImpl` の `scheduleUpdate` メソッドで遅延時間を調整できます。

### Q: バッチサイズの最適値は？

A: Discord APIのレート制限とレスポンス時間のバランスを考慮して、10程度が推奨です。

## 関連ドキュメント

- [Cloudflare Queues 公式ドキュメント](https://developers.cloudflare.com/queues/)
- [Discord API レート制限](https://discord.com/developers/docs/topics/rate-limits)
- [ARCHITECTURE.md](../ARCHITECTURE.md) - システムアーキテクチャの詳細
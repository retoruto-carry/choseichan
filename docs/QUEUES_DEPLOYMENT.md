# Cloudflare Queues デプロイメントガイド

このドキュメントでは、Discord 調整ちゃんのメッセージ更新機能で使用されるCloudflare Queuesのセットアップと運用について説明します。

## 概要

Cloudflare Queuesは、メッセージ更新の最適化とDiscord APIのレート制限対策のために使用されています。投票が頻繁に行われる際の更新をバッチ処理し、効率的にメッセージを更新します。

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

# デッドレターキュー（DLQ）を作成（エラー処理用）
wrangler queues create message-update-dlq
```

### 2. wrangler.toml の設定

```toml
# Queues configuration for message update batching
[[queues.producers]]
queue = "message-update-queue"
binding = "MESSAGE_UPDATE_QUEUE"

[[queues.consumers]]
queue = "message-update-queue"
max_batch_size = 10          # 一度に処理する最大メッセージ数
max_batch_timeout = 5        # バッチタイムアウト（秒）
max_retries = 3              # 最大リトライ回数
dead_letter_queue = "message-update-dlq"  # エラー時の送信先
```

### 3. 環境変数の確認

Queues機能を使用するには、以下の環境変数が必要です：

```bash
# Discord認証情報（必須）
wrangler secret put DISCORD_TOKEN
wrangler secret put DISCORD_APPLICATION_ID
```

## 動作の仕組み

### 1. メッセージ更新のスケジューリング

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

### 2. 遅延実行

- **投票更新（VOTE_UPDATE）**: 2秒の遅延でデバウンス効果
- **締切更新（CLOSE_UPDATE）**: 即座に実行
- **サマリー更新（SUMMARY_UPDATE）**: 2秒の遅延

### 3. バッチ処理

複数の更新が同時にキューに入った場合、バッチで処理されます：

- 同じメッセージへの複数の更新は最新のものだけを実行
- 最大10個のメッセージを同時処理
- Discord APIのレート制限を考慮した効率的な更新

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

A: `MESSAGE_UPDATE_QUEUE` が設定されていない場合、メッセージ更新はスキップされます（ログに警告が出力されます）。

### Q: 更新の遅延時間を変更したい

A: `MessageUpdateServiceImpl` の `scheduleUpdate` メソッドで遅延時間を調整できます。

### Q: バッチサイズの最適値は？

A: Discord APIのレート制限とレスポンス時間のバランスを考慮して、10程度が推奨です。

## 関連ドキュメント

- [Cloudflare Queues 公式ドキュメント](https://developers.cloudflare.com/queues/)
- [Discord API レート制限](https://discord.com/developers/docs/topics/rate-limits)
- [ARCHITECTURE.md](../ARCHITECTURE.md) - システムアーキテクチャの詳細
# Discord 調整ちゃん - 開発ガイド

このドキュメントは、AI アシスタント（Claude）が効率的にこのプロジェクトを理解し、開発を支援するためのガイドです。

## プロジェクト概要

Discord 調整ちゃんは、Discord サーバー内で日程調整を行うためのボットです。外部サービスを使わずに Discord 内で完結する点が特徴です。

## 技術スタック

- **ランタイム**: Cloudflare Workers
- **データベース**: Cloudflare D1 (SQLite) - KVから移行済み
- **言語**: TypeScript
- **テスト**: Vitest
- **デプロイ**: Wrangler

## 重要なコマンド

```bash
# 開発サーバー起動
npm run dev

# テスト実行
npm test

# 型チェック
npm run typecheck

# リント
npm run lint

# デプロイ
npm run deploy

# D1マイグレーション
wrangler d1 execute discord-choseisan-db --file=./migrations/0001_initial_schema.sql
```

## アーキテクチャの特徴

### Clean Architecture（Onion Architecture）
**完全移行済み - Jeffrey Palermoのアーキテクチャパターン**
- `src/domain/` - 純粋ビジネスロジック（エンティティ・ドメインサービス）
- `src/application/` - ユースケース実装（11個完備）
- `src/infrastructure/` - 外部技術（D1リポジトリ・API）
- `src/presentation/` - UI構築とコントローラー

### データアクセス
- **リポジトリパターン**: Clean Architecture に準拠
- D1データベースへの直接アクセスを抽象化
- ドメイン層のインターフェースとインフラ層の実装を分離

## データモデル

### D1 テーブル構造
- `schedules` - 日程調整マスタ
- `schedule_dates` - 日程候補（正規化）
- `responses` - 回答マスタ
- `response_date_status` - 各日程への回答状態

### 重要な機能
- 6ヶ月後の自動削除（TTL）
- リアルタイム投票更新
- カスタムリマインダー
- 締切後の編集可能

## 開発時の注意点

### Cloudflare Workers の制限
- 実行時間: 最大3秒
- `setTimeout` は使えない（`waitUntil` を使用）
- メモリ: 128MB

### Discord API の制限
- Webhook: 30リクエスト/分
- コンポーネント: 最大5行、各行最大5要素
- Embed: 最大10個、各6000文字

### テスト
- `vitest.config.ts` で順次実行設定（テスト分離のため）
- リポジトリパターンを使用したモック
- 各テストで独立したDependencyContainer

## よくある問題と解決法

### タイムゾーン
- ユーザー入力: JST
- 保存: UTC
- 表示: JST

### 型エラー
- TypeScript strict mode で厳密な型チェック
- ドメインエンティティとDTOの明確な分離

### テストの失敗
- DependencyContainerの適切な初期化を確認
- モックサービスの正しい設定
- D1データベースのテスト用セットアップ

## 今後の改善案

1. 残りのハンドラーのプレゼンテーション層への移行
2. 国際化対応（i18n）
3. パフォーマンスモニタリング
4. WebSocket サポート（リアルタイム更新）
5. 管理者ダッシュボード

## 重要なファイル

### Clean Architecture 実装
- `/src/domain/entities/Schedule.ts` - スケジュールエンティティ
- `/src/application/usecases/schedule/` - スケジュール関連ユースケース
- `/src/infrastructure/factories/DependencyContainer.ts` - DI コンテナ
- `/src/cron/deadline-reminder.ts` - クリーンアーキテクチャ化済み

### 主要ファイル
- `/src/index.ts` - エントリーポイント
- `/src/infrastructure/utils/message-update-queue.ts` - Queuesハンドラー
- `/src/handlers/` - Discord ハンドラー（段階的にプレゼンテーション層へ移行中）

### Database
- `/migrations/0001_initial_schema.sql` - D1スキーマ

## デバッグのヒント

1. `console.log` は Cloudflare ダッシュボードで確認
2. `wrangler tail` でリアルタイムログ
3. `--local` フラグでローカルテスト
4. D1 クエリは `wrangler d1 execute` で直接実行可能
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

### リポジトリパターン
- `src/repositories/interfaces.ts` - インターフェース定義
- `src/repositories/d1/` - D1実装
- `src/repositories/kv/` - KV実装（レガシー）
- `DATABASE_TYPE` 環境変数で切り替え可能

### ストレージサービス
- `StorageServiceV2` - 外部向けAPI（後方互換性）
- `StorageServiceV3` - 内部実装（リポジトリパターン使用）

### 型変換
- `src/types/schedule.ts` - レガシー型定義
- `src/types/schedule-v2.ts` - 新しい型定義と変換関数

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
- StorageServiceV2 を使用してテストを書く
- モックは各テストで独立させる

## よくある問題と解決法

### タイムゾーン
- ユーザー入力: JST
- 保存: UTC
- 表示: JST

### 型エラー
- schedule-v2.ts の変換関数を使用
- StorageServiceV2 がアダプターとして機能

### テストの失敗
- KV モックの初期化を確認
- `DATABASE_TYPE: 'kv'` を環境変数に設定
- StorageService のインスタンス化時に env を渡す

## 今後の改善案

1. 残りのテストの修正
2. エラーハンドリングの統一
3. ログシステムの実装
4. 国際化対応
5. パフォーマンスモニタリング

## 重要なファイル

- `/src/index.ts` - エントリーポイント
- `/src/handlers/modals/index.ts` - モーダルルーティング
- `/src/services/storage-v2.ts` - ストレージアダプター
- `/src/cron/deadline-reminder.ts` - リマインダー処理
- `/migrations/0001_initial_schema.sql` - D1スキーマ

## デバッグのヒント

1. `console.log` は Cloudflare ダッシュボードで確認
2. `wrangler tail` でリアルタイムログ
3. `--local` フラグでローカルテスト
4. D1 クエリは `wrangler d1 execute` で直接実行可能
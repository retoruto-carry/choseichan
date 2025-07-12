# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Discord 調整ちゃん - 開発ガイド

Discord内で日程調整を行うボット。Clean Architecture（Onion Architecture）を採用し、ビジネスロジックと技術的詳細を明確に分離。

## 開発コマンド

```bash
# 開発サーバー起動（ローカル）
npm run dev

# テスト実行
npm test                    # 全テスト（476+ テスト）
npm test -- <file>          # 特定ファイルのテスト
npm run test:ui             # UIでテスト実行
npm run test:coverage       # カバレッジ計測

# 型チェック・リント
npm run typecheck           # TypeScript型チェック
npm run lint                # Biomeでリント
npm run lint:fix            # 自動修正
npm run check               # lint + typecheck

# データベース操作
npm run db:migrate:create   # 新規マイグレーション作成
npm run db:migrate:remote   # 本番環境に適用
npm run db:migrate:local    # ローカルに適用
npm run db:status           # マイグレーション状態確認

# デプロイ
npm run deploy              # 本番デプロイ + コマンド登録
npm run register            # Discord コマンド登録のみ
```

## アーキテクチャ概要

### Clean Architecture レイヤー構成

```
src/
├── domain/                 # ビジネスロジック（依存なし）
│   ├── entities/          # Schedule, Response など
│   ├── services/          # ScheduleDomainService など
│   └── repositories/      # インターフェース定義
│
├── application/           # ユースケース（Domainに依存）
│   ├── usecases/         # 14個のユースケース実装
│   ├── dto/              # データ転送オブジェクト
│   └── services/         # アプリケーションサービス
│
├── infrastructure/        # 外部技術（Domain/Applicationに依存）
│   ├── repositories/     # D1 リポジトリ実装
│   ├── services/         # Discord API通信
│   ├── adapters/         # CloudflareQueueAdapter
│   └── factories/        # DependencyContainer (DI)
│
└── presentation/          # UI層（Application/Infrastructureに依存）
    ├── controllers/      # VoteController など
    └── builders/         # Discord UI構築
```

### 重要な設計原則

1. **依存性逆転**: インフラ層がドメイン層に依存（逆方向はNG）
2. **DI コンテナ**: `DependencyContainer`で全依存関係を管理
3. **リポジトリパターン**: D1データベースアクセスを抽象化
4. **非同期処理**: Cloudflare Queuesでメッセージ更新を最適化

## Cloudflare Workers 特有の制約

- **実行時間**: 最大30秒（通常は3秒以内）
- **メモリ**: 128MB制限
- **setTimeout不可**: `waitUntil()`または Queues を使用
- **CPU制限**: 無限ループや再帰的Promise禁止

## データベース（D1）

### テーブル構造
- `schedules`: 日程調整マスタ（6ヶ月でTTL）
- `schedule_dates`: 日程候補（正規化）
- `responses`: 回答マスタ
- `response_date_status`: 各日程への回答状態

### トランザクション処理
```typescript
// D1はトランザクションをサポート
await db.batch([
  db.prepare('INSERT INTO schedules...').bind(...),
  db.prepare('INSERT INTO schedule_dates...').bind(...)
]);
```

## メッセージ更新システム（Queues）

投票時のメッセージ更新を最適化：
- 投票更新: 2秒遅延でデバウンス
- 締切更新: 即座に実行
- バッチ処理で効率化

## テスト戦略

- **Vitest**: 順次実行設定（`vitest.config.ts`）
- **D1モック**: `better-sqlite3`でインメモリDB
- **DependencyContainer**: 各テストで独立インスタンス

## Discord API 制限

- Webhook: 30リクエスト/分
- Embed: 最大10個、各6000文字
- コンポーネント: 最大5行×5要素

## 構造化ログ

```typescript
import { getLogger } from '../infrastructure/logging/Logger';
const logger = getLogger();

logger.info('操作完了', { 
  operation: 'create-schedule',
  scheduleId: 'xxx' 
});
```

## 日本語対応

- コメント: 日本語で記述
- ユーザー入力: JST想定
- 内部保存: UTC
- 表示: JST変換

## 主要エントリーポイント

- `/src/index.ts`: Honoアプリケーション
- `/src/infrastructure/utils/message-update-queue.ts`: Queuesハンドラー
- `/src/infrastructure/factories/DependencyContainer.ts`: DI設定
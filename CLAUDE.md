# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Discord 調整ちゃん - 開発ガイド

Discord内で日程調整を行うボット。Clean Architecture（Onion Architecture）を採用し、ビジネスロジックと技術的詳細を明確に分離。

## 開発コマンド

```bash
# 開発サーバー起動（ローカル）
npm run dev

# テスト実行
npm test                    # 全テスト（461テスト - 100%パス）
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
│   ├── services/         # アプリケーションサービス
│   ├── ports/            # Infrastructure抽象化Interface
│   └── types/            # Application層専用型定義
│
├── infrastructure/        # 外部技術（Domain/Applicationに依存）
│   ├── repositories/     # D1 リポジトリ実装
│   ├── services/         # Discord API通信
│   ├── adapters/         # Port実装（Logger, DiscordApi等）
│   ├── ports/            # インフラ固有のインターフェース
│   ├── utils/            # Queueハンドラー等のユーティリティ
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
4. **非同期処理**: Cloudflare Queuesでメッセージ更新・締切リマインダーを最適化
5. **Port/Adapterパターン**: 環境依存の処理を抽象化（BackgroundExecutor等）

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

## 非同期処理システム（Cloudflare Queues）

### メッセージ更新Queue
投票時のメッセージ更新を最適化：
- 投票更新: 2秒遅延でデバウンス
- 締切更新: 即座に実行
- バッチ処理で効率化（最大10件/バッチ）

### 締切リマインダーQueue
Discord APIレート制限に対応：
- リマインダー送信: バッチで処理（最大20件/バッチ）
- 自動締切処理: スケジュールを自動でクローズ
- サマリー送信: 締切後の結果を通知
- タスクタイプ: `send_reminder`, `close_schedule`, `send_summary`

## 開発プロセス - TDD (Test-Driven Development)

### 基本的な流れ
1. **Red**: 失敗するテストを先に書く
2. **Green**: テストを通す最小限のコードを実装
3. **Refactor**: コードを整理・最適化

### 実践例
```typescript
// 1. Red - 失敗するテストから始める
describe('ScheduleDomainService', () => {
  it('締切日時を過ぎたスケジュールは締切可能', () => {
    const schedule = new Schedule({ deadline: new Date('2024-01-01') });
    expect(schedule.canBeClosed(new Date('2024-01-02'))).toBe(true);
  });
});

// 2. Green - 最小限の実装
canBeClosed(currentDate: Date): boolean {
  return this.deadline ? currentDate > this.deadline : true;
}

// 3. Refactor - より良い実装に
canBeClosed(currentDate: Date = new Date()): boolean {
  if (!this.deadline) return true;
  return currentDate > this.deadline;
}
```

## テスト戦略

### テスト実行と構成
- **Vitest**: 順次実行設定（`vitest.config.ts`）
- **D1モック**: `better-sqlite3`でインメモリDB
- **DependencyContainer**: 各テストで独立インスタンス
- **カバレッジ目標**: 80%以上（ビジネスロジックは100%）

### テストの種類と配置
- **Unit Tests**: 各レイヤーと同じディレクトリに配置 (`*.test.ts`)
- **Integration Tests**: `/tests/integration/` に配置
- **Test Helpers**: `/tests/helpers/` に共通処理

### テスト作成のベストプラクティス
1. **Arrange-Act-Assert パターン**
   ```typescript
   it('投票を正しく処理する', async () => {
     // Arrange: テストデータとモックを準備
     const mockSchedule = createMockSchedule();
     vi.mocked(mockUseCase.execute).mockResolvedValue({ success: true });
     
     // Act: テスト対象を実行
     const result = await controller.handleVote(interaction);
     
     // Assert: 結果を検証
     expect(result.status).toBe(200);
     expect(mockUseCase.execute).toHaveBeenCalledWith(expectedParams);
   });
   ```

2. **モックの独立性**
   - 各テストで新しいモックインスタンスを作成
   - `beforeEach` で `vi.clearAllMocks()` を実行
   - グローバル状態を避ける

3. **エラーケースも必ずテスト**
   - 正常系だけでなく異常系も網羅
   - エッジケースを意識的にテスト

4. **型安全性の徹底**
   - 非nullアサーション（`!`）は避ける
   - テストでも明示的な型ガードを使用
   - `expect().toBeDefined()` + `if (!value)` パターンを推奨

## コード品質管理

### Linting (Biome)
```bash
# リントチェック
npm run lint

# 自動修正
npm run lint:fix

# フォーマットのみ
npm run format
```

### 重要なルール
- **未使用インポートの禁止**: Biomeが自動検出・削除
- **console.log禁止**: 構造化ログ（Logger）を使用
- **any型の最小化**: 適切な型定義を使用
- **非nullアサーション禁止**: テストでも型ガードを使用
- **コメントは日本語**: ビジネスロジックの説明は日本語で

### Type Checking
```bash
# 型チェック実行
npm run typecheck

# エラーが出た場合の対処
# 1. まず型定義が正しいか確認
# 2. 必要に応じて型ガードを追加
# 3. どうしても必要な場合のみ型アサーションを使用
```

### 型安全性のポイント
1. **strict mode有効**: `tsconfig.json` で設定済み
2. **unknown vs any**: 不明な型は `unknown` を使用
3. **型ガードの活用**:
   ```typescript
   function isScheduleResponse(data: unknown): data is ScheduleResponse {
     return typeof data === 'object' && data !== null && 'id' in data;
   }
   ```

## CI/CD前チェックリスト

### コミット前に必ず実行
```bash
# 1. テストが全て通ることを確認
npm test

# 2. 型エラーがないことを確認
npm run typecheck

# 3. リントエラーがないことを確認
npm run lint

# 4. または一括チェック
npm run check  # biome check && tsc --noEmit
```

### よくあるエラーと対処法

1. **型エラー: 'X' is possibly 'undefined'**
   - オプショナルチェイニング使用: `obj?.property`
   - Null合体演算子使用: `value ?? defaultValue`

2. **テストエラー: モックが正しく動作しない**
   - `vi.clearAllMocks()` を `beforeEach` に追加
   - モックの戻り値を正しく設定

3. **テストでの型安全性: 非nullアサーション（!）の回避**
   ```typescript
   // ❌ 避けるべき書き方
   const summary = summaryResult.summary!;
   
   // ✅ 推奨する書き方
   expect(summaryResult.summary).toBeDefined();
   if (!summaryResult.summary) {
     throw new Error('Summary should be defined');
   }
   const summary = summaryResult.summary;
   ```

4. **リントエラー: Import順序**
   - Biomeの自動修正を実行: `npm run lint:fix`

## Discord API 制限

- Webhook: 30リクエスト/分
- Embed: 最大10個、各6000文字
- コンポーネント: 最大5行×5要素
- Search Guild Members: 10リクエスト/10秒（ボット全体）
- メンション形式: `<@ユーザーID>` のみ有効（`@username`は通知されない）

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

- `/src/index.ts`: Honoアプリケーション、Queuesコンシューマー
- `/src/infrastructure/utils/message-update-queue.ts`: メッセージ更新Queueハンドラー
- `/src/infrastructure/utils/deadline-reminder-queue.ts`: 締切リマインダーQueueハンドラー
- `/src/infrastructure/factories/DependencyContainer.ts`: DI設定
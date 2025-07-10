# Discord 調整ちゃん - Architecture Documentation

## アーキテクチャ概要

このプロジェクトは、Jeffrey Palermoの **Clean Architecture (Onion Architecture)** パターンに基づいて設計されています。

## 依存関係の方向

```
User Interface → Application → Domain ← Infrastructure
```

- **Domain**: 純粋なビジネスロジック（依存なし）
- **Application**: ユースケースとDTO（Domainに依存）
- **Infrastructure**: 外部技術（DomainとApplicationに依存）
- **Presentation**: UI構築（ApplicationとInfrastructureに依存）

## レイヤー構成

### 1. Domain Layer (`src/domain/`)
ビジネスロジックの中核。外部への依存なし。

- **Entities**: `entities/` - ビジネスルールを持つドメインオブジェクト
  - `Schedule.ts` - スケジュールエンティティ
  - `Response.ts` - 回答エンティティ
  - `ScheduleDate.ts`, `ResponseStatus.ts`, `User.ts`

- **Domain Services**: `services/` - 複数エンティティにまたがるビジネスロジック
  - `ScheduleDomainService.ts` - スケジュール関連のドメインサービス
  - `ResponseDomainService.ts` - 回答関連のドメインサービス

- **Repository Interfaces**: `repositories/interfaces.ts` - データアクセス抽象化

### 2. Application Layer (`src/application/`)
ユースケースとデータ転送オブジェクト。Domainにのみ依存。

- **Use Cases**: `usecases/` - ビジネス要件に対応する処理フロー
  - `schedule/` - スケジュール関連ユースケース
  - `response/` - 回答関連ユースケース

- **DTOs**: `dto/` - レイヤー間データ転送オブジェクト
  - `ScheduleDto.ts`, `ResponseDto.ts`

- **Mappers**: `mappers/` - ドメインオブジェクトとDTOの変換
  - `ScheduleMapper.ts`, `ResponseMapper.ts`

### 3. Infrastructure Layer (`src/infrastructure/`)
外部技術の実装。DomainとApplicationに依存。

- **Repository Implementations**: `repositories/d1/` - データアクセス実装
  - `schedule-repository.ts`, `response-repository.ts`
  - `factory.ts` - リポジトリファクトリ

- **External Services**: `services/` - 外部サービス実装
  - `DiscordApiService.ts` - Discord API通信

- **Factories**: `factories/` - 依存関係注入
  - `DependencyContainer.ts` - アプリケーション全体の依存関係管理
  - `factory.ts` - 環境に応じたファクトリ

### 4. Presentation Layer (`src/presentation/`)
UI構築とコントローラー。ApplicationとInfrastructureに依存。

- **Controllers**: `controllers/` - ユースケース実行とUI調整
  - `ScheduleController.ts`, `ResponseController.ts`

- **UI Builders**: `builders/` - Discord UI構築専用
  - `ScheduleUIBuilder.ts`, `ResponseUIBuilder.ts`

### 5. Legacy Handlers (`src/handlers/`)
既存のハンドラー。段階的にPresentationレイヤーに移行予定。

- Discord インタラクションの直接処理
- 旧StorageServiceV2を使用（後方互換性のため）

## データベース構成

### D1 Database (SQLite)
- **Primary**: Cloudflare D1を使用
- **Testing**: better-sqlite3でモック

### テーブル構造
- `schedules` - スケジュール情報
- `schedule_dates` - 日程候補（正規化）
- `responses` - 回答情報
- `response_date_status` - 各日程への回答状態

## 主要機能

### スケジュール管理
- 作成、更新、削除、締切処理
- カスタムリマインダー設定
- 自動期限管理（6ヶ月TTL）

### 回答システム
- リアルタイム投票更新
- 統計情報計算
- 最適日程算出

### 通知システム
- 段階的リマインダー（3日前、1日前、8時間前）
- カスタムタイミング対応
- レート制限対応

## テスト戦略

### テスト配置
- **Unit Tests**: 各レイヤーにco-located
- **Integration Tests**: `tests/integration/`
- **Test Helpers**: `tests/helpers/`

### テストデータベース
- D1Database互換のSQLiteモック
- 各テストで独立したデータベースインスタンス
- マイグレーション自動適用

## 設定とデプロイ

### 環境設定
- **Development**: `wrangler dev`
- **Production**: Cloudflare Workers
- **Database**: D1のみ（KVから完全移行済み）

### 依存関係
- TypeScript 5.x
- Vitest (テスト)
- better-sqlite3 (テスト用D1モック)
- discord-interactions

## 移行状況とアーキテクチャ戦略

### 完了済み
- ✅ KVからD1への完全移行
- ✅ Clean Architecture基盤実装
- ✅ 全テスト動作確認（116テスト合格）
- ✅ 型安全性確保（TypeScript strict mode）
- ✅ コード品質確保（ESLint/Prettier）
- ✅ 重要システム機能のClean Architecture移行
  - `src/cron/deadline-reminder.ts` - クリーンアーキテクチャ化完了
  - DeadlineReminderUseCase, ProcessReminderUseCase実装
  - GetScheduleSummaryUseCase, FindSchedulesUseCaseの追加

### 現在の実装状況

#### 🔵 Clean Architecture適用済み
**ドメイン駆動設計によるコア実装**
- `src/domain/` - 純粋ビジネスロジック（エンティティ・ドメインサービス）
- `src/application/` - ユースケース実装（11個のユースケース完備）
- `src/infrastructure/` - 外部技術実装（D1リポジトリ・ファクトリ）
- `src/presentation/` - UI構築とコントローラー基盤
- `src/cron/` - 重要なスケジュールジョブ（完全移行済み）

#### 🟡 Legacy Architecture継続（段階的移行対象）
**既存ハンドラー（StorageServiceV2経由）**
- `src/handlers/` - Discord インタラクション処理（11ファイル）
- `src/services/storage-v2.ts` - 後方互換性アダプター

#### 📋 移行完了計画
1. ✅ **コアシステム**: cron/deadline-reminder.ts の Clean Architecture化
2. 🔄 **ハンドラー**: 段階的にClean Architectureへ移行
3. 🔄 **最終統合**: StorageServiceV2の段階的廃止

### アーキテクチャ利点

#### Clean Architecture (新機能)
- 🔄 ドメインロジックの独立性
- 🧪 高いテスタビリティ
- 🔧 変更の局所化
- 📈 拡張性とメンテナンス性

#### Legacy Architecture (既存機能)
- ✅ 実績のある安定稼働
- 🛡️ ビジネス継続性保証
- ⚡ 既知の性能特性
- 🔄 現行運用との親和性

### 将来の計画
- 📋 ハンドラーのClean Architecture移行完了
- 📋 StorageServiceV2の段階的廃止
- 📋 統合テスト強化
- 📋 監視・ログ改善
- 📋 国際化対応
- 📋 パフォーマンス最適化

## ベストプラクティス

### コード品質
- TypeScript strict mode
- ESLint + Prettier
- 100% テストカバレッジ維持

### セキュリティ
- 秘密情報の適切な管理
- 入力値検証の徹底
- Discord API制限の遵守

### パフォーマンス
- レート制限対応
- バッチ処理の実装
- メモリ効率の最適化（128MB制限）

## 参考資料

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Onion Architecture by Jeffrey Palermo](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Discord API Documentation](https://discord.com/developers/docs/)
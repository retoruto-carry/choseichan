# Handler Refactoring Guide

このドキュメントは、既存のハンドラーをClean Architectureに移行するためのガイドです。

## 移行パターン

### Before: 従来のハンドラー構造

```typescript
// src/handlers/schedule-handlers.ts (従来)
export async function handleStatusButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  // 1. パラメータ処理
  // 2. StorageService直接呼び出し
  // 3. UI構築
  // 4. Discord レスポンス作成
  // → 全てが1つの関数に混在
}
```

### After: Clean Architecture構造

```typescript
// src/presentation/controllers/ScheduleStatusController.ts (新構造)
export class ScheduleStatusController {
  constructor(
    private readonly dependencyContainer: DependencyContainer,
    private readonly uiBuilder: ScheduleStatusUIBuilder
  ) {}

  async handleStatusButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    // 1. パラメータ検証
    // 2. ユースケース実行 (Clean Architecture)
    // 3. UI構築 (分離されたBuilder)
    // 4. Discord レスポンス作成
  }
}
```

## アーキテクチャ分離の利点

### 1. 責任の分離
- **Controller**: Discord インタラクション処理
- **UseCase**: ビジネスロジック
- **UIBuilder**: Discord UI構築
- **Repository**: データアクセス

### 2. テスタビリティ
- 各レイヤーを独立してテスト可能
- モック化が容易
- ユニットテストの作成が簡単

### 3. 再利用性
- UIBuilderは複数のControllerで再利用可能
- UseCaseは異なるインターフェース（Web API等）でも利用可能

### 4. 変更の局所化
- Discord API仕様変更 → UIBuilderのみ修正
- ビジネスルール変更 → UseCaseのみ修正
- データストレージ変更 → Repositoryのみ修正

## 移行手順

### Step 1: UIBuilder作成
```typescript
// src/presentation/builders/[Feature]UIBuilder.ts
export class FeatureUIBuilder {
  createEmbed(data: DTO): DiscordEmbed { }
  createComponents(params: any): DiscordComponent[] { }
}
```

### Step 2: Controller作成
```typescript
// src/presentation/controllers/[Feature]Controller.ts
export class FeatureController {
  constructor(
    private readonly container: DependencyContainer,
    private readonly uiBuilder: FeatureUIBuilder
  ) {}
  
  async handleInteraction(): Promise<Response> {
    // UseCase実行 + UI構築
  }
}
```

### Step 3: 既存ハンドラーの段階的置き換え
```typescript
// 既存ハンドラーから新しいControllerを呼び出し
export async function legacyHandler(interaction: any, env: Env) {
  const controller = createFeatureController(env);
  return controller.handleInteraction(interaction);
}
```

## 実装済み例

### ScheduleStatusController
- **ファイル**: `src/presentation/controllers/ScheduleStatusController.ts`
- **UIBuilder**: `src/presentation/builders/ScheduleStatusUIBuilder.ts`
- **対象**: `handleStatusButton` 関数のリファクタリング例

## 残り移行対象

### 優先度高（肥大化ハンドラー）
1. `src/handlers/schedule-handlers.ts` (509行)
2. `src/handlers/edit-handlers.ts` (391行)

### 優先度中
3. `src/handlers/vote-handlers.ts` (215行)
4. `src/handlers/commands.ts` (162行)

### 優先度低（軽量）
5. `src/handlers/buttons.ts` (99行)
6. その他の小規模ハンドラー

## 移行の指針

1. **段階的移行**: 一度に全てを変更せず、機能単位で移行
2. **後方互換性**: 既存のハンドラーは動作を維持
3. **テスト駆動**: 移行後もテストが全て通ることを確認
4. **ドキュメント更新**: 移行完了後にアーキテクチャ文書を更新

## 注意点

- **StorageServiceV2**: 後方互換性のため当面保持
- **テスト**: 移行後も既存テスト（116個）が全て通ることを確認
- **型安全性**: TypeScript strict modeを維持
- **パフォーマンス**: 実行時性能を悪化させない
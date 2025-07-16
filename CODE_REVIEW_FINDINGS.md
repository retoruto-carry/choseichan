# Discord Choseisan コードレビュー結果

## 1. Clean Architecture違反

### 問題: Presentation層がDomain層を直接参照
以下のファイルでPresentation層がDomain層のユーティリティを直接インポートしています：

- `/src/presentation/controllers/CreateScheduleController.ts`
  - `import { parseUserInputDate } from '../../domain/utils/date';`
  - `import { generateId } from '../../domain/utils/id';`
  
- `/src/presentation/controllers/EditModalController.ts`
  - 同様のドメインユーティリティのインポート

**推奨対応**: Application層にこれらの機能を提供するサービスまたはポートを作成し、Presentation層はそれを経由してアクセスするようにする。

### 問題: ErrorHandlerでのドメイン層参照
- `/src/presentation/errors/ErrorHandler.ts`がドメイン層のエラーを直接参照している可能性

## 2. テストカバレッジのギャップ

### テストファイルが存在しない主要なファイル：
- `/src/di/factory.ts` - DIファクトリー
- `/src/application/usecases/schedule/DeadlineReminderUseCase.ts` - 重要なユースケース
- `/src/application/usecases/schedule/ProcessReminderUseCase.ts` - リマインダー処理
- `/src/application/usecases/message/ProcessMessageUpdateUseCase.ts` - メッセージ更新処理
- `/src/application/services/MessageUpdateServiceImpl.ts` - メッセージ更新サービス実装
- `/src/application/services/ScheduleUpdaterService.ts` - スケジュール更新サービス

**影響**: これらの重要なビジネスロジックのテストがないため、バグが混入しやすい。

## 3. 命名規則の不統一

### "Impl" サフィックスの使用
- `MessageUpdateServiceImpl` のみ "Impl" サフィックスを使用
- 他のアダプター実装（例：`DiscordApiAdapter`, `LoggerAdapter`）は "Adapter" サフィックスを使用

**推奨**: 一貫性のため、すべての実装クラスで同じ命名規則を使用する。

## 4. コンソールログの使用

以下のファイルで `console.log` が使用されています（Loggerを使用すべき）：
- `/src/infrastructure/utils/deadline-reminder-queue.ts`
- `/src/infrastructure/cron/deadline-reminder.ts`
- `/src/presentation/utils/discord-webhook.ts`

**推奨**: すべて構造化ログ（Logger）に置き換える。

## 5. 型安全性の改善機会

### 潜在的な型キャストの問題
- `/src/presentation/utils/embeds.ts` (行128-130)で不必要な型キャスト：
```typescript
const deadlineStr =
  (schedule.deadline as unknown) instanceof Date
    ? (schedule.deadline as unknown as Date).toISOString()
    : (schedule.deadline as string);
```

**推奨**: DTOの型定義を明確にし、このような型キャストを避ける。

## 6. パフォーマンスの改善機会

### 並列処理可能な箇所
複数のリポジトリ操作やAPIコールが順次実行されている箇所があり、`Promise.all()` で並列化できる可能性がある。

## 7. エラーハンドリングの改善

### 具体的なエラータイプの不足
多くの場所で汎用的な `Error` をスローしているが、より具体的なエラータイプを使用すべき。

## 8. 定数化すべきマジックナンバー

以下の数値がハードコーディングされている：
- Discord Embedの制限値（25）
- 各種タイムアウト値
- バッチサイズ

## 9. ドキュメンテーションの改善機会

### JSDocコメントの不足
多くの public メソッドやインターフェースにJSDocコメントが不足している。

## 10. セキュリティ考慮事項

### SQL インジェクション対策
確認した限り、すべてのSQLクエリは適切にパラメータ化されており、SQLインジェクションのリスクは低い。

## 優先度別の対応推奨

### 高優先度
1. Clean Architecture違反の修正
2. 重要なビジネスロジックのテスト追加
3. console.logのLogger置き換え

### 中優先度
4. 命名規則の統一
5. 型安全性の改善
6. エラーハンドリングの改善

### 低優先度
7. パフォーマンス最適化
8. マジックナンバーの定数化
9. ドキュメンテーションの追加

## 良い点

1. **Clean Architectureの基本構造**: 全体的によく整理されている
2. **名前付き引数パターン**: 多くの場所で適切に使用されている
3. **SQLインジェクション対策**: 適切にパラメータ化されている
4. **型定義**: ほとんどの場所で適切に型が定義されている
5. **テスト**: 存在するテストは包括的で質が高い（461テスト、100%パス）
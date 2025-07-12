# Discord 調整ちゃん - Clean Architecture 設計書

## 概要

Discord 調整ちゃんは、Jeffrey Palermo の Onion Architecture（Clean Architecture）パターンを採用した Discord ボットです。Port/Adapter パターンを使用してビジネスロジックと技術的詳細を明確に分離し、テスタビリティ、保守性、拡張性を重視した設計となっています。

## 技術スタック

- **ランタイム**: Cloudflare Workers (エッジコンピューティング)
- **言語**: TypeScript (strict mode)
- **データベース**: Cloudflare D1 (SQLite エッジデータベース)
- **キュー**: Cloudflare Queues (メッセージ更新の最適化)
- **テストフレームワーク**: Vitest
- **コード品質**: Biome (Linting & Formatting)
- **デプロイ**: Wrangler CLI

## Clean Architecture レイヤー構成

### 依存関係のルール

**依存方向**: 外側から内側への一方向のみ

```
Presentation → Application → Domain
Infrastructure → Application → Domain
```

- **Domain層**: 他のレイヤーに依存しない（最内層）
- **Application層**: Domain層のみに依存
- **Infrastructure層**: Domain層とApplication層に依存
- **Presentation層**: Application層とInfrastructure層に依存（最外層）

### ディレクトリ構造

```
src/
├── domain/                 # ビジネスロジック（依存なし）
│   ├── entities/          # Schedule, Response など
│   ├── services/          # ScheduleDomainService など
│   └── repositories/      # インターフェース定義
│
├── application/           # ユースケース（Domainに依存）
│   ├── usecases/         # 14個のユースケース実装
│   ├── services/         # アプリケーションサービス
│   ├── dto/              # データ転送オブジェクト
│   ├── mappers/          # ドメイン⇔DTO変換
│   ├── ports/            # 外部依存の抽象化（Port Interface）
│   └── types/            # アプリケーション型定義
│
├── infrastructure/        # 外部技術（Domain/Applicationに依存）
│   ├── repositories/     # D1 リポジトリ実装
│   ├── services/         # Discord API通信
│   ├── adapters/         # Port実装（Adapter）
│   └── factories/        # DependencyContainer (DI)
│
└── presentation/          # UI層（Application/Infrastructureに依存）
    ├── controllers/      # VoteController など
    └── builders/         # Discord UI構築
```

## Port/Adapter パターン

### Port Interface（ポート）

Application層で定義される外部依存の抽象化：

```typescript
// src/application/ports/DiscordApiPort.ts
export interface IDiscordApiPort {
  updateMessage(channelId: string, messageId: string, content: object, token: string): Promise<void>;
  sendMessage(channelId: string, content: object, token: string): Promise<{ id: string }>;
  sendNotification(channelId: string, content: string, token: string): Promise<void>;
  fetchGuildMembers(guildId: string, token: string): Promise<Array<{...}>>;
}

// src/application/ports/LoggerPort.ts
export interface ILogger {
  info(message: string, meta?: object): void;
  warn(message: string, meta?: object): void;
  error(message: string, error?: Error, meta?: object): void;
  debug(message: string, meta?: object): void;
}

// src/application/ports/EnvironmentPort.ts
export interface IEnvironmentPort {
  get(key: string): string | undefined;
  getOptional(key: string): string | undefined;
  getRequired(key: string): string;
}
```

### Adapter 実装（アダプター）

Infrastructure層でPortインターフェースを実装：

```typescript
// src/infrastructure/adapters/DiscordApiAdapter.ts
export class DiscordApiAdapter implements IDiscordApiPort {
  private discordApiService = new DiscordApiService();

  async updateMessage(channelId: string, messageId: string, content: object, token: string): Promise<void> {
    await this.discordApiService.updateMessage(channelId, messageId, content, token);
  }
  // ... 他のメソッド実装
}

// src/infrastructure/adapters/LoggerAdapter.ts
export class LoggerAdapter implements ILogger {
  private logger = getLogger();

  info(message: string, meta?: LogContext): void {
    this.logger.info(message, meta);
  }
  // ... 他のメソッド実装
}
```

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
- **Database**: D1 (SQLite)

### 依存関係
- TypeScript 5.x
- Vitest (テスト)
- better-sqlite3 (テスト用D1モック)
- discord-interactions

## 移行状況とアーキテクチャ戦略

### 完了済み実装
- ✅ D1 データベース実装
- ✅ Clean Architecture完全実装
- ✅ 全テスト動作確認（470+ テスト合格）
- ✅ 型安全性確保（TypeScript strict mode、エラー0件）
- ✅ コード品質確保（Biome導入、未使用import削除）
- ✅ 構造化ログシステム導入（全console.log移行済み）
- ✅ ベストプラクティス適用
  - ErrorResponseFactory による統一エラーハンドリング
  - ValidationService による入力検証統一
  - RateLimitService によるレート制限
- ✅ 日本語コメント化完了
- ✅ Cloudflare Queues によるメッセージ更新最適化

### 現在の実装状況（2025年7月時点）

#### ✅ Clean Architecture 完全移行済み
- **ドメイン層**: 5エンティティ、3ドメインサービス
  - エンティティ: Schedule, Response, ScheduleDate, ResponseStatus, User
  - ドメインサービス: ScheduleDomainService, ResponseDomainService, MessageUpdateService
- **アプリケーション層**: 14ユースケース実装
  - Schedule: Create, Update, Delete, Close, Reopen, GetSchedule, GetSummary, FindSchedules
  - Response: Submit, Update, GetResponse
  - System: ProcessDeadlineReminders, DeadlineReminder
  - Message: ProcessMessageUpdate
- **インフラストラクチャ層**: 
  - D1リポジトリ実装
  - 構造化ログシステム
  - バリデーションサービス
  - レート制限サービス
  - エラーレスポンスファクトリー
  - Cloudflare Queues アダプター
- **プレゼンテーション層**: 11コントローラー、11UIビルダー

#### 🎯 品質指標
- **テスト**: 464 テスト（100% 合格）
- **型安全性**: TypeScript strict mode、エラー0件
- **コード品質**: Biome による統一されたフォーマット
- **ログ**: 全ての console.log を構造化ログに移行
- **Clean Architecture**: Port/Adapter パターンで100%準拠

#### 主要機能の特徴
1. **日程調整**: モーダルフォームによる直感的な作成
2. **回答システム**: ○△× の3段階評価機能（コメント機能は削除済み）
3. **自動化**: 締切リマインダーと自動締切処理
4. **セキュリティ**: Ed25519署名検証とレート制限
5. **パフォーマンス**: Cloudflare Queuesによる非同期メッセージ更新

## 依存性注入（DI）

### DependencyContainer

全ての依存関係を管理する中央集権的なコンテナ：

```typescript
// src/infrastructure/factories/DependencyContainer.ts
export class DependencyContainer {
  private static instance: DependencyContainer;
  private repositories: Map<string, any> = new Map();
  private services: Map<string, any> = new Map();
  private useCases: Map<string, any> = new Map();

  static getInstance(): DependencyContainer {
    if (!this.instance) {
      this.instance = new DependencyContainer();
    }
    return this.instance;
  }

  createVoteController(env: Env): VoteController {
    const scheduleRepo = this.getScheduleRepository(env);
    const responseRepo = this.getResponseRepository(env);
    
    // Port/Adapter パターンを使用
    const logger = new LoggerAdapter();
    const discordApi = new DiscordApiAdapter();
    
    const useCase = new VoteUseCase(scheduleRepo, responseRepo);
    
    return new VoteController(useCase, logger, discordApi);
  }
}
```

## ベストプラクティス

### Entity 設計

```typescript
// src/domain/entities/Schedule.ts
export class Schedule {
  private constructor(
    private readonly _id: string,
    private readonly _guildId: string,
    // ... プライベートフィールド
  ) {}

  // ファクトリーメソッド
  static create(data: ScheduleCreateData): Schedule {
    // バリデーションロジック
    return new Schedule(/* ... */);
  }

  // ビジネスロジック
  canBeClosed(currentDate: Date = new Date()): boolean {
    if (!this.deadline) return true;
    return currentDate > this.deadline;
  }

  // イミュータブルな更新
  updateDeadline(newDeadline: Date): Schedule {
    return new Schedule(
      this._id,
      this._guildId,
      // ... 他のフィールド
      newDeadline,
      // ...
    );
  }
}
```

### UseCase 設計

```typescript
// src/application/usecases/schedule/CreateScheduleUseCase.ts
export class CreateScheduleUseCase {
  constructor(
    private scheduleRepository: IScheduleRepository,
    private responseRepository: IResponseRepository,
    private logger: ILogger  // Portインターフェース使用
  ) {}

  async execute(input: CreateScheduleInput): Promise<CreateScheduleResult> {
    try {
      // 1. 入力検証
      const validatedInput = this.validateInput(input);
      
      // 2. ビジネスロジック実行
      const schedule = Schedule.create(validatedInput);
      
      // 3. 永続化
      await this.scheduleRepository.save(schedule);
      
      // 4. 結果返却
      return {
        success: true,
        schedule: ScheduleMapper.scheduleToDto(schedule)
      };
    } catch (error) {
      this.logger.error('Schedule creation failed', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
  }
}
```

### Repository パターン

```typescript
// src/domain/repositories/interfaces/IScheduleRepository.ts
export interface IScheduleRepository {
  save(schedule: Schedule): Promise<void>;
  findById(id: string, guildId: string): Promise<Schedule | null>;
  findByChannel(channelId: string, guildId: string): Promise<Schedule[]>;
  delete(id: string, guildId: string): Promise<void>;
}

// src/infrastructure/repositories/D1ScheduleRepository.ts
export class D1ScheduleRepository implements IScheduleRepository {
  constructor(private db: D1Database) {}

  async save(schedule: Schedule): Promise<void> {
    const data = ScheduleMapper.domainToData(schedule);
    await this.db.prepare(INSERT_SCHEDULE_SQL).bind(...data).run();
  }
}
```

## テスト戦略

### 単体テスト

各レイヤーを独立してテスト：

```typescript
// Domain層のテスト
describe('Schedule Entity', () => {
  it('should allow closing after deadline', () => {
    const schedule = Schedule.create({ 
      deadline: new Date('2024-01-01') 
    });
    expect(schedule.canBeClosed(new Date('2024-01-02'))).toBe(true);
  });
});

// Application層のテスト（モック使用）
describe('CreateScheduleUseCase', () => {
  it('should create schedule successfully', async () => {
    const mockRepo = { save: vi.fn() };
    const mockLogger = { info: vi.fn(), error: vi.fn() };
    
    const useCase = new CreateScheduleUseCase(mockRepo, mockLogger);
    const result = await useCase.execute(validInput);
    
    expect(result.success).toBe(true);
    expect(mockRepo.save).toHaveBeenCalled();
  });
});
```

### 統合テスト

```typescript
// tests/integration/schedule-creation.test.ts
describe('Schedule Creation Integration', () => {
  let container: DependencyContainer;
  let testDb: D1Database;

  beforeEach(async () => {
    testDb = createTestDatabase();
    container = new DependencyContainer();
    container.setDatabase(testDb);
  });

  it('should create and persist schedule', async () => {
    const useCase = container.getCreateScheduleUseCase();
    const result = await useCase.execute(testInput);
    
    expect(result.success).toBe(true);
    
    // データベースから検証
    const saved = await testDb.prepare('SELECT * FROM schedules WHERE id = ?')
      .bind(result.schedule.id).first();
    expect(saved).toBeDefined();
  });
});
```

## Cloudflare Queues による非同期処理

### なぜ Queues を使うのか

Discord 調整ちゃんでは、メッセージ更新と締切リマインダー処理に Cloudflare Queues を採用しています。その設計理由を説明します。

### メッセージ更新 Queue

#### 問題点（Queues なし）
```typescript
// ❌ 同期的な更新の問題
async handleVote(interaction) {
  await saveVoteToDatabase();  // 10ms
  await updateDiscordMessage(); // 300ms ← ユーザーを待たせる
  return response;              // 合計 310ms+
}
```

**課題:**
1. Discord の 3 秒制限に近づく
2. 複数人の同時投票で詰まる
3. API エラーで投票自体が失敗

#### 解決策（Queues あり）
```typescript
// ✅ 非同期更新による解決
async handleVote(interaction) {
  await saveVoteToDatabase();           // 10ms
  await queueMessageUpdate();           // 5ms
  return response;                      // 合計 15ms のみ！
}
```

### 重要：更新の一貫性保証

```typescript
// ProcessMessageUpdateUseCase.executeBatch() 内
const latestUpdates = new Map<string, MessageUpdateTask>();

for (const task of tasks) {
  const key = `${task.scheduleId}:${task.messageId}`;
  latestUpdates.set(key, task); // 最新のタスクのみ保持
}
```

**動作例:**
```
0秒: User A 投票 → task1（A=○）
1秒: User B 投票 → task2（A=○, B=△）
2秒: User C 投票 → task3（A=○, B=△, C=×）

5秒後のバッチ処理:
- 3つのタスクが届く
- Map により task3（最新）のみ選択
- DB から最新状態を取得して更新
→ 古い状態での上書きを完全に防止
```

### 締切リマインダー Queue

#### バッチ送信による効率化
```typescript
// ProcessDeadlineRemindersUseCase 内
const tasks = reminders.map(reminder => ({
  type: 'send_reminder',
  scheduleId: reminder.scheduleId,
  guildId: reminder.guildId,
}));

await deadlineReminderQueue.sendBatch(tasks); // 一括送信
```

**利点:**
- Discord API レート制限（10 リクエスト/10 秒）を自然に回避
- 大量のリマインダーを効率的に処理
- エラー時の自動リトライ

### Queues 設定

```toml
# wrangler.toml
[[queues.consumers]]
queue = "message-update-queue"
max_batch_size = 10      # 10個まで待つ
max_batch_timeout = 5    # または5秒でタイムアウト

[[queues.consumers]]
queue = "deadline-reminder-queue"
max_batch_size = 20      # 20個まで待つ
max_batch_timeout = 10   # または10秒でタイムアウト
```

### まとめ

Cloudflare Queues により：
1. **応答性の向上**: ユーザーへの即座のフィードバック（15ms vs 310ms）
   - 注: メッセージの実際の更新は最大7秒後（遅延2秒 + バッチ待機5秒）
2. **データ整合性**: 最新状態のみを反映する仕組み
3. **スケーラビリティ**: 大量の同時操作に対応
4. **信頼性**: エラー時の自動リトライとデッドレターキュー

## エラーハンドリング

### 統一的なエラー処理

```typescript
// src/application/types/Result.ts
export interface Result<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

// UseCase での使用例
export class SomeUseCase {
  async execute(input: SomeInput): Promise<Result<SomeOutput>> {
    try {
      const result = await this.businessLogic(input);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('UseCase failed', error);
      return { 
        success: false, 
        errors: [error.message] 
      };
    }
  }
}
```

## Clean Architecture違反の回避

### 禁止事項

- Application層からInfrastructure層への直接参照
- Domain層からApplication層への参照
- 循環参照の作成

### 解決方法

- Portインターフェースを使用した抽象化
- Dependency Injectionによる依存関係の逆転
- イベント駆動アーキテクチャの活用（必要に応じて）

## アーキテクチャ利点

### Clean Architecture 実装
- 🔄 ドメインロジックの独立性
- 🧪 高いテスタビリティ（464テスト 100%合格）
- 🔧 変更の局所化
- 📈 拡張性とメンテナンス性
- 🛡️ Port/Adapterパターンによる技術詳細の抽象化

### 今後の拡張指針

#### 新機能追加時の手順

1. **Domain層**: エンティティの拡張またはドメインサービス追加
2. **Application層**: 新しいUseCaseの実装、必要に応じてPortインターフェース追加
3. **Infrastructure層**: 必要に応じてRepositoryやAdapterを拡張
4. **Presentation層**: UIコンポーネントとControllerを追加
5. **テスト**: 各レイヤーの単体テストと統合テストを追加

## パフォーマンス考慮事項

### Cloudflare Workers 制約

- **実行時間制限**: 最大30秒（通常は3秒以内）
- **メモリ制限**: 128MB
- **CPU制限**: 長時間実行処理は Queues に移譲

### 最適化戦略

```typescript
// バッチ処理での遅延制御
export class ProcessDeadlineRemindersUseCase {
  async execute(): Promise<void> {
    const batchSize = Number(this.env.getOptional('REMINDER_BATCH_SIZE')) || 10;
    const batchDelay = Number(this.env.getOptional('REMINDER_BATCH_DELAY')) || 100;

    for (let i = 0; i < reminders.length; i += batchSize) {
      const batch = reminders.slice(i, i + batchSize);
      await Promise.all(batch.map(r => this.processReminder(r)));
      
      if (i + batchSize < reminders.length) {
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }
  }
}
```

## セキュリティ

### 入力検証

```typescript
// Domain層での検証
export class Schedule {
  static create(data: ScheduleCreateData): Schedule {
    if (!data.title || data.title.length > 100) {
      throw new Error('Invalid title');
    }
    if (data.dates.length === 0 || data.dates.length > 10) {
      throw new Error('Invalid dates count');
    }
    // ...
  }
}

// Application層での検証
export class CreateScheduleUseCase {
  private validateInput(input: CreateScheduleInput): ValidatedInput {
    // サニタイゼーション
    const sanitized = {
      ...input,
      title: input.title.trim(),
      description: input.description?.trim()
    };
    
    // ビジネスルール検証
    if (sanitized.dates.some(d => new Date(d) < new Date())) {
      throw new Error('Past dates not allowed');
    }
    
    return sanitized;
  }
}
```

## ログ管理

### 構造化ログ

```typescript
// 推奨ログ形式
this.logger.info('Schedule created', {
  operation: 'create-schedule',
  scheduleId: schedule.id,
  guildId: schedule.guildId,
  userInput: {
    title: input.title,
    dateCount: input.dates.length
  },
  timestamp: new Date().toISOString()
});

this.logger.error('Database operation failed', error, {
  operation: 'save-schedule',
  scheduleId: schedule.id,
  retryCount: 3
});
```

## コード品質

### TypeScript strict mode
- エラー0件維持
- unknown vs any: 不明な型は `unknown` を使用
- 型ガードの活用

### Biome設定
- 自動フォーマットとリント
- 未使用インポートの自動削除
- 統一されたコードスタイル

### テスト戦略
- 464 テスト（100% 合格）
- 単体テスト: 各レイヤーにco-located
- 統合テスト: `/tests/integration/`
- テストヘルパー: `/tests/helpers/`

## まとめ

このプロジェクトのClean Architectureは以下の利点を提供します：

1. **テスタビリティ**: 各レイヤーを独立してテスト可能
2. **保守性**: ビジネスロジックと技術的詳細の分離
3. **拡張性**: 新機能追加時の影響範囲の最小化
4. **移植性**: Cloudflare Workers以外の環境への移植が容易
5. **チーム開発**: 明確な責務分離によるコード品質向上

これらの設計原則を遵守することで、長期的に保守可能で拡張しやすいシステムを維持できます。

## 参考資料

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Onion Architecture by Jeffrey Palermo](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/)
- [Ports and Adapters by Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Discord API Documentation](https://discord.com/developers/docs/)
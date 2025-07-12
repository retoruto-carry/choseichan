# Discord 調整ちゃん - 開発者オンボーディングガイド

## 📋 このドキュメントについて

新しい開発者やプロジェクト引き継ぎ時に、システム全体の構造と各層の役割を理解するためのガイドです。

## 🧱 全体アーキテクチャ概観

```
                    ┌─────────────────────────┐
                    │   🎮 presentation       │ ← Discord UI / Command 層
                    │   (controllers, builders) │
                    └─────────────────────────┘
                                 ↓ 依存
                    ┌─────────────────────────┐
                    │   📋 application        │ ← ユースケース、ポート定義
                    │   (usecases, ports)     │
                    └─────────────────────────┘
                                 ↓ 依存
                    ┌─────────────────────────┐
                    │   🏢 domain             │ ← ビジネスロジック
                    │   (entities, services)  │
                    └─────────────────────────┘
                                 ↑ 実装
                    ┌─────────────────────────┐
                    │   🔧 infrastructure     │ ← 外部技術実装
                    │   (adapters, repos)     │
                    └─────────────────────────┘
```

### 🎯 Clean Architecture の核心原則

1. **依存方向**: 外側から内側への一方向のみ
2. **抽象化**: インフラは抽象（Port）に依存、詳細（Adapter）は分離
3. **テスタビリティ**: 各層を独立してテスト可能
4. **ビジネスロジック保護**: Domain層は外部技術に依存しない

## 📁 ディレクトリ構造詳細解説

### 🎮 src/presentation/ - プレゼンテーション層

**役割**: Discord からの入力を受け取り、ユーザーに結果を表示する

```
src/presentation/
├── controllers/           # Discord インタラクション処理
│   ├── VoteController.ts          # 投票処理のエントリーポイント
│   ├── CommandController.ts       # スラッシュコマンド処理
│   ├── ModalController.ts         # モーダル送信処理
│   └── ButtonInteractionController.ts  # ボタンクリック処理
├── builders/              # Discord UI 構築専用
│   ├── ScheduleUIBuilder.ts       # スケジュール表示UI
│   ├── VoteUIBuilder.ts          # 投票UI構築
│   ├── ResponseUIBuilder.ts      # 回答表示UI
│   └── CommandUIBuilder.ts       # コマンドヘルプUI
├── constants/             # UI関連定数
└── utils/                 # Discord API ヘルパー
```

**実装パターン**:
```typescript
// VoteController.ts の例
export class VoteController {
  constructor(
    private voteUseCase: VoteUseCase,      // ← application層に依存
    private logger: ILogger,               // ← Portインターフェース使用
    private discordApi: IDiscordApiPort    // ← Portインターフェース使用
  ) {}

  async handleVote(interaction: ComponentInteraction): Promise<Response> {
    // 1. 入力検証・パース
    const voteData = this.parseVoteInteraction(interaction);
    
    // 2. ユースケース実行
    const result = await this.voteUseCase.execute(voteData);
    
    // 3. UI構築・レスポンス
    return this.buildResponse(result);
  }
}
```

### 📋 src/application/ - アプリケーション層

**役割**: ビジネス要件を満たすユースケースの実装、外部依存の抽象化

```
src/application/
├── usecases/              # ビジネス要件単位の処理
│   ├── schedule/          # スケジュール関連ユースケース
│   │   ├── CreateScheduleUseCase.ts   # スケジュール作成
│   │   ├── CloseScheduleUseCase.ts    # スケジュール締切
│   │   └── GetScheduleSummaryUseCase.ts # 集計取得
│   ├── response/          # 回答関連ユースケース
│   │   ├── SubmitResponseUseCase.ts   # 回答送信
│   │   └── UpdateResponseUseCase.ts   # 回答更新
│   └── message/           # メッセージ更新ユースケース
├── ports/                 # 外部依存の抽象化（重要！）
│   ├── DiscordApiPort.ts         # Discord API抽象化
│   ├── LoggerPort.ts             # ログ出力抽象化
│   ├── EnvironmentPort.ts        # 環境変数抽象化
│   └── MessageFormatterPort.ts   # メッセージ整形抽象化
├── services/              # アプリケーションサービス
├── dto/                   # データ転送オブジェクト
├── mappers/               # Domain ↔ DTO 変換
└── types/                 # Application層型定義
```

**実装パターン**:
```typescript
// CreateScheduleUseCase.ts の例
export class CreateScheduleUseCase {
  constructor(
    private scheduleRepo: IScheduleRepository,  // ← Domain層のinterface
    private responseRepo: IResponseRepository,  // ← Domain層のinterface
    private logger: ILogger                     // ← Port interface
  ) {}

  async execute(input: CreateScheduleInput): Promise<CreateScheduleResult> {
    // 1. ドメインオブジェクト生成
    const schedule = Schedule.create(input);
    
    // 2. ビジネスルール検証
    await this.validateScheduleCreation(schedule);
    
    // 3. 永続化
    await this.scheduleRepo.save(schedule);
    
    // 4. DTO変換して返却
    return {
      success: true,
      schedule: ScheduleMapper.scheduleToDto(schedule)
    };
  }
}
```

### 🏢 src/domain/ - ドメイン層

**役割**: ビジネスルールと不変条件の定義、外部技術に依存しない核心ロジック

```
src/domain/
├── entities/              # ドメインエンティティ
│   ├── Schedule.ts               # スケジュールエンティティ
│   ├── Response.ts               # 回答エンティティ
│   ├── ScheduleDate.ts           # 日程候補
│   ├── ResponseStatus.ts         # 回答状態（○△×）
│   └── User.ts                   # ユーザー
├── services/              # ドメインサービス
│   ├── ScheduleDomainService.ts  # スケジュール集約ルール
│   ├── ResponseDomainService.ts  # 回答集約ルール
│   └── MessageUpdateService.ts   # メッセージ更新ルール
├── repositories/          # リポジトリ抽象化
│   └── interfaces.ts             # IScheduleRepository等
├── errors/                # ドメイン固有エラー
└── types/                 # ドメイン型定義
```

**実装パターン**:
```typescript
// Schedule.ts エンティティの例
export class Schedule {
  private constructor(
    private readonly _id: string,
    private readonly _title: string,
    private readonly _dates: ScheduleDate[],
    private readonly _deadline?: Date
  ) {}

  // ファクトリーメソッド
  static create(data: ScheduleCreateData): Schedule {
    // ビジネスルール検証
    if (!data.title || data.title.length > 100) {
      throw new DomainError('Invalid title');
    }
    if (data.dates.length === 0 || data.dates.length > 10) {
      throw new DomainError('Invalid dates count');
    }
    
    return new Schedule(data.id, data.title, data.dates, data.deadline);
  }

  // ビジネスロジック
  canBeClosed(currentDate: Date = new Date()): boolean {
    if (!this._deadline) return true;
    return currentDate > this._deadline;
  }

  // 不変条件を保った更新
  updateDeadline(newDeadline: Date): Schedule {
    if (newDeadline <= new Date()) {
      throw new DomainError('Deadline must be in the future');
    }
    
    return new Schedule(this._id, this._title, this._dates, newDeadline);
  }

  // ゲッター（不変性保証）
  get id(): string { return this._id; }
  get title(): string { return this._title; }
  get dates(): ReadonlyArray<ScheduleDate> { return this._dates; }
}
```

### 🔧 src/infrastructure/ - インフラストラクチャ層

**役割**: 外部技術との接続、Portインターフェースの具体実装

```
src/infrastructure/
├── adapters/              # Port実装（重要！）
│   ├── DiscordApiAdapter.ts      # Discord API実装
│   ├── LoggerAdapter.ts          # ログ出力実装
│   ├── EnvironmentAdapter.ts     # 環境変数実装
│   ├── CloudflareQueueAdapter.ts # Queue実装
│   └── RateLimiterAdapter.ts     # レート制限実装
├── repositories/          # データアクセス実装
│   └── d1/                       # D1データベース実装
│       ├── schedule-repository.ts
│       ├── response-repository.ts
│       └── factory.ts
├── factories/             # 依存性注入
│   ├── DependencyContainer.ts    # DIコンテナ
│   └── factory.ts
├── services/              # インフラサービス
│   ├── DiscordApiService.ts      # Discord API通信
│   ├── ValidationService.ts     # 入力検証
│   └── RateLimitService.ts       # レート制限
├── formatters/            # メッセージ整形
├── utils/                 # インフラユーティリティ
└── types/                 # インフラ型定義
```

**実装パターン**:
```typescript
// DiscordApiAdapter.ts の例
export class DiscordApiAdapter implements IDiscordApiPort {
  private discordApiService = new DiscordApiService();

  async updateMessage(
    channelId: string, 
    messageId: string, 
    content: object, 
    token: string
  ): Promise<void> {
    // 具体的なDiscord API呼び出し
    await this.discordApiService.updateMessage(channelId, messageId, content, token);
  }

  async sendMessage(
    channelId: string, 
    content: object, 
    token: string
  ): Promise<{ id: string }> {
    return await this.discordApiService.sendMessage(channelId, content, token);
  }
}

// D1ScheduleRepository.ts の例
export class D1ScheduleRepository implements IScheduleRepository {
  constructor(private db: D1Database) {}

  async save(schedule: Schedule): Promise<void> {
    // ドメインオブジェクト → DB用データ変換
    const data = ScheduleMapper.domainToData(schedule);
    
    // D1トランザクション実行
    await this.db.batch([
      this.db.prepare(INSERT_SCHEDULE_SQL).bind(...data.schedule),
      ...data.dates.map(d => 
        this.db.prepare(INSERT_DATE_SQL).bind(...d)
      )
    ]);
  }
}
```

## 🔄 典型的な処理フロー

### 例: スケジュール作成の流れ

```
1. Discord Command Input
   ↓
2. CommandController.handleCreateCommand()
   ↓
3. CreateScheduleUseCase.execute()
   ↓
4. Schedule.create() (Domain Entity)
   ↓
5. D1ScheduleRepository.save() (Infrastructure)
   ↓
6. ScheduleUIBuilder.buildCreatedSchedule() (Presentation)
   ↓
7. Discord Response
```

### コード例:

```typescript
// 1. Presentation層 - CommandController
async handleCreateCommand(interaction: CommandInteraction): Promise<Response> {
  const input = this.parseCreateInput(interaction);
  
  // 2. Application層呼び出し
  const result = await this.createScheduleUseCase.execute(input);
  
  if (!result.success) {
    return ErrorResponseFactory.createError(result.errors);
  }
  
  // 3. UI構築
  const embed = this.scheduleUIBuilder.buildCreatedSchedule(result.schedule);
  return new Response(JSON.stringify({ embeds: [embed] }));
}

// 2. Application層 - CreateScheduleUseCase
async execute(input: CreateScheduleInput): Promise<CreateScheduleResult> {
  try {
    // 3. Domain層でビジネスルール適用
    const schedule = Schedule.create({
      id: generateId(),
      title: input.title,
      dates: input.dates.map(d => ScheduleDate.create(d.id, d.datetime)),
      guildId: input.guildId,
      channelId: input.channelId,
      createdBy: User.create(input.userId, input.username)
    });
    
    // 4. Infrastructure層で永続化
    await this.scheduleRepository.save(schedule);
    
    this.logger.info('Schedule created successfully', {
      scheduleId: schedule.id,
      guildId: schedule.guildId
    });
    
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
```

## 🧪 テスト戦略

### 単体テスト（各層独立）

```typescript
// Domain層テスト例
describe('Schedule Entity', () => {
  it('should not allow empty title', () => {
    expect(() => Schedule.create({ title: '', dates: [...] }))
      .toThrow('Invalid title');
  });
  
  it('should allow closing after deadline', () => {
    const schedule = Schedule.create({ deadline: new Date('2024-01-01') });
    expect(schedule.canBeClosed(new Date('2024-01-02'))).toBe(true);
  });
});

// Application層テスト例（モック使用）
describe('CreateScheduleUseCase', () => {
  it('should create schedule successfully', async () => {
    const mockRepo = { save: vi.fn() };
    const mockLogger = { info: vi.fn(), error: vi.fn() };
    
    const useCase = new CreateScheduleUseCase(mockRepo, mockLogger);
    const result = await useCase.execute(validInput);
    
    expect(result.success).toBe(true);
    expect(mockRepo.save).toHaveBeenCalledWith(expect.any(Schedule));
  });
});
```

### 統合テスト

```typescript
describe('Schedule Creation Integration', () => {
  let container: DependencyContainer;
  
  beforeEach(() => {
    container = new DependencyContainer();
    container.setDatabase(createTestDatabase());
  });
  
  it('should create and persist schedule end-to-end', async () => {
    const controller = container.getCommandController();
    const response = await controller.handleCreateCommand(mockInteraction);
    
    expect(response.status).toBe(200);
    
    // データベース確認
    const saved = await container.getScheduleRepository()
      .findById(scheduleId, guildId);
    expect(saved).toBeDefined();
  });
});
```

## 🔧 依存性注入（DI）システム

### DependencyContainer の使用

```typescript
// src/infrastructure/factories/DependencyContainer.ts
export class DependencyContainer {
  static getInstance(): DependencyContainer { /* ... */ }
  
  // Port/Adapter パターンでの依存解決
  createCommandController(env: Env): CommandController {
    // リポジトリ取得
    const scheduleRepo = this.getScheduleRepository(env);
    const responseRepo = this.getResponseRepository(env);
    
    // Port実装（Adapter）を注入
    const logger = new LoggerAdapter();
    const discordApi = new DiscordApiAdapter();
    const environment = new EnvironmentAdapter(env);
    
    // ユースケース組み立て
    const createUseCase = new CreateScheduleUseCase(
      scheduleRepo, responseRepo, logger
    );
    
    // UIビルダー
    const uiBuilder = new ScheduleUIBuilder();
    
    return new CommandController(
      createUseCase, 
      logger, 
      discordApi, 
      uiBuilder
    );
  }
}
```

## 🚨 よくある間違いと対処法

### ❌ Clean Architecture違反パターン

```typescript
// 悪い例: Application層からInfrastructure層への直接依存
import { DiscordApiService } from '../../infrastructure/services/DiscordApiService';

export class SomeUseCase {
  constructor(
    private discordApi: DiscordApiService  // ← 違反！
  ) {}
}

// 良い例: Portインターフェース経由
import type { IDiscordApiPort } from '../ports/DiscordApiPort';

export class SomeUseCase {
  constructor(
    private discordApi: IDiscordApiPort  // ← 正しい！
  ) {}
}
```

### ❌ ドメインロジックの漏洩

```typescript
// 悪い例: ビジネスロジックがController層に
export class VoteController {
  async handleVote(interaction: ComponentInteraction) {
    // ビジネスルールがここに書かれている ← 違反！
    if (vote.status === 'ok' && schedule.deadline < new Date()) {
      throw new Error('Cannot vote after deadline');
    }
  }
}

// 良い例: ビジネスルールはDomain層に
export class Schedule {
  acceptVote(vote: Vote): void {
    if (this.isExpired()) {  // ← ビジネスルールはここに
      throw new DomainError('Cannot vote after deadline');
    }
  }
}
```

## 🎯 開発時のチェックリスト

### 新機能追加時

- [ ] Domain層: エンティティまたはドメインサービスに適切にビジネスルールを配置
- [ ] Application層: 必要に応じてPortインターフェース定義、ユースケース実装
- [ ] Infrastructure層: 新しい外部依存がある場合はAdapterで実装
- [ ] Presentation層: UIロジックのみに集中、ビジネスロジックは含めない
- [ ] テスト: 各層の単体テスト、必要に応じて統合テストを追加

### コードレビュー時の観点

- [ ] 依存方向が正しいか（外→内の一方向）
- [ ] Portインターフェースを通じた抽象化ができているか
- [ ] ビジネスロジックがDomain層に適切に配置されているか
- [ ] テストで各層が独立して検証できているか

## 📚 参考資料

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Ports and Adapters by Alistair Cockburn](https://alistair.cockburn.us/hexagonal-architecture/)
- [プロジェクトの詳細設計書: ARCHITECTURE.md](../ARCHITECTURE.md)
- [開発者向けガイド: CLAUDE.md](../CLAUDE.md)

---

このガイドを理解したら、実際にコードを読みながら各層の責務と実装パターンを確認してみてください。不明な点があれば、各ファイルのテストコードも参考になります。
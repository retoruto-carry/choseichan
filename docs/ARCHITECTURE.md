# アーキテクチャドキュメント

## 概要

Discord 調整ちゃんは、Cloudflare Workers 上で動作するサーバーレス Discord ボットです。日程調整機能を提供し、調整さんのようなサービスを Discord 内で完結させます。

## 技術スタック

- **ランタイム**: Cloudflare Workers
- **言語**: TypeScript
- **データストア**: Cloudflare KV
- **Discord API**: discord-interactions library
- **テストフレームワーク**: Vitest
- **デプロイツール**: Wrangler

## アーキテクチャ概要

```
┌─────────────┐    HTTPS/JSON    ┌──────────────────┐
│   Discord   │─────────────────>│ Cloudflare       │
│   Server    │                  │ Workers          │
└─────────────┘                  └────────┬─────────┘
                                          │
                                          ├──> ┌─────────────┐
                                          │    │ Handlers    │
                                          │    └─────────────┘
                                          │
                                          ├──> ┌─────────────┐
                                          │    │ Services    │
                                          │    └─────────────┘
                                          │
                                          └──> ┌─────────────┐
                                               │ KV Storage  │
                                               └─────────────┘
```

## コンポーネント詳細

### 1. エントリーポイント (`src/index.ts`)

- Discord Webhook リクエストの受信
- リクエスト検証 (Ed25519 署名)
- 適切なハンドラーへのルーティング

### 2. ハンドラー層 (`src/handlers/`)

#### メインハンドラー

- **commands.ts**: スラッシュコマンド処理
- **buttons.ts**: ボタンインタラクション処理（ルーティングのみ）
- **select-menu.ts**: セレクトメニューインタラクション処理

#### モーダルハンドラー (`src/handlers/modals/`)

- **index.ts**: モーダルサブミットのルーティング
- **create-schedule.ts**: スケジュール作成モーダル
- **response.ts**: 回答モーダル（インタラクティブ、一括）
- **edit.ts**: 編集モーダル（タイトル、日程、締切）
- **comment.ts**: コメントモーダル

#### 機能別ハンドラー

- **vote-handlers.ts**: 投票関連（respond, response, vote）
- **schedule-handlers.ts**: スケジュール管理（edit, close, reopen, delete, status, details）
- **edit-handlers.ts**: 編集機能（edit_info, update_dates, add_dates, remove_dates, edit_deadline）
- **export-handlers.ts**: エクスポート機能（export, show_all）
- **comment-handlers.ts**: コメント機能（add_comment, comment）
- **quick-vote-handlers.ts**: ダイレクト投票機能（direct_vote）

### 3. サービス層 (`src/services/`)

- **StorageService**: KV ストレージとのインターフェース
  - スケジュールの保存・取得・削除
  - 回答の保存・取得・集計
  - チャンネル別インデックス管理

### 4. ユーティリティ層 (`src/utils/`)

- **embeds.ts**: Discord Embed 作成ヘルパー
- **date.ts**: 日付パース・フォーマット処理
- **discord.ts**: Discord API 呼び出し（メッセージ更新など）
- **id.ts**: ID 生成・パース処理
- **responses.ts**: レスポンス作成ヘルパー

### 5. 型定義 (`src/types/`)

- **discord.ts**: Discord API 関連の型定義
- **schedule.ts**: アプリケーション固有の型定義

## データモデル

### Schedule (日程調整)

```typescript
{
  id: string;              // 一意識別子
  title: string;           // タイトル
  description?: string;    // 説明
  dates: ScheduleDate[];   // 日程候補リスト
  createdBy: User;         // 作成者
  channelId: string;       // Discordチャンネル
  createdAt: Date;         // 作成日時
  updatedAt: Date;         // 更新日時
  deadline?: Date;         // 締切日時
  status: 'open' | 'closed'; // 状態
}
```

### Response (回答)

```typescript
{
  scheduleId: string;      // 対象日程調整ID
  userId: string;          // DiscordユーザーID
  userName: string;        // ユーザー名
  responses: DateResponse[]; // 各日程への回答
  comment: string;         // 全体コメント
  updatedAt: Date;         // 更新日時
}
```

## データストレージ設計

### なぜ D1 ではなく KV を選択したか

1. **シンプルなデータ構造**
   - 日程調整と回答は基本的にキーバリュー形式で十分
   - 複雑なJOINやトランザクションが不要
   - JSON形式での保存で要件を満たせる

2. **パフォーマンス**
   - KVは読み取りが非常に高速（グローバルに分散）
   - Discord botは読み取りが多く、書き込みは比較的少ない
   - 3秒のタイムアウト制限に対してKVの方が有利

3. **スケーラビリティ**
   - KVは自動的にグローバルに分散
   - 容量制限が実質的にない（1GBまで無料、それ以降も安価）
   - プレフィックススキャンで簡単なクエリが可能

4. **永続性**
   - KVは永続的なストレージ（データは削除するまで保持される）
   - 自動的なレプリケーションとバックアップ
   - TTL（Time To Live）設定も可能だが、デフォルトは無期限保存

5. **開発の簡易性**
   - スキーマ管理やマイグレーションが不要
   - 型安全性はTypeScriptで担保
   - デプロイが簡単

### KV ストレージ設計

#### キー設計（マルチテナント対応）

- スケジュール: `guild:{guildId}:schedule:{scheduleId}`
- 回答: `guild:{guildId}:response:{scheduleId}:{userId}`
- チャンネルインデックス: `guild:{guildId}:channel:{channelId}:{scheduleId}`
- 締切インデックス: `deadline:{timestamp}:{guildId}:{scheduleId}`

#### インデックス戦略

- ギルド別のデータ分離（マルチテナント対応）
- チャンネル別のスケジュール一覧取得のためのプレフィックススキャン
- 日程調整別の回答一覧取得のためのプレフィックススキャン
- 締切時刻別のスケジュール取得（リマインダー用）

### 将来的な D1 移行の可能性

以下の場合は D1 への移行を検討：
- 複雑な集計クエリが必要になった場合
- トランザクション処理が必要になった場合
- リレーショナルなデータ構造が必要になった場合

## インタラクションフロー

### 1. 日程調整作成

```
User -> /schedule create -> Modal表示
    -> Modal入力 -> Schedule作成
    -> KV保存 -> Embed付きメッセージ送信
```

### 2. 投票フロー

```
User -> ボタンクリック -> 投票ハンドラー
    -> Response保存/更新 -> メイン画面更新
    -> 確認メッセージ送信（エフェメラル）
```

### 3. 日程更新フロー

```
User -> 編集ボタン -> Modal表示
    -> 日程入力 -> 同一テキスト判定
    -> ID保持/新規作成 -> 既存回答の移行
    -> KV更新 -> メイン画面更新
```

## パフォーマンス最適化

### 1. Cloudflare Workers 3 秒制限への対応

- モーダル処理での DEFERRED_UPDATE_MESSAGE 使用
- 重い処理の分割・非同期化
- 不要なメッセージ更新のスキップ

### 2. KV 操作の最適化

- バッチ処理の活用
- 必要最小限のデータ取得
- プレフィックススキャンの効率化

### 3. Discord API 制限への対応

- レート制限を考慮した更新処理
- エフェメラルメッセージの活用
- コンポーネント数の制限（最大 5 行、各行最大 5 要素）

## セキュリティ

### 1. リクエスト検証

- Ed25519 署名によるリクエスト検証
- Discord からの正当なリクエストのみ処理

### 2. 権限管理

- 作成者のみが編集・削除可能
- ユーザー ID ベースの回答管理

### 3. データ保護

- KV ストレージの適切なスコープ設定
- センシティブ情報の非表示化

## エラーハンドリング

### 1. グレースフルデグレード

- 存在しないスケジュールへのアクセス時の適切なメッセージ
- 締切済みスケジュールへの回答時の通知

### 2. タイムアウト対策

- 3 秒制限内での処理完了
- 重い処理の分割実行

### 3. ユーザーフィードバック

- エラー時の分かりやすいメッセージ
- 操作結果の明確な通知

## 今後の拡張性

### 1. 機能拡張の容易性

- ハンドラーの分離による機能追加の簡易化
- 型定義による安全な拡張

### 2. スケーラビリティ

- Cloudflare Workers の自動スケーリング
- KV ストレージの分散設計

### 3. 国際化対応

- メッセージの外部化準備
- 日付フォーマットの柔軟性

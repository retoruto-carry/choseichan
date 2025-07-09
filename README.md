# Discord 調整ちゃん

Discord 上で簡単に日程調整ができるボット。調整さんのような機能を Discord 内で完結させます。

## 特徴

- 🎯 **シンプルな操作**: ボタンをクリックするだけで参加意思を表明
- 📊 **リアルタイム集計**: 回答が即座に反映される
- 🌟 **最適日程の自動判定**: 最も多くの人が参加できる日程を自動でハイライト
- 📝 **柔軟な回答**: ○△× の 3 段階で回答
- 🔄 **回答の変更**: 何度でも回答を変更できる
- ✏️ **編集機能**: 作成後も日程やタイトルを編集可能
- 🔒 **締切機能**: 指定日時で自動締切も設定可能

## セットアップ

### 1. Discord Application の作成

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. "New Application" をクリックして新しいアプリケーションを作成
3. "Bot" セクションで Bot を作成し、トークンをコピー
4. "OAuth2" > "URL Generator" で以下の設定:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`
5. 生成された URL でボットをサーバーに招待

### 2. 環境変数の設定

`.env.example` を `.env` にコピーして、以下の値を設定:

```env
DISCORD_APPLICATION_ID=your_application_id
DISCORD_PUBLIC_KEY=your_public_key
DISCORD_TOKEN=your_bot_token
```

### 3. Cloudflare Workers のセットアップ

```bash
# Cloudflare アカウントにログイン
wrangler login

# KV Namespace の作成
wrangler kv:namespace create "SCHEDULES"
wrangler kv:namespace create "RESPONSES"

# wrangler.toml の KV binding ID を更新
```

### 4. デプロイ

```bash
# 開発環境で実行
npm run dev

# 本番環境にデプロイ
npm run deploy
```

### 5. Discord Commands の登録

```bash
# register-commands.js を実行
node scripts/register-commands.js
```

## 使い方

### 基本コマンド

#### 日程調整を作成

```
/choseichan create
```

モーダルが開き、以下を入力できます：

- タイトル
- 説明（任意）
- 日程候補（改行区切り）
- 締切日時（任意）

#### 日程調整一覧を表示

```
/choseichan list
```

#### ヘルプを表示

```
/choseichan help
```

### 回答方法

「回答する」ボタンをクリックして、ドロップダウンから各日程の参加可否を選択します。

- ○：参加可能
- △：未定・条件付き
- ×：参加不可
- 未回答：回答を削除

### 集計結果の確認

「詳細」ボタンをクリックすると、詳細な集計結果がメインメッセージに表示されます。

### 管理機能

作成者は「編集」ボタンから以下の操作が可能:

- 📝 **タイトル・説明を編集**: タイトルや説明文を変更
- 📅 **日程を一括更新**: 日程候補を変更
- ⏰ **締切日を編集**: 締切日時を設定・変更・削除
- 🔒 **締め切る**: 回答の受付を締め切る
- 🔓 **再開する**: 締め切った調整を再開
- 🗑️ **削除する**: 日程調整を完全に削除

## ドキュメント

- [アーキテクチャ](./docs/ARCHITECTURE.md) - システム構成と技術スタック
- [デザイン](./docs/DESIGN.md) - UI/UX 設計とユーザーフロー
- [デプロイ](./docs/DEPLOY.md) - Cloudflare Workers へのデプロイ手順
- [Discord API 制限](./docs/DISCORD_API_LIMITS.md) - Discord API の仕様と制限事項
- [変更履歴](./docs/CHANGELOG.md) - リリースノートと変更内容
- [貢献ガイド](./docs/CONTRIBUTING.md) - 開発に参加する際のガイドライン

## 開発

### 必要な環境

- Node.js 18+
- npm or yarn
- Cloudflare アカウント

### 開発コマンド

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# テストの実行
npm test

# 型チェック
npm run typecheck

# デプロイ
npm run deploy
```

### プロジェクト構成

```
src/
├── handlers/       # コマンドやインタラクションのハンドラー
│   ├── buttons.ts  # ボタンインタラクションのメインハンドラー
│   ├── commands.ts # スラッシュコマンドハンドラー
│   ├── modals.ts   # モーダルサブミットハンドラー
│   └── *-handlers.ts # 機能別ハンドラー
├── services/       # ビジネスロジック
│   └── storage.ts  # KVストレージサービス
├── types/          # TypeScript型定義
│   ├── discord.ts  # Discord API型定義
│   └── schedule.ts # スケジュール関連型定義
├── utils/          # ユーティリティ関数
│   ├── embeds.ts   # Discord Embed作成
│   ├── date.ts     # 日付処理
│   └── discord.ts  # Discord API呼び出し
├── middleware/     # ミドルウェア
│   └── verify.ts   # リクエスト検証
└── index.ts        # エントリーポイント

tests/              # テストファイル
scripts/            # ユーティリティスクリプト
└── register-commands.js # コマンド登録スクリプト
```

## ライセンス

非 OSS ライセンス（Custom License - Non-OSS）

このリポジトリは非 OSS（オープンソースソフトウェア）として公開されています。

詳細は [LICENSE](./LICENSE) ファイルをご確認ください。

## お問い合わせ

バグ報告や機能要望は Issues へお願いします。

# Discord ちょうせいくん

Discord上で簡単に日程調整ができるボット。調整さんのような機能をDiscord内で完結させます。

## 特徴

- 🎯 **シンプルな操作**: ボタンをクリックするだけで参加意思を表明
- 📊 **リアルタイム集計**: 回答が即座に反映される
- 🌟 **最適日程の自動判定**: 最も多くの人が参加できる日程を自動でハイライト
- 📝 **柔軟な回答**: ○△×の3段階で回答、コメントも追加可能
- 🔄 **回答の変更**: 何度でも回答を変更できる
- 📤 **CSV出力**: 集計結果をCSV形式でエクスポート

## セットアップ

### 1. Discord Application の作成

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. "New Application" をクリックして新しいアプリケーションを作成
3. "Bot" セクションで Bot を作成し、トークンをコピー
4. "OAuth2" > "URL Generator" で以下の設定:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`
5. 生成されたURLでボットをサーバーに招待

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
/schedule create title:"懇親会" date1:"12/25 19:00" date2:"12/26 18:00"
```

#### 日程調整一覧を表示
```
/schedule list
```

#### 集計結果を確認
```
/schedule status id:"調整ID"
```

#### 日程調整を締切
```
/schedule close id:"調整ID"
```

#### ヘルプを表示
```
/help
```

### 回答方法

1. 作成された日程調整メッセージの各日程ボタンをクリック
2. モーダルで以下を入力:
   - 参加可否: ○（参加可能）、△（未定）、×（参加不可）
   - コメント（任意）

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
├── services/       # ビジネスロジック
├── types/          # TypeScript型定義
├── utils/          # ユーティリティ関数
├── middleware/     # ミドルウェア
└── index.ts        # エントリーポイント

tests/              # テストファイル
```

## ライセンス

MIT

## 貢献

プルリクエストを歓迎します！バグ報告や機能要望は Issues へお願いします。
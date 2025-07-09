# Discord 調整ちゃん

Discordサーバーで簡単に日程調整ができるBot。外部サイト不要で、Discord内で完結します。

## 機能

- 📅 簡単な日程作成
- 🗳️ ボタンで簡単回答（○△×）
- 📊 リアルタイム集計
- ⏰ 締切設定と自動通知
- 💬 コメント機能
- 📥 CSV出力
- 🌍 マルチテナント対応（複数サーバーで利用可能）

## セットアップ

### 1. ボットの追加

[こちらのリンク](https://discord.com/api/oauth2/authorize?client_id=1392384546560802947&permissions=2147485696&scope=bot%20applications.commands)からDiscordサーバーにボットを追加してください。

### 2. 使い方

1. `/choseichan create` - 新しい日程調整を作成
2. `/choseichan list` - 現在のチャンネルの日程調整一覧を表示
3. `/choseichan help` - ヘルプを表示

## 開発者向け

### 必要な環境

- Node.js 18+
- Cloudflare Workers アカウント
- Discord Developer アカウント

### インストール

```bash
npm install
```

### 環境変数

`.env.example` をコピーして `.env` を作成し、必要な値を設定してください。

```bash
cp .env.example .env
```

### 開発

```bash
npm run dev
```

### テスト

```bash
npm test
```

### デプロイ

```bash
npm run deploy
```

### Cloudflare Pages（ランディングページ）

```bash
# pages/ ディレクトリをCloudflare Pagesにデプロイ
```

## アーキテクチャ

- **Runtime**: Cloudflare Workers
- **Storage**: Cloudflare KV
- **Framework**: Hono
- **Language**: TypeScript

詳細は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照してください。

## マイグレーション

既存の単一テナント版からマルチテナント版への移行については、[docs/MIGRATION.md](docs/MIGRATION.md) を参照してください。

## ライセンス

MIT
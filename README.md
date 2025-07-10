# Discord 調整ちゃん

Discordサーバーで簡単に日程調整ができるBot。外部サイト不要で、Discord内で完結します。

## 機能

- 📅 簡単な日程作成
- 🗳️ ボタンで簡単回答（○△×）
- 📊 リアルタイム集計
- ⏰ 締切設定と自動通知
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
- **Storage**: Cloudflare D1 (SQLite) / KV (移行中)
- **Framework**: Hono
- **Language**: TypeScript

詳細は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照してください。

## スケーラビリティ

### Cloudflare 無料プラン
- **アクティブユーザー**: 200-300人/日
- **新規スケジュール**: 100-150個/日  
- **投票操作**: 300-500回/日
- **制限要因**: KV書き込み (1,000回/日)

### Cloudflare 有料プラン ($5/月)
- **アクティブユーザー**: 10,000-15,000人/日
- **新規スケジュール**: 5,000-8,000個/日
- **投票操作**: 20,000-50,000回/日
- **制限要因**: Discord API制限（自動削除機能によりストレージ容量問題は解決済み）

### 主なボトルネック
1. **無料プラン**: KV書き込み制限 (1,000回/日)
2. **有料プラン**: Discord Webhook制限 (30リクエスト/分)
3. **長期運用**: 自動削除（TTL）機能により容量問題は解決済み

詳細な分析は [docs/SCALABILITY.md](docs/SCALABILITY.md) を参照してください。

## ライセンス

非OSSライセンス（詳細は[LICENSE](LICENSE)を参照）
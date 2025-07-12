# Discord 調整ちゃん

Discord サーバー内で簡単に日程調整ができるボットです。調整さんライクな機能を Discord 内で完結させることができます。

## ✨ 特徴

- 📝 **シンプルな日程調整作成** - モーダルフォームで直感的に作成
- 🗳️ **○△× の 3 段階評価** - わかりやすい回答システム
- 📊 **リアルタイム集計** - 回答状況を即座に反映
- ⏰ **自動リマインダー** - 締切前に自動でお知らせ
- 🔒 **プライバシー重視** - 回答者の情報は最小限に
- 🚀 **高速レスポンス** - Cloudflare Workers で世界中から高速アクセス

## セットアップ

### 🤖 ボットの追加

[こちらのリンク](https://discord.com/api/oauth2/authorize?client_id=1392384546560802947&permissions=2147485696&scope=bot%20applications.commands)からDiscordサーバーにボットを追加してください。

### 📋 使い方

#### コマンド

- `/chouseichan create` - 新しい日程調整を作成

#### 日程調整の流れ

1. `/chouseichan create` コマンドを実行
2. フォームに以下を入力:
   - タイトル（必須）
   - 説明（任意）
   - 日程候補（改行区切り）
   - 締切日時（任意）
3. 作成されたメッセージの「回答する」ボタンから投票
4. 「状況を見る」ボタンで集計結果を確認

## 🚀 デプロイ方法

### 必要なもの

- [Node.js](https://nodejs.org/) (v18 以上)
- [Cloudflare アカウント](https://dash.cloudflare.com/sign-up)
- [Discord アプリケーション](https://discord.com/developers/applications)

### セットアップ手順

1. リポジトリをクローン
```bash
git clone https://github.com/retca/discord-choseisan.git
cd discord-choseisan
```

2. 依存関係をインストール
```bash
npm install
```

3. 環境変数を設定

環境変数とDiscordアプリケーションの設定が必要です：

```bash
# Discordアプリケーションの設定（wrangler secret使用）
wrangler secret put DISCORD_APPLICATION_ID
wrangler secret put DISCORD_PUBLIC_KEY  
wrangler secret put DISCORD_TOKEN
```

4. wrangler.toml の設定

`wrangler.toml` ファイルを編集してD1データベース設定を更新：

```toml
name = "discord-choseisan"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[[d1_databases]]
binding = "DB"
database_name = "discord-choseisan-db"
database_id = "YOUR_DATABASE_ID_HERE"  # 次のステップで作成されるIDを設定
migrations_dir = "migrations"
migrations_table = "d1_migrations"
```

5. D1 データベースを作成
```bash
wrangler d1 create discord-choseisan-db
# 出力されるdatabase_idをwrangler.tomlに設定してください
```

6. マイグレーションを実行
```bash
# 新しいマイグレーションコマンドを使用（本番環境）
npm run db:migrate:remote

# または手動で実行
wrangler d1 migrations apply discord-choseisan-db
```

7. Cloudflare Queuesを作成（推奨：非同期処理の最適化）
```bash
# メッセージ更新用のQueueを作成
wrangler queues create message-update-queue
wrangler queues create message-update-dlq

# 締切リマインダー用のQueueを作成
wrangler queues create deadline-reminder-queue
wrangler queues create deadline-reminder-dlq
```

詳細な設定方法は [docs/QUEUES_DEPLOYMENT.md](docs/QUEUES_DEPLOYMENT.md) を参照してください。

8. デプロイ
```bash
npm run deploy
```

9. Discord コマンドを登録
```bash
npm run register
```

詳細なセットアップガイドは [docs/DEPLOY.md](docs/DEPLOY.md) を参照してください。

## 🗄️ データベース管理

### マイグレーション管理

```bash
# 新しいマイグレーションファイルを作成
npm run db:migrate:create

# 本番環境（リモート）にマイグレーションを適用
npm run db:migrate:remote

# ローカル環境にマイグレーションを適用
npm run db:migrate:local

# 未適用のマイグレーションを確認
npm run db:migrate:list

# マイグレーション状態を確認
npm run db:status

# データベースシェルでクエリを実行
npm run db:shell -- --command="SELECT COUNT(*) FROM schedules"
```

### 環境変数

必要な環境変数：

- `DISCORD_APPLICATION_ID` - Discord アプリケーション ID
- `DISCORD_PUBLIC_KEY` - Discord アプリケーション公開キー  
- `DISCORD_TOKEN` - Discord ボットトークン

これらは `wrangler secret put` コマンドで設定します。

## 🛠️ 技術スタック

- **ランタイム**: Cloudflare Workers (エッジコンピューティング)
- **言語**: TypeScript (strict mode)
- **アーキテクチャ**: Clean Architecture (Onion Architecture)
- **データベース**: Cloudflare D1 (SQLite)
- **キュー**: Cloudflare Queues (メッセージ更新・締切リマインダーの最適化)
- **テスト**: Vitest (461テスト - 100%パス)
- **コード品質**: Biome

詳細なアーキテクチャについては [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照してください。

## 📖 ドキュメント

- [アーキテクチャ](docs/ARCHITECTURE.md) - システム設計の詳細
- [デプロイガイド](docs/DEPLOY.md) - 詳細なセットアップ手順
- [Queuesデプロイガイド](docs/QUEUES_DEPLOYMENT.md) - Cloudflare Queuesの設定と運用
- [開発者向けガイド](CLAUDE.md) - AI アシスタント向けの開発ガイド
- [貢献ガイド](docs/CONTRIBUTING.md) - コントリビューション方法
- [スケーラビリティ](docs/SCALABILITY.md) - パフォーマンスとスケールの詳細

## 🤝 貢献

プルリクエストや Issue の作成を歓迎します！詳しくは [CONTRIBUTING.md](docs/CONTRIBUTING.md) をご覧ください。

## 📝 ライセンス

非OSSライセンス（Custom License - Non-OSS） - 詳細は [LICENSE](LICENSE) ファイルを参照してください。

このプロジェクトは現在、個人での学習・参考用途のみ許可されています。商用利用や再配布は禁止されています。

## 🙏 謝辞

このプロジェクトは以下の素晴らしいツール・サービスを使用しています：

- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Discord.js](https://discord.js.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vitest](https://vitest.dev/)
- [Biome](https://biomejs.dev/)

---

Made with ❤️ by the Discord 調整ちゃん team

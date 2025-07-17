# デプロイ手順

## 前提条件

- Cloudflare アカウント
- Discord Developer アカウント
- Node.js 18+

## 手順

### 1. Discord Application の設定

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. "New Application" をクリック
3. アプリケーション名を入力（例: 調整ちゃん）
4. 作成されたアプリケーションの情報をメモ:
   - Application ID
   - Public Key (General Information タブ)

### 2. Bot の作成とトークン取得

1. 左メニューの "Bot" をクリック
2. "Add Bot" をクリック
3. "Reset Token" をクリックしてトークンをコピー（一度しか表示されません）

### 3. Bot の権限設定とサーバー招待

1. 左メニューの "OAuth2" > "URL Generator" をクリック
2. Scopes で以下を選択:
   - `bot`
   - `applications.commands`
3. Bot Permissions で以下を選択:
   - Send Messages
   - Use Slash Commands
   - Embed Links
   - Read Message History
   - Add Reactions
4. 生成された URL をコピーしてブラウザで開き、ボットを招待

### 4. 環境変数の設定

```bash
cp .env.example .env
```

`.env` ファイルを編集:

```env
DISCORD_APPLICATION_ID=<Application ID>
DISCORD_PUBLIC_KEY=<Public Key>
DISCORD_TOKEN=<Bot Token>
```

### 5. Cloudflare Workers の設定

```bash
# Cloudflare にログイン
wrangler login

# D1 Database の作成
wrangler d1 create discord-choseisan-db
```

出力例:

```
✅ Successfully created DB 'discord-choseisan-db'!

[[d1_databases]]
binding = "DB"
database_name = "discord-choseisan-db"
database_id = "f9c793aa-2850-4646-8d5d-271550fdc3ac"
```

`wrangler.toml` を編集して、作成された database_id を設定:

```toml
[[d1_databases]]
binding = "DB"
database_name = "discord-choseisan-db"
database_id = "xxxxx-xxxxx-xxxxx-xxxxx"  # 実際のIDに置き換え
```

### 6. データベースマイグレーション

```bash
# 初期スキーマの適用
wrangler d1 execute discord-choseisan-db --file=./migrations/0001_20240115_initial_schema.sql

# 期限切れデータクリーンアップスクリプト（必要に応じて）
wrangler d1 execute discord-choseisan-db --file=./migrations/0002_20240116_cleanup_expired_data.sql

# 外部キー最適化（必要に応じて）
wrangler d1 execute discord-choseisan-db --file=./migrations/0003_20240117_foreign_key_optimization.sql

# ローカル開発環境でテスト
wrangler d1 execute discord-choseisan-db --local --file=./migrations/0001_20240115_initial_schema.sql
```

### 7. シークレットの設定

```bash
# Discord の認証情報を Cloudflare Workers に設定
wrangler secret put DISCORD_PUBLIC_KEY
# プロンプトが表示されたら Public Key を入力

wrangler secret put DISCORD_APPLICATION_ID
# プロンプトが表示されたら Application ID を入力

wrangler secret put DISCORD_TOKEN
# プロンプトが表示されたら Bot Token を入力
```

### 8. デプロイ

```bash
# 本番環境にデプロイ
npm run deploy
```

デプロイ成功後、Worker の URL が表示されます:

```
https://discord-choseisan.<your-subdomain>.workers.dev
```

### 9. Discord Interaction Endpoint の設定

1. Discord Developer Portal に戻る
2. アプリケーションの "General Information" タブ
3. "Interactions Endpoint URL" に Worker の URL + `/interactions` を設定:
   ```
   https://discord-choseisan.<your-subdomain>.workers.dev/interactions
   ```
4. "Save Changes" をクリック

### 10. スラッシュコマンドの登録

```bash
node scripts/register-commands.js
```

### 11. 動作確認

Discord サーバーで以下を実行:

```
/help
```

ヘルプメッセージが表示されれば成功です！

## トラブルシューティング

### "Invalid Interaction" エラー

- Public Key が正しく設定されているか確認
- Interactions Endpoint URL が正しいか確認

### コマンドが表示されない

- Bot が正しい権限でサーバーに招待されているか確認
- `register-commands.js` が正常に実行されたか確認
- Discord クライアントを再起動

### D1 エラー

- wrangler.toml の database_id が正しいか確認
- マイグレーションが正常に実行されたか確認
- `wrangler d1 execute discord-choseisan-db --command "SELECT name FROM sqlite_master WHERE type='table';"` でテーブルを確認

## 運用

### ログの確認

```bash
wrangler tail
```

### D1 データベースの確認

```bash
# テーブル一覧
wrangler d1 execute discord-choseisan-db --command "SELECT name FROM sqlite_master WHERE type='table';"

# スケジュール一覧
wrangler d1 execute discord-choseisan-db --command "SELECT id, title, status FROM schedules LIMIT 10;"

# 特定のスケジュール詳細
wrangler d1 execute discord-choseisan-db --command "SELECT * FROM schedules WHERE id = 'schedule-id';"
```

### 期限切れデータのクリーンアップ

```bash
# 手動実行
wrangler d1 execute discord-choseisan-db --file=./migrations/0002_20240116_cleanup_expired_data.sql

# または、Cron Jobで自動実行（要追加実装）
```

### 更新のデプロイ

```bash
npm run deploy
```

## 本番環境の推奨設定

### レート制限

- Discord API: 30リクエスト/分
- 適切なバッチ処理とディレイを実装済み

### パフォーマンス

- D1 データベースインデックスが適切に設定済み
- View を使用した集計クエリの最適化
- Cloudflare Workers の実行時間制限（3秒）に注意

### セキュリティ

- すべての認証情報はシークレットとして管理
- 最小権限の原則に従ったBot権限設定
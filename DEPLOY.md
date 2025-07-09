# デプロイ手順

## 前提条件

- Cloudflare アカウント
- Discord Developer アカウント
- Node.js 18+

## 手順

### 1. Discord Application の設定

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. "New Application" をクリック
3. アプリケーション名を入力（例: ちょうせいちゃん）
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

# KV Namespace の作成
wrangler kv:namespace create "SCHEDULES"
wrangler kv:namespace create "RESPONSES"
```

出力例:

```
✅ Successfully created KV namespace "SCHEDULES"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

✅ Successfully created KV namespace "RESPONSES"
id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
```

`wrangler.toml` を編集して、作成された ID を設定:

```toml
[[kv_namespaces]]
binding = "SCHEDULES"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"  # 実際のIDに置き換え

[[kv_namespaces]]
binding = "RESPONSES"
id = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyy"  # 実際のIDに置き換え
```

### 6. シークレットの設定

```bash
# Discord の認証情報を Cloudflare Workers に設定
wrangler secret put DISCORD_PUBLIC_KEY
# プロンプトが表示されたら Public Key を入力

wrangler secret put DISCORD_APPLICATION_ID
# プロンプトが表示されたら Application ID を入力

wrangler secret put DISCORD_TOKEN
# プロンプトが表示されたら Bot Token を入力
```

### 7. デプロイ

```bash
# 本番環境にデプロイ
npm run deploy
```

デプロイ成功後、Worker の URL が表示されます:

```
https://discord-choseisan.<your-subdomain>.workers.dev
```

### 8. Discord Interaction Endpoint の設定

1. Discord Developer Portal に戻る
2. アプリケーションの "General Information" タブ
3. "Interactions Endpoint URL" に Worker の URL + `/interactions` を設定:
   ```
   https://discord-choseisan.<your-subdomain>.workers.dev/interactions
   ```
4. "Save Changes" をクリック

### 9. スラッシュコマンドの登録

```bash
node scripts/register-commands.js
```

### 10. 動作確認

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

### KV エラー

- wrangler.toml の KV binding ID が正しいか確認
- KV namespace が作成されているか確認

## 運用

### ログの確認

```bash
wrangler tail
```

### KV データの確認

```bash
# 全ての key を表示
wrangler kv:key list --binding=SCHEDULES

# 特定の値を取得
wrangler kv:key get --binding=SCHEDULES "schedule:xxxxx"
```

### 更新のデプロイ

```bash
npm run deploy
```

# GitHub Actions セットアップガイド

## 必要な設定

締切リマインダー機能を有効にするには、以下のGitHub Secretsを設定する必要があります。

### 1. WORKER_URL
Cloudflare WorkerのURL。以下の形式：
```
https://discord-choseisan.{your-subdomain}.workers.dev
```

### 2. CRON_SECRET
cron呼び出しを認証するための秘密鍵。ランダムな文字列を生成してください：
```bash
openssl rand -hex 32
```

## GitHub Secretsの設定方法

1. GitHubリポジトリの Settings → Secrets and variables → Actions
2. "New repository secret" をクリック
3. 以下を追加：
   - Name: `WORKER_URL`
   - Value: あなたのWorker URL
4. 同様に `CRON_SECRET` も追加

## Cloudflare側の設定

`CRON_SECRET`をCloudflareにも設定：
```bash
wrangler secret put CRON_SECRET
```

## 動作確認

1. GitHub ActionsのActions タブを開く
2. "Deadline Reminder" ワークフローを選択
3. "Run workflow" をクリックして手動実行
4. ログを確認して成功することを確認

## トラブルシューティング

### "Request failed with status code: 401"
- `CRON_SECRET`が正しく設定されているか確認
- GitHubとCloudflareで同じ値になっているか確認

### "Request failed with status code: 404"
- `WORKER_URL`が正しいか確認
- `/cron/deadline-check`エンドポイントが存在するか確認

### 通知が送信されない
- Workerのログを確認（Cloudflareダッシュボード）
- Discord botトークンが有効か確認
- スケジュールに締切が設定されているか確認
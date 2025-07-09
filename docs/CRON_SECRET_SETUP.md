# CRON_SECRET セットアップガイド

GitHub Actionsから締切リマインダーのcronジョブを実行するには、CRON_SECRETの設定が必要です。

## 1. シークレットの生成

ランダムな文字列を生成します：

```bash
openssl rand -hex 32
```

例: `a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890`

## 2. Cloudflare Workers側の設定

生成したシークレットをCloudflare Workersに設定：

```bash
wrangler secret put CRON_SECRET
```

プロンプトが表示されたら、生成した文字列を入力してEnterを押します。

## 3. GitHub Actions側の設定

1. GitHubリポジトリの Settings → Secrets and variables → Actions
2. "New repository secret" をクリック
3. 以下を追加：
   - Name: `CRON_SECRET`
   - Value: 同じ文字列（手順1で生成したもの）

## 4. WORKER_URLの設定も確認

GitHub Secretsに`WORKER_URL`も設定されているか確認：

```
https://discord-choseisan.{your-subdomain}.workers.dev
```

## 確認方法

1. GitHub ActionsのActions タブを開く
2. "Deadline Reminder" ワークフローを選択
3. "Run workflow" → "Run workflow" をクリック
4. 実行ログを確認

成功すると「Deadline check completed successfully」と表示されます。

## トラブルシューティング

### "Request failed with status code: 401"

- Cloudflare WorkersとGitHub Actionsの両方で同じCRON_SECRET値を使用しているか確認
- 値の前後に余分なスペースや改行が含まれていないか確認
- `wrangler secret list` で設定済みのシークレット一覧を確認

### "Request failed with status code: 404"

- WORKER_URLが正しいか確認
- Workerがデプロイされているか確認：`wrangler deploy`
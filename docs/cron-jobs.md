# Cronジョブ仕様

Discord調整ちゃんのGitHub Actions Cronジョブについて説明します。

## 概要

定期的な処理はGitHub Actionsを使用して実行されます。現在は締切リマインダーの送信のみ実装されています。

## GitHub Actions設定

### ワークフロー定義
`.github/workflows/deadline-reminder.yml`:
```yaml
name: Deadline Reminder

on:
  schedule:
    # 毎時0分と30分に実行（JST基準で考える場合は-9時間）
    - cron: '0,30 * * * *'
  workflow_dispatch: # 手動実行も可能

jobs:
  send-reminders:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Send deadline reminders
        run: npm run cron:deadline-reminder
        env:
          DISCORD_TOKEN: ${{ secrets.DISCORD_TOKEN }}
          DISCORD_APPLICATION_ID: ${{ secrets.DISCORD_APPLICATION_ID }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_KV_NAMESPACE_ID: ${{ secrets.CLOUDFLARE_KV_NAMESPACE_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## 実行間隔

- **本番環境**: 30分ごと（毎時0分と30分）
- **手動実行**: GitHub Actionsの画面から随時実行可能

## Cronスクリプト

### エントリーポイント
`src/cron/deadline-reminder.ts`:
```typescript
export async function sendDeadlineReminders(env: Env): Promise<void> {
  const storage = new StorageServiceV2(env.SCHEDULES, env.RESPONSES);
  const notificationService = new NotificationService(
    storage,
    env.DISCORD_TOKEN,
    env.DISCORD_APPLICATION_ID
  );

  // 全ギルドを取得
  const guilds = await getUniqueGuilds(storage);
  
  // 各ギルドの締切をチェック
  for (const guildId of guilds) {
    await processGuildSchedules(guildId, storage, notificationService, env);
  }
}
```

### 処理フロー
1. **ギルド一覧取得**
   - KVストレージから全ギルドIDを抽出
   
2. **締切インデックス検索**
   - 各ギルドの締切インデックスを効率的に検索
   
3. **リマインダー判定**
   - 現在時刻と締切時刻を比較
   - 送信タイミングに該当するか判定
   
4. **通知送信**
   - Discord APIでメッセージ送信
   - DM通知も同時送信
   
5. **状態更新**
   - `remindersSent`配列を更新
   - 締切後は`status: 'closed'`に変更

## エラーハンドリング

### リトライ機構
現在は実装されていませんが、以下の対策が考えられます：
- Discord API エラー時の再試行
- 部分的な失敗の記録と次回実行時の補完

### ログ出力
```typescript
console.log(`Processing ${schedules.length} schedules for guild ${guildId}`);
console.error(`Failed to send reminder for schedule ${scheduleId}:`, error);
```

## パフォーマンス最適化

### バッチ処理
```typescript
const batchSize = parseInt(env.REMINDER_BATCH_SIZE || '10');
const batchDelay = parseInt(env.REMINDER_BATCH_DELAY || '100');

// 10件ずつ処理し、バッチ間に100ms待機
```

### 並列処理
```typescript
await Promise.all(
  batch.map(schedule => processSchedule(schedule))
);
```

## モニタリング

### GitHub Actions UI
- 実行履歴の確認
- エラーログの確認
- 実行時間の監視

### アラート設定
GitHub Actionsの失敗時にメール通知を受け取ることが可能

## セキュリティ

### シークレット管理
以下の値はGitHub Secretsに格納：
- `DISCORD_TOKEN`
- `DISCORD_APPLICATION_ID`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_KV_NAMESPACE_ID`
- `CLOUDFLARE_API_TOKEN`

### 権限管理
- リポジトリの Actions secrets へのアクセスは管理者のみ
- Cloudflare API トークンは必要最小限の権限

## ローカル実行

開発環境でのテスト：
```bash
# 環境変数を設定
export DISCORD_TOKEN=xxx
export DISCORD_APPLICATION_ID=xxx
export CLOUDFLARE_ACCOUNT_ID=xxx
export CLOUDFLARE_KV_NAMESPACE_ID=xxx
export CLOUDFLARE_API_TOKEN=xxx

# 実行
npm run cron:deadline-reminder
```

## 今後の拡張

### 実装可能な機能
1. **定期レポート**
   - 週次/月次の利用統計
   - 人気の時間帯分析

2. **自動アーカイブ**
   - 古いスケジュールの自動削除
   - ストレージ容量の最適化

3. **リマインダーのカスタマイズ**
   - 曜日指定（平日のみ等）
   - 時間帯指定（営業時間内のみ等）

### スケーリング考慮事項
- Cron実行時間の制限（GitHub Actions: 6時間）
- 大量のギルド/スケジュールへの対応
- レート制限を考慮した処理の分散
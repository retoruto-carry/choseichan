# リマインダー・締切通知システム

Discord調整ちゃんの締切リマインダーと通知システムの仕様と実装について説明します。

## 概要

締切リマインダーシステムは、Cloudflare Workers Cronから定期的に実行され、日程調整の締切が近づいたときに自動的にリマインダーを送信します。

## アーキテクチャ

```
Cloudflare Workers Cron
    ↓
POST /cron/deadline-check (CRON_SECRET認証)
    ↓
deadline-reminder.ts
    ↓
NotificationService
    ↓
Discord API
```

## リマインダーの種類

### デフォルトリマインダー
締切時刻を基準に以下のタイミングで送信：
- **3日前** (`3d`)
- **1日前** (`1d`) 
- **8時間前** (`8h`)

### カスタムリマインダー
ユーザーが自由に設定可能：
- **日単位**: `1d`〜`30d`（1〜30日）
- **時間単位**: `1h`〜`720h`（1〜720時間）
- **分単位**: `5m`〜`1440m`（5〜1440分）

例: `締切とリマインダー: 2024-12-25 18:00\nリマインダー: 7d,3d,1d,12h,1h,30m`

## メンション機能

### 対応フォーマット
1. **@everyone** - サーバー全員に通知
2. **@here** - オンラインメンバーに通知
3. **@username** - 特定ユーザーに通知（自動的に`<@userId>`に変換）
4. **<@userId>** - Discord標準形式（そのまま使用）
5. **username** - @なしでも認識（`<@userId>`に変換）

### ユーザー解決の仕組み
```typescript
// 1. ギルドメンバーを取得（最大1000人ずつ）
const members = await fetchGuildMembers(guildId);

// 2. ユーザー名からIDを解決
// @Alice → <@111111111>
// Bob → <@222222222>

// 3. 5分間キャッシュして効率化
```

## 通知の流れ

### 1. 締切リマインダー
元のスケジュールメッセージへの返信として送信されます：
```
@everyone ⏰ **締切リマインダー**: 「忘年会」の締切まで8時間です！

締切時刻: 2024/12/25 18:00
現在の回答者数: 5人

まだ回答していない方は早めに回答をお願いします！
```

### 2. 締切通知（自動クローズ）
締切時刻を過ぎると自動的に日程調整をクローズし、集計結果を送信：
```
📊 日程調整「忘年会」が締め切られました！

集計結果
参加者数: 10人
⭐ 12/23(土) 18:00
  ○ 8人　△ 1人　× 1人
12/24(日) 18:00
  ○ 5人　△ 3人　× 2人
```

締切通知の5秒後にPRメッセージ（広告）も送信されます。


## 実装詳細

### KVストレージ構造
```
# スケジュール本体
guild:{guildId}:schedule:{scheduleId}

# 締切インデックス（効率的な検索用）
guild:{guildId}:deadline:{timestamp}:{scheduleId}
```

### 締切インデックスの管理
```typescript
// 締切が更新されたとき
if (existingSchedule?.deadline) {
  const oldTimestamp = Math.floor(existingSchedule.deadline.getTime() / 1000);
  const newTimestamp = schedule.deadline ? Math.floor(schedule.deadline.getTime() / 1000) : null;
  
  // 古いインデックスを削除
  if (!schedule.deadline || oldTimestamp !== newTimestamp) {
    await this.schedules.delete(`guild:${guildId}:deadline:${oldTimestamp}:${schedule.id}`);
  }
}

// 新しいインデックスを作成
if (schedule.deadline) {
  const timestamp = Math.floor(schedule.deadline.getTime() / 1000);
  await this.schedules.put(`guild:${guildId}:deadline:${timestamp}:${schedule.id}`, schedule.id);
}
```

### リマインダー送信のロジック
```typescript
// 1. 時間枠の設定（過去1週間〜3日後）
const now = new Date();
const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

// 2. 全ギルドのスケジュールキーから unique なギルドIDを取得
const scheduleKeys = await env.SCHEDULES.list({
  prefix: 'guild:',
  limit: 1000
});

const guildIds = new Set<string>();
for (const key of scheduleKeys.keys) {
  const parts = key.name.split(':');
  if (parts[0] === 'guild' && parts[2] === 'schedule' && parts[1]) {
    guildIds.add(parts[1]);
  }
}

// 3. 各ギルドの締切インデックスをチェック
for (const guildId of guildIds) {
  const deadlineKeys = await env.SCHEDULES.list({
    prefix: `guild:${guildId}:deadline:`,
    limit: 1000
  });
  
  for (const key of deadlineKeys.keys) {
    const parts = key.name.split(':');
    const timestamp = parseInt(parts[3]) * 1000; // ミリ秒に変換
    
    // 時間枠内の締切のみ処理
    if (timestamp >= oneWeekAgo.getTime() && timestamp <= threeDaysFromNow.getTime()) {
      const scheduleId = parts[4];
      const schedule = await storage.getSchedule(scheduleId, guildId);
      
      if (schedule && schedule.status === 'open') {
        // リマインダー送信判定
        const timings = schedule.reminderTimings || ['3d', '1d', '8h'];
        
        for (const timing of timings) {
          const reminderTime = schedule.deadline.getTime() - (parseTimingToHours(timing) * 60 * 60 * 1000);
          
          if (now.getTime() >= reminderTime && !schedule.remindersSent?.includes(timing)) {
            // 8時間以上遅れていない場合のみ送信
            if (now.getTime() - reminderTime <= OLD_REMINDER_THRESHOLD_MS) {
              await sendReminder(schedule, timing);
            }
          }
        }
        
        // 締切を過ぎていたら自動クローズ
        if (schedule.deadline.getTime() <= now.getTime()) {
          await autoCloseSchedule(schedule);
        }
      }
    }
  }
}
```

### レート制限対策
Discord APIのレート制限を考慮したバッチ処理：
```typescript
// processBatches ユーティリティを使用
await processBatches(upcomingReminders, async (reminderInfo) => {
  try {
    const { schedule, reminderType, message } = reminderInfo;
    
    // リマインダーを送信
    await notificationService.sendDeadlineReminder(schedule, message);
    
    // 送信済みとして記録
    schedule.remindersSent = [...(schedule.remindersSent || []), reminderType];
    await storage.saveSchedule(schedule);
    
  } catch (error) {
    console.error(`Failed to send reminder for schedule ${reminderInfo.schedule.id}:`, error);
  }
}, {
  batchSize: env.REMINDER_BATCH_SIZE || 20,
  delayBetweenBatches: env.REMINDER_BATCH_DELAY || 100
});
```

## セキュリティと制限

### 古いリマインダーのスキップ
8時間以上遅れたリマインダーは送信されません：
```typescript
const OLD_REMINDER_THRESHOLD_MS = 8 * 60 * 60 * 1000;

if (timeDiff < -OLD_REMINDER_THRESHOLD_MS) {
  // スキップして次のリマインダーへ
  continue;
}
```

### 重複送信の防止
```typescript
// remindersSentに送信済みタイミングを記録
if (schedule.remindersSent?.includes(timing)) {
  continue; // 既に送信済み
}

// 送信後に記録
schedule.remindersSent = [...(schedule.remindersSent || []), timing];
```

## 環境変数

```env
# Discord認証
DISCORD_TOKEN=Bot_xxxx
DISCORD_APPLICATION_ID=xxxx

# Cron認証
CRON_SECRET=xxxx            # Cronエンドポイントの認証シークレット

# レート制限設定
REMINDER_BATCH_SIZE=20      # 一度に処理するリマインダー数（デフォルト: 20）
REMINDER_BATCH_DELAY=100    # バッチ間の遅延（ミリ秒、デフォルト: 100）
```

## テスト

### ユニットテスト
- `tests/cron/deadline-reminder.test.ts` - リマインダーロジック
- `tests/services/mention-resolution.test.ts` - メンション解決
- `tests/storage/deadline-index.test.ts` - インデックス管理

### 統合テスト
- `tests/integration/notification-flow.test.ts` - 通知フロー全体
- `tests/custom-reminders.test.ts` - カスタムリマインダー

## トラブルシューティング

### リマインダーが送信されない
1. 締切が設定されているか確認
2. Cloudflare Workers Cronトリガーが設定されているか確認
3. CRON_SECRETが正しく設定されているか確認
4. 環境変数（DISCORD_TOKEN, DISCORD_APPLICATION_ID）が正しく設定されているか確認

### メンションが解決されない
1. Botに必要な権限があるか確認（サーバーメンバー取得権限）
2. ユーザー名が正確か確認（大文字小文字は無視される）

### 重複して送信される
1. `remindersSent`配列を確認
2. D1データベースの整合性を確認

## パフォーマンス

- ギルドメンバーは5分間キャッシュ
- D1のインデックスによる高速検索
- バッチ処理によるAPI呼び出し最適化
- SQLクエリで時間枠フィルタリング

## Cronトリガーの設定

Cloudflare Workers の wrangler.toml で設定：
```toml
[[triggers.crons]]
schedule = "*/30 * * * *"  # 30分ごとに実行
```

または Cloudflare ダッシュボードから手動で設定することも可能です。
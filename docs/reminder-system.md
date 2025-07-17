# リマインダー・締切通知システム

Discord調整ちゃんの締切リマインダーと通知システムの仕槕と実装について説明します。

## 概要

締切リマインダーシステムは、Cloudflare Workersのネイティブcron triggersから10分ごとに実行され、日程調整の締切が近づいたときに自動的にリマインダーを送信します。

## アーキテクチャ

```
Cloudflare Workers Native Cron Trigger
    ↓
scheduled() handler in index.ts
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

### D1データベース構造
```sql
-- スケジュールテーブル
CREATE TABLE schedules (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    deadline DATETIME,
    reminder_timings TEXT,
    reminders_sent TEXT,
    status TEXT CHECK(status IN ('open', 'closed')) DEFAULT 'open',
    -- その他のカラム...
);

-- 締切での検索を高速化するインデックス
CREATE INDEX idx_schedules_deadline ON schedules(deadline) WHERE status = 'open';
```

### リマインダー送信のロジック
```typescript
// DeadlineReminderUseCaseでのSQLクエリ
const sql = `
  SELECT id, guild_id, channel_id, message_id, title, deadline,
         reminder_timings, reminders_sent, status
  FROM schedules 
  WHERE status = 'open' 
    AND deadline IS NOT NULL
    AND deadline BETWEEN ? AND ?
  ORDER BY deadline ASC
`;

const schedules = await db
  .prepare(sql)
  .bind(oneWeekAgo.toISOString(), threeDaysFromNow.toISOString())
  .all();
```

### リマインダー送信処理
ProcessDeadlineRemindersUseCaseが中心となって処理します：

```typescript
// 1. スケジュールを取得
const schedulesResult = await this.deadlineReminderUseCase.execute();

// 2. 各スケジュールを処理
for (const schedule of schedulesResult.schedules) {
  // リマインダー送信チェック
  const timings = schedule.reminderTimings || ['3d', '1d', '8h'];
  
  for (const timing of timings) {
    const reminderTime = calculateReminderTime(schedule.deadline, timing);
    
    if (shouldSendReminder(now, reminderTime) && !isReminderSent(schedule, timing)) {
      // Cloudflare Queueを使用してリマインダー送信タスクをキュー
      await this.deadlineReminderQueue?.send({
        type: 'send_reminder',
        scheduleId: schedule.id,
        reminderType: timing
      });
    }
  }
  
  // 締切過ぎたスケジュールのクローズ
  if (schedule.deadline <= now) {
    await this.deadlineReminderQueue?.send({
      type: 'close_schedule',
      scheduleId: schedule.id
    });
  }
}
```

### レート制限対策
Cloudflare Queuesを使用してDiscord APIのレート制限を回避：

```typescript
// deadline-reminder-queue.ts
export async function handleDeadlineReminderBatch(
  batch: MessageBatch<DeadlineReminderTask>,
  env: Env
): Promise<void> {
  const container = new DependencyContainer(env);
  
  for (const message of batch.messages) {
    const task = message.body;
    
    switch (task.type) {
      case 'send_reminder':
        await sendReminder(task.scheduleId, task.reminderType);
        break;
      case 'close_schedule':
        await closeSchedule(task.scheduleId);
        break;
      case 'send_summary':
        await sendSummary(task.scheduleId);
        break;
    }
    
    // メッセージをACK
    message.ack();
  }
}
```

Cloudflare Queuesの設定：
```toml
[[queues.consumers]]
queue = "chouseichan-deadline-reminder-queue"
max_batch_size = 20     # バッチサイズ
max_batch_timeout = 10  # タイムアウト（秒）
max_retries = 3         # リトライ回数
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
DISCORD_PUBLIC_KEY=xxxx

# D1 Databaseは wrangler.toml で設定
# Cloudflare Queuesも wrangler.toml で設定
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
2. wrangler.toml の cron トリガーが設定されているか確認
3. 環境変数（DISCORD_TOKEN, DISCORD_APPLICATION_ID）が正しく設定されているか確認
4. Cloudflare Queues が正しく設定されているか確認

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
[triggers]
crons = ["*/10 * * * *"]  # 10分ごとに実行
```

Workersの index.ts に scheduled ハンドラーを実装：
```typescript
export default {
  fetch: app.fetch,
  queue,
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    await sendDeadlineReminders({ ...env, ctx });
  },
};
```
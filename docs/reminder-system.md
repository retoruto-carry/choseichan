# リマインダー・締切通知システム

Discord調整ちゃんの締切リマインダーと通知システムの仕様と実装について説明します。

## 概要

締切リマインダーシステムは、GitHub ActionsのCronジョブから定期的に実行され、日程調整の締切が近づいたときに自動的にリマインダーを送信します。

## アーキテクチャ

```
GitHub Actions (Cron)
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
```
⏰ **リマインダー**: 「忘年会」の締切まで8時間です！

締切時刻: 2024/12/25 18:00
現在の回答者数: 5人

[スケジュールを確認](Discord URL)
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

### 3. DM通知
作成者には個別にDMでも通知が送信されます。

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
// 1. 締切が設定されているスケジュールを検索
const guilds = await getUniqueGuilds();

for (const guildId of guilds) {
  // 2. 締切インデックスから候補を取得
  const deadlineKeys = await storage.schedules.list({
    prefix: `guild:${guildId}:deadline:`
  });
  
  // 3. 各スケジュールをチェック
  for (const schedule of schedules) {
    // 4. リマインダータイミングを計算
    const timings = schedule.reminderTimings || ['3d', '1d', '8h'];
    
    for (const timing of timings) {
      if (shouldSendReminder(schedule, timing)) {
        await sendReminder(schedule, timing);
      }
    }
  }
}
```

### レート制限対策
Discord APIのレート制限を考慮したバッチ処理：
```typescript
const batchSize = parseInt(env.REMINDER_BATCH_SIZE || '10');
const batchDelay = parseInt(env.REMINDER_BATCH_DELAY || '100');

for (let i = 0; i < schedules.length; i += batchSize) {
  const batch = schedules.slice(i, i + batchSize);
  
  await Promise.all(
    batch.map(schedule => processSchedule(schedule))
  );
  
  if (i + batchSize < schedules.length) {
    await delay(batchDelay);
  }
}
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

# レート制限設定
REMINDER_BATCH_SIZE=10      # 一度に処理するスケジュール数
REMINDER_BATCH_DELAY=100    # バッチ間の遅延（ミリ秒）
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
2. GitHub Actions Cronが動作しているか確認
3. 環境変数が正しく設定されているか確認

### メンションが解決されない
1. Botに必要な権限があるか確認（サーバーメンバー取得権限）
2. ユーザー名が正確か確認（大文字小文字は無視される）

### 重複して送信される
1. `remindersSent`配列を確認
2. KVストレージの整合性を確認

## パフォーマンス

- ギルドメンバーは5分間キャッシュ
- 締切インデックスによる効率的な検索
- バッチ処理によるAPI呼び出し最適化
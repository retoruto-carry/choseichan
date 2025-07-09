# マルチテナント移行ガイド

このドキュメントでは、Discord調整ちゃんを単一テナント構成からマルチテナント構成に移行する手順を説明します。

## 概要

マルチテナント対応により、1つのボットインスタンスが複数のDiscordサーバー（ギルド）にインストールされ、各サーバーのデータを完全に分離して管理できるようになりました。

## 主な変更点

### 1. ストレージキー設計の変更

#### 旧形式
```
schedule:{scheduleId}
response:{scheduleId}:{userId}
```

#### 新形式
```
guild:{guildId}:schedule:{scheduleId}
guild:{guildId}:response:{scheduleId}:{userId}
guild:{guildId}:channel:{channelId}:schedules
guild:{guildId}:deadline:{timestamp}:{scheduleId}
```

### 2. StorageServiceの変更

- `StorageService` → `StorageServiceV2`に変更
- すべてのメソッドに`guildId`パラメータが追加されました
- Scheduleオブジェクトに`guildId`フィールドが追加されました

## 移行手順

### ステップ1: バックアップの作成

移行前に、既存のKVデータのバックアップを作成してください。

```bash
# Wrangler CLIを使用してKVデータをエクスポート
wrangler kv:bulk export --namespace-id YOUR_SCHEDULES_NAMESPACE_ID > schedules_backup.json
wrangler kv:bulk export --namespace-id YOUR_RESPONSES_NAMESPACE_ID > responses_backup.json
```

### ステップ2: 移行スクリプトの実行

以下の移行スクリプトを使用して、既存のデータを新しいキー形式に変換します。

```typescript
// migrate-to-multitenant.ts
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const DEFAULT_GUILD_ID = 'default'; // 既存データのデフォルトギルドID

async function migrateSchedules(inputFile: string, outputFile: string) {
  const fileStream = createReadStream(inputFile);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const newData = [];

  for await (const line of rl) {
    const entry = JSON.parse(line);
    const key = entry.key;
    const value = JSON.parse(entry.value);

    if (key.startsWith('schedule:')) {
      // スケジュールデータの移行
      const scheduleId = key.substring('schedule:'.length);
      const newKey = `guild:${DEFAULT_GUILD_ID}:schedule:${scheduleId}`;
      
      // guildIdフィールドを追加
      value.guildId = DEFAULT_GUILD_ID;
      
      newData.push({
        key: newKey,
        value: JSON.stringify(value)
      });
    }
  }

  // 新しいデータをファイルに書き込む
  const fs = require('fs').promises;
  await fs.writeFile(outputFile, newData.map(d => JSON.stringify(d)).join('\n'));
}

async function migrateResponses(inputFile: string, outputFile: string) {
  const fileStream = createReadStream(inputFile);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const newData = [];

  for await (const line of rl) {
    const entry = JSON.parse(line);
    const key = entry.key;
    const value = entry.value;

    if (key.startsWith('response:')) {
      // レスポンスデータの移行
      const parts = key.split(':');
      const scheduleId = parts[1];
      const userId = parts[2];
      const newKey = `guild:${DEFAULT_GUILD_ID}:response:${scheduleId}:${userId}`;
      
      newData.push({
        key: newKey,
        value: value
      });
    }
  }

  // 新しいデータをファイルに書き込む
  const fs = require('fs').promises;
  await fs.writeFile(outputFile, newData.map(d => JSON.stringify(d)).join('\n'));
}

// 実行
migrateSchedules('schedules_backup.json', 'schedules_migrated.json');
migrateResponses('responses_backup.json', 'responses_migrated.json');
```

### ステップ3: 新しいデータのインポート

移行したデータをKVにインポートします。

```bash
# 移行したデータをインポート
wrangler kv:bulk put --namespace-id YOUR_SCHEDULES_NAMESPACE_ID schedules_migrated.json
wrangler kv:bulk put --namespace-id YOUR_RESPONSES_NAMESPACE_ID responses_migrated.json
```

### ステップ4: デプロイ

新しいコードをデプロイします。

```bash
npm run deploy
```

### ステップ5: 検証

1. ボットが正常に動作することを確認
2. 既存の日程調整が正しく表示されることを確認
3. 新しい日程調整が作成できることを確認
4. 回答が正しく保存されることを確認

## ロールバック手順

問題が発生した場合は、以下の手順でロールバックできます。

1. 旧バージョンのコードに戻す
2. バックアップからKVデータを復元する

```bash
# KVデータをクリアして復元
wrangler kv:bulk delete --namespace-id YOUR_SCHEDULES_NAMESPACE_ID --prefix "guild:"
wrangler kv:bulk delete --namespace-id YOUR_RESPONSES_NAMESPACE_ID --prefix "guild:"
wrangler kv:bulk put --namespace-id YOUR_SCHEDULES_NAMESPACE_ID schedules_backup.json
wrangler kv:bulk put --namespace-id YOUR_RESPONSES_NAMESPACE_ID responses_backup.json
```

## 注意事項

- 移行中はボットを一時的に停止することを推奨します
- 大量のデータがある場合、移行に時間がかかる可能性があります
- 移行後は古いキー形式のデータは削除しても問題ありません

## 新しいサーバーへのインストール

マルチテナント対応後は、新しいDiscordサーバーにボットをインストールする際、自動的にそのサーバー専用のデータスペースが作成されます。特別な設定は必要ありません。

## サポート

問題が発生した場合は、GitHubのIssuesでお問い合わせください。
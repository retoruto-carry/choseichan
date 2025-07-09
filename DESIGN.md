# Discord 日程調整ボット「ちょうせいくん」設計書

## 概要
Discordサーバー内で完結する日程調整ボット。調整さんのような機能をDiscord上で実現し、参加者はボタンを押すだけで簡単に参加意思を表明できる。

## UXコンセプト
- **シンプル**: ボタンを押すだけで参加表明
- **リアルタイム**: 即座に反映される参加状況
- **視覚的**: 分かりやすい表形式での表示
- **Discord Native**: Discord内で完結、外部サイト不要

## 主要機能

### 1. 日程調整の作成
```
/schedule create title:"懇親会" dates:"12/20 19:00" "12/21 18:00" "12/22 19:00"
```

### 2. 参加意思表明
- ○ (参加可能) ボタン
- △ (未定/条件付き) ボタン  
- × (参加不可) ボタン
- コメント追加機能

### 3. 結果表示
Embedで美しく整形された表を表示：
```
📅 懇親会の日程調整

12/20 19:00  ○: 3人  △: 1人  ×: 2人
12/21 18:00  ○: 5人  △: 0人  ×: 1人  ⭐最有力
12/22 19:00  ○: 2人  △: 2人  ×: 2人
```

### 4. その他の機能
- 締切設定: `/schedule close [調整ID]`
- リマインダー: 未回答者に通知
- 最適日程の自動判定
- CSVエクスポート

## 技術アーキテクチャ

### スタック
- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Language**: TypeScript
- **Database**: Cloudflare KV / D1
- **Discord**: Interactions API

### データモデル
```typescript
interface Schedule {
  id: string;
  title: string;
  description?: string;
  dates: Date[];
  createdBy: string;
  createdAt: Date;
  deadline?: Date;
  status: 'open' | 'closed';
}

interface Response {
  scheduleId: string;
  userId: string;
  userName: string;
  responses: {
    dateIndex: number;
    status: 'yes' | 'maybe' | 'no';
    comment?: string;
  }[];
  updatedAt: Date;
}
```

## インタラクションフロー

1. **作成フロー**
   - ユーザーが `/schedule create` コマンドを実行
   - ボットが調整を作成し、Embedメッセージを投稿
   - 各日程に対応するボタンを表示

2. **回答フロー**
   - ユーザーがボタンをクリック
   - モーダルで詳細回答（コメント等）を入力可能
   - 回答がKVに保存され、Embedが更新される

3. **確認フロー**
   - `/schedule status [ID]` で現在の状況を確認
   - 最有力候補が自動的にハイライト表示

## セキュリティ考慮事項
- Discord署名検証
- レート制限
- 権限チェック（作成者のみが締切・削除可能）

## 実装優先順位
1. 基本的な作成・回答機能
2. リアルタイム更新
3. 締切・リマインダー機能
4. エクスポート機能
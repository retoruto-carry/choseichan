# Discord 日程調整ボット「調整ちゃん」設計書

## 概要

Discord サーバー内で完結する日程調整ボット。調整さんのような機能を Discord 上で実現し、参加者はボタンを押すだけで簡単に参加意思を表明できる。

## UX コンセプト

- **シンプル**: ボタンを押すだけで参加表明
- **リアルタイム**: 即座に反映される参加状況
- **視覚的**: 分かりやすい表形式での表示
- **Discord Native**: Discord 内で完結、外部サイト不要

## 主要機能

### 1. 日程調整の作成

```
/choseichan create
```

モーダルで以下を入力：
- タイトル（必須）
- 説明（任意）
- 日程候補（改行区切り）
- 締切日時（任意）

### 2. 参加意思表明

#### セレクトメニュー方式（推奨）
- 「回答する」ボタンからセレクトメニューで一括回答
- 各日程に対して ○/△/×/未回答 を選択

#### ダイレクト投票方式
- 各日程の横にある ○/△/× ボタンをクリック
- クリックごとに状態がトグル

#### コメント機能
- 全体コメント、日程別コメントの追加

### 3. 結果表示

Embed で美しく整形された表を表示：

```
📅 懇親会の日程調整

12/20 19:00  ○: 3人  △: 1人  ×: 2人
12/21 18:00  ○: 5人  △: 0人  ×: 1人  ⭐最有力
12/22 19:00  ○: 2人  △: 2人  ×: 2人
```

### 4. 管理機能

作成者は「編集」ボタンから以下が可能：
- **タイトル・説明の編集**: 基本情報の変更
- **日程の編集**: 一括更新、追加、削除（既存の投票を保持）
- **締切日の設定・変更**: 自動締切機能
- **締め切る/再開**: 手動での受付管理
- **削除**: 日程調整の完全削除

### 5. その他の機能

- **最適日程の自動判定**: ⭐マークで表示
- **CSV エクスポート**: 結果をダウンロード
- **詳細表示切り替え**: 簡易/詳細表示の切り替え
- **ページネーション**: 30件以上の日程に対応

## 技術アーキテクチャ

### スタック

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **Database**: Cloudflare D1 (SQLite)
- **Discord**: discord-interactions library
- **Test**: Vitest
- **Deploy**: Wrangler

### データモデル

```typescript
interface Schedule {
  id: string;
  title: string;
  description?: string;
  dates: ScheduleDate[];
  createdBy: User;
  channelId: string;
  messageId?: string;
  createdAt: Date;
  updatedAt: Date;
  deadline?: Date;
  status: 'open' | 'closed';
}

interface ScheduleDate {
  id: string;
  datetime: string;
}

interface Response {
  scheduleId: string;
  userId: string;
  userName: string;
  responses: DateResponse[];
  comment?: string;
  updatedAt: Date;
}

interface DateResponse {
  dateId: string;
  status: 'yes' | 'maybe' | 'no';
  comment?: string;
}
```

## インタラクションフロー

### 1. 作成フロー

```
User → /choseichan create → モーダル表示
     ↓
モーダル入力（タイトル、説明、日程、締切）
     ↓
Schedule作成 → D1保存
     ↓
Embed付きメッセージ送信（ボタン付き）
```

### 2. 回答フロー

#### セレクトメニュー方式（推奨）
```
User → 「回答する」ボタンクリック
     ↓
セレクトメニュー表示（各日程の選択肢）
     ↓
各日程を選択（○/△/×/未回答）
     ↓
DEFERRED_UPDATE_MESSAGE送信（3秒制限対策）
     ↓
Response保存 → メイン画面更新
     ↓
確認メッセージ（エフェメラル）
```

#### ダイレクト投票方式
```
User → 日程横の○/△/×ボタンクリック
     ↓
該当日程の状態をトグル
     ↓
Response更新 → メイン画面更新
     ↓
確認メッセージ（エフェメラル）
```

### 3. 編集フロー

```
作成者 → 「編集」ボタン → 編集メニュー表示
     ↓
編集項目選択（タイトル、日程、締切等）
     ↓
モーダル表示 → 内容編集
     ↓
既存日程のID保持（投票データ維持）
     ↓
Schedule更新 → メイン画面更新
```

### 4. 日程更新時の投票データ保持

```
日程更新リクエスト
     ↓
既存日程との比較
     ↓
同一テキストの日程 → ID保持（投票維持）
新規日程 → 新規ID作成
削除された日程 → 投票データ削除
     ↓
メッセージで変更内容を通知
```

### 5. パフォーマンス最適化

```
重い処理（メイン画面更新等）
     ↓
Promise.race([
  更新処理,
  1秒タイムアウト
])
     ↓
レスポンス送信（3秒以内）
     ↓
残りの処理はwaitUntilで継続
```

## セキュリティ考慮事項

- Discord 署名検証
- レート制限
- 権限チェック（作成者のみが締切・削除可能）

## 実装優先順位

1. 基本的な作成・回答機能
2. リアルタイム更新
3. 締切・リマインダー機能
4. エクスポート機能

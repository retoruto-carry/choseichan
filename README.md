# Discord 調整ちゃん 🗾

Discord サーバー内で簡単に日程調整ができるボットです。調整さんライクな機能を Discord 内で完結させることができます。

## ✨ 特徴

- 📝 **シンプルな日程調整作成** - モーダルフォームで直感的に作成
- 🗳️ **○△× の 3 段階評価** - わかりやすい回答システム
- 📊 **リアルタイム集計** - 回答状況を即座に反映
- ⏰ **自動リマインダー** - 締切前に自動でお知らせ
- 🔒 **プライバシー重視** - 回答者の情報は最小限に
- 🚀 **高速レスポンス** - Cloudflare Workers で世界中から高速アクセス

## セットアップ

### 🤖 ボットの追加

[こちらのリンク](https://discord.com/api/oauth2/authorize?client_id=1392384546560802947&permissions=2147485696&scope=bot%20applications.commands)からDiscordサーバーにボットを追加してください。

### 📋 使い方

#### コマンド一覧

- `/choseichan create` - 新しい日程調整を作成
- `/choseichan list` - このチャンネルの日程調整一覧を表示
- `/choseichan help` - ヘルプを表示

#### 日程調整の流れ

1. `/choseichan create` コマンドを実行
2. フォームに以下を入力:
   - タイトル（必須）
   - 説明（任意）
   - 日程候補（改行区切り）
   - 締切日時（任意）
3. 作成されたメッセージの「回答する」ボタンから投票
4. 「状況を見る」ボタンで集計結果を確認

## 🚀 デプロイ方法

### 必要なもの

- [Node.js](https://nodejs.org/) (v18 以上)
- [Cloudflare アカウント](https://dash.cloudflare.com/sign-up)
- [Discord アプリケーション](https://discord.com/developers/applications)

### セットアップ手順

1. リポジトリをクローン
```bash
git clone https://github.com/retca/discord-choseisan.git
cd discord-choseisan
```

2. 依存関係をインストール
```bash
npm install
```

3. 環境変数を設定
```bash
cp wrangler.toml.example wrangler.toml
# wrangler.toml を編集して必要な値を設定
```

4. D1 データベースを作成
```bash
wrangler d1 create discord-choseisan-db
```

5. マイグレーションを実行
```bash
wrangler d1 execute discord-choseisan-db --file=./migrations/0001_initial_schema.sql
```

6. デプロイ
```bash
npm run deploy
```

7. Discord コマンドを登録
```bash
npm run register-commands
```

詳細なセットアップガイドは [docs/DEPLOY.md](docs/DEPLOY.md) を参照してください。

## 🛠️ 技術スタック

- **ランタイム**: Cloudflare Workers (エッジコンピューティング)
- **言語**: TypeScript (strict mode)
- **アーキテクチャ**: Clean Architecture (Onion Architecture)
- **データベース**: Cloudflare D1 (SQLite)
- **テスト**: Vitest (470+ テスト)
- **コード品質**: Biome

詳細なアーキテクチャについては [ARCHITECTURE.md](ARCHITECTURE.md) を参照してください。

## 📖 ドキュメント

- [アーキテクチャ](ARCHITECTURE.md) - システム設計の詳細
- [デプロイガイド](docs/DEPLOY.md) - 詳細なセットアップ手順
- [開発者向けガイド](CLAUDE.md) - AI アシスタント向けの開発ガイド
- [貢献ガイド](docs/CONTRIBUTING.md) - コントリビューション方法
- [スケーラビリティ](docs/SCALABILITY.md) - パフォーマンスとスケールの詳細

## 🤝 貢献

プルリクエストや Issue の作成を歓迎します！詳しくは [CONTRIBUTING.md](docs/CONTRIBUTING.md) をご覧ください。

## 📝 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照してください。

## 🙏 謝辞

このプロジェクトは以下の素晴らしいツール・サービスを使用しています：

- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Discord.js](https://discord.js.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vitest](https://vitest.dev/)
- [Biome](https://biomejs.dev/)

---

Made with ❤️ by the Discord 調整ちゃん team
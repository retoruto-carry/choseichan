# Discord 調整ちゃん - Landing Pages

このディレクトリにはDiscord調整ちゃんのランディングページが含まれています。

## デプロイ方法

### Option 1: Cloudflare Pages (推奨)

1. [Cloudflare Pages](https://pages.cloudflare.com/)にログイン
2. 新しいプロジェクトを作成
3. GitHubリポジトリを接続
4. ビルド設定：
   - ビルドコマンド: なし（静的ファイルのみ）
   - ビルド出力ディレクトリ: `pages`
5. デプロイ

### Option 2: GitHub Pages

1. リポジトリの Settings → Pages
2. Source: Deploy from a branch
3. Branch: main, /pages
4. Save

## ファイル構成

- `index.html` - ランディングページ
- `privacy.html` - プライバシーポリシー
- `terms.html` - 利用規約

## カスタマイズ

Discord Application IDは既に設定済みです（1392384546560802947）。

必要に応じて、`index.html`内のリンクを更新できます。
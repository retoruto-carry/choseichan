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

`index.html`内の`YOUR_CLIENT_ID`を実際のDiscordアプリケーションIDに置き換えてください。

```html
<a href="https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2147485696&scope=bot%20applications.commands">
```

または、URLパラメータで動的に設定：
```
https://your-domain.pages.dev/?client_id=123456789
```
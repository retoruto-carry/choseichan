# Contributing to Discord 調整ちゃん

Discord 調整ちゃんへの貢献を検討いただきありがとうございます！

## 貢献の方法

### バグ報告

バグを見つけた場合は、GitHub の Issues で報告してください。以下の情報を含めていただけると助かります：

- バグの詳細な説明
- 再現手順
- 期待される動作
- 実際の動作
- スクリーンショット（可能であれば）
- 環境情報（Discord 版、ブラウザなど）

### 機能要望

新機能のアイデアがある場合は、Issues で提案してください：

- 機能の詳細な説明
- なぜその機能が必要か
- 実装のアイデア（あれば）

### プルリクエスト

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'feat: Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 開発環境のセットアップ

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/discord-choseisan.git
cd discord-choseisan

# 依存関係をインストール
npm install

# 環境変数を設定
cp .env.example .env
# .envファイルを編集して必要な値を設定

# 開発サーバーを起動
npm run dev
```

## コーディング規約

### TypeScript

- 厳格な型チェックを使用
- `any`型の使用は避ける
- インターフェースと型エイリアスを適切に使い分ける

### コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/)に従ってください：

- `feat:` 新機能
- `fix:` バグ修正
- `docs:` ドキュメントのみの変更
- `style:` コードの意味に影響を与えない変更
- `refactor:` バグ修正や機能追加ではないコード変更
- `test:` テストの追加や修正
- `chore:` ビルドプロセスやツールの変更

例：

```
feat: 日程調整のリマインダー機能を追加
fix: セレクトメニューのタイムアウトエラーを修正
docs: READMEに使用例を追加
```

### コードスタイル

- インデント：スペース 2 つ
- セミコロン：なし
- クォート：シングルクォート
- 行末の空白：削除
- ファイル末尾の改行：あり

### ファイル構成

新しいハンドラーや機能を追加する場合：

1. 適切なディレクトリに配置

   - ハンドラー: `src/handlers/`
   - サービス: `src/services/`
   - ユーティリティ: `src/utils/`
   - 型定義: `src/types/`

2. 機能別にファイルを分割

   - 1 つのファイルが大きくなりすぎないように
   - 関連する機能はグループ化

3. エクスポート/インポートを整理
   - 名前付きエクスポートを優先
   - バレルエクスポートは避ける

## テスト

### テストの実行

```bash
# すべてのテストを実行
npm test

# ウォッチモードで実行
npm run test:watch

# カバレッジレポート付きで実行
npm run test:coverage
```

### テストの書き方

- 各機能に対してユニットテストを作成
- エッジケースを考慮
- モックは最小限に
- テストファイルは対象ファイルと同じ構造で`tests/`に配置

例：

```typescript
describe("handleVoteButton", () => {
  it("should save user response correctly", async () => {
    // Arrange
    const interaction = createMockInteraction();
    const storage = createMockStorage();

    // Act
    const response = await handleVoteButton(
      interaction,
      storage,
      ["schedule1", "date1", "yes"],
      env
    );

    // Assert
    expect(response.status).toBe(200);
    expect(storage.saveResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleId: "schedule1",
        responses: expect.arrayContaining([
          expect.objectContaining({ dateId: "date1", status: "yes" }),
        ]),
      })
    );
  });
});
```

## Discord API

### インタラクション処理

- 3 秒以内に応答を返す（Cloudflare Workers 制限）
- 重い処理は`DEFERRED_UPDATE_MESSAGE`を使用
- エフェメラルメッセージを適切に使用

### コンポーネント制限

- メッセージあたり最大 5 行
- 1 行あたり最大 5 コンポーネント
- セレクトメニューのオプションは最大 25 個

## デプロイ前のチェックリスト

- [ ] すべてのテストが通る
- [ ] 型チェックが通る (`npm run typecheck`)
- [ ] ローカルで動作確認済み
- [ ] 必要なドキュメントを更新
- [ ] CHANGELOG を更新

## 質問・サポート

質問がある場合は、以下の方法でお問い合わせください：

- GitHub Issues
- Discord サーバー（もしあれば）

## ライセンス

このプロジェクトに貢献することで、あなたの貢献が MIT ライセンスの下でライセンスされることに同意したものとみなされます。

# D1 Database Migrations

このディレクトリには、Discord調整ちゃんのD1データベースマイグレーションファイルが含まれています。

## マイグレーションファイルの命名規則

```
NNNN_YYYYMMDD_description.sql
```

- `NNNN`: 4桁の連番（0001から開始）
- `YYYYMMDD`: マイグレーション作成日
- `description`: マイグレーションの内容を表す説明的な名前

## マイグレーションの実行

### 本番環境へのマイグレーション

```bash
# すべての未適用マイグレーションを実行
wrangler d1 migrations apply discord-choseisan-db

# 特定のマイグレーションを実行
wrangler d1 execute discord-choseisan-db --file=./migrations/0001_20240115_initial_schema.sql
```

### ローカル環境でのマイグレーション

```bash
# ローカルD1データベースへマイグレーションを適用
wrangler d1 migrations apply discord-choseisan-db --local
```

### マイグレーション状態の確認

```bash
# 未適用のマイグレーションを確認
wrangler d1 migrations list discord-choseisan-db

# 適用済みマイグレーションを確認
wrangler d1 execute discord-choseisan-db --command="SELECT * FROM d1_migrations"
```

## ベストプラクティス

1. **外部キー制約の処理**
   - テーブルを変更する際は `PRAGMA defer_foreign_keys = true` を使用
   - マイグレーション完了後は必ず `PRAGMA defer_foreign_keys = false` でリセット

2. **マイグレーションの順序**
   - 依存関係を考慮してテーブルを作成/削除
   - 削除時は依存関係の逆順で実行

3. **インデックスの作成**
   - 外部キーには必ずインデックスを作成
   - よく使用されるクエリパターンに合わせて複合インデックスを追加

4. **トランザクションの考慮**
   - D1は各SQLステートメントを自動的にトランザクションで実行
   - 複数のステートメントをバッチで実行する場合は、エラーハンドリングを適切に行う

## 現在のマイグレーション

1. `0001_20240115_initial_schema.sql` - 初期スキーマの作成
2. `0002_20240116_cleanup_expired_data.sql` - 期限切れデータのクリーンアップ
3. `0003_20240117_foreign_key_optimization.sql` - 外部キー関連の最適化
# D1データベースへの移行手順

## 1. D1データベースの作成

```bash
# D1データベースを作成
wrangler d1 create discord-choseisan-db

# 出力されたdatabase_idをメモしておく
```

## 2. wrangler.tomlの更新

```toml
# D1 Database configuration
[[d1_databases]]
binding = "DB"
database_name = "discord-choseisan-db"
database_id = "your-database-id-here"

# 環境変数でデータベースタイプを指定
[vars]
DATABASE_TYPE = "d1"  # "kv" または "d1"
```

## 3. マイグレーションの実行

```bash
# 初期スキーマの適用
wrangler d1 execute discord-choseisan-db --file=./migrations/0001_initial_schema.sql

# ローカル開発環境でテスト
wrangler d1 execute discord-choseisan-db --local --file=./migrations/0001_initial_schema.sql
```

## 4. デプロイ

```bash
# 環境変数を設定してデプロイ
wrangler deploy --var DATABASE_TYPE:d1
```

## 5. 切り替えテスト

### KVモードでテスト
```bash
wrangler deploy --var DATABASE_TYPE:kv
```

### D1モードでテスト
```bash
wrangler deploy --var DATABASE_TYPE:d1
```

## 6. データ移行（必要な場合）

KVからD1への移行スクリプトは別途作成が必要です。

## 7. 期限切れデータのクリーンアップ（定期実行）

```bash
# Cron jobで定期的に実行
wrangler d1 execute discord-choseisan-db --file=./migrations/0002_cleanup_expired_data.sql
```

## トラブルシューティング

### D1が認識されない場合
- wranglerのバージョンを確認: `wrangler --version`
- 最新版にアップデート: `npm install -g wrangler@latest`

### マイグレーションエラー
- SQLiteの構文を確認
- D1はSQLiteベースなので、MySQLやPostgreSQLの構文は使えません

### パフォーマンスの問題
- インデックスが適切に作成されているか確認
- `EXPLAIN QUERY PLAN` でクエリプランを確認
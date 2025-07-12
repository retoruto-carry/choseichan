/**
 * リポジトリ層のエラークラス（Infrastructure層）
 *
 * これらはデータアクセス技術固有のエラーであり、
 * Domain層から分離してInfrastructure層に配置
 */

/**
 * リポジトリエラーの基底クラス
 */
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

/**
 * エンティティが見つからない場合のエラー
 */
export class NotFoundError extends RepositoryError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, 'NOT_FOUND');
  }
}

/**
 * データ競合やユニーク制約違反のエラー
 */
export class ConflictError extends RepositoryError {
  constructor(message: string) {
    super(message, 'CONFLICT');
  }
}

/**
 * トランザクション処理でのエラー
 */
export class TransactionError extends RepositoryError {
  constructor(message: string, originalError?: Error) {
    super(message, 'TRANSACTION_ERROR', originalError);
  }
}

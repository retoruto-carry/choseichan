/**
 * Error Response Factory
 * 
 * エラーレスポンス作成の標準化ファクトリー
 * 一貫性のあるエラーハンドリングとレスポンス形式を提供
 */

import { ApplicationError } from '../../application/errors/ApplicationErrors';

// エラーコード定数
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export interface ErrorResponse {
  success: false;
  error: string;
  errorCode?: string;
  statusCode: number;
  context?: Record<string, unknown>;
}

export class ErrorResponseFactory {
  /**
   * エラーから適切なレスポンスを作成
   */
  static create(error: unknown, defaultMessage = 'Internal server error'): ErrorResponse {
    if (error instanceof ApplicationError) {
      return {
        success: false,
        error: error.message,
        errorCode: error.code,
        statusCode: error.statusCode,
        context: error.details,
      };
    }

    if (error instanceof Error) {
      return {
        success: false,
        error: this.sanitizeErrorMessage(error.message),
        statusCode: 500,
      };
    }

    return {
      success: false,
      error: defaultMessage,
      statusCode: 500,
    };
  }

  /**
   * Discord Interaction用のエラーレスポンス作成
   */
  static createDiscordResponse(error: unknown): {
    content: string;
    flags?: number;
  } {
    const errorResponse = this.create(error);
    
    return {
      content: `❌ ${errorResponse.error}`,
      flags: 64, // EPHEMERAL
    };
  }

  /**
   * バリデーションエラー用のレスポンス作成
   */
  static createValidationError(
    message: string,
    field?: string,
    value?: unknown
  ): ErrorResponse {
    return {
      success: false,
      error: message,
      errorCode: ErrorCode.VALIDATION_ERROR,
      statusCode: 400,
      context: field ? { field, value } : undefined,
    };
  }

  /**
   * 認証エラー用のレスポンス作成
   */
  static createAuthorizationError(message = 'Unauthorized'): ErrorResponse {
    return {
      success: false,
      error: message,
      errorCode: ErrorCode.UNAUTHORIZED,
      statusCode: 401,
    };
  }

  /**
   * リソースが見つからない場合のエラーレスポンス作成
   */
  static createNotFoundError(
    resource: string,
    id?: string
  ): ErrorResponse {
    const message = id 
      ? `${resource} with ID '${id}' not found`
      : `${resource} not found`;

    return {
      success: false,
      error: message,
      errorCode: ErrorCode.NOT_FOUND,
      statusCode: 404,
      context: { resource, id },
    };
  }

  /**
   * レート制限エラー用のレスポンス作成
   */
  static createRateLimitError(
    retryAfter?: number
  ): ErrorResponse {
    return {
      success: false,
      error: 'Rate limit exceeded',
      errorCode: ErrorCode.RATE_LIMIT_EXCEEDED,
      statusCode: 429,
      context: retryAfter ? { retryAfter } : undefined,
    };
  }

  /**
   * エラーコードからHTTPステータスコードを取得
   */
  private static getStatusCodeFromErrorCode(errorCode: string): number {
    switch (errorCode) {
      case ErrorCode.VALIDATION_ERROR:
        return 400;
      case ErrorCode.UNAUTHORIZED:
        return 401;
      case ErrorCode.FORBIDDEN:
        return 403;
      case ErrorCode.NOT_FOUND:
        return 404;
      case ErrorCode.CONFLICT:
        return 409;
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return 429;
      case ErrorCode.EXTERNAL_SERVICE_ERROR:
        return 502;
      case ErrorCode.SERVICE_UNAVAILABLE:
        return 503;
      default:
        return 500;
    }
  }

  /**
   * エラーメッセージをサニタイズ（機密情報の除去）
   */
  private static sanitizeErrorMessage(message: string): string {
    // 機密情報のパターンをマスク
    return message
      .replace(/token[=:]\s*[a-zA-Z0-9_-]+/gi, 'token=***')
      .replace(/password[=:]\s*\S+/gi, 'password=***')
      .replace(/key[=:]\s*[a-zA-Z0-9_-]+/gi, 'key=***')
      .replace(/secret[=:]\s*[a-zA-Z0-9_-]+/gi, 'secret=***');
  }
}
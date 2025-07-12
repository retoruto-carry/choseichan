/**
 * アプリケーション層エラー型
 *
 * アプリケーション層のエラー定義
 * ユースケースの実行で発生するエラーを管理
 */

export abstract class ApplicationError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

// ユースケースエラー
export class UseCaseValidationError extends ApplicationError {
  readonly code = 'USE_CASE_VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(message: string, useCase?: string) {
    super(message, { useCase });
  }
}

export class UseCaseExecutionError extends ApplicationError {
  readonly code = 'USE_CASE_EXECUTION_ERROR';
  readonly statusCode = 500;

  constructor(message: string, useCase: string, cause?: Error) {
    super(message, { useCase, cause: cause?.message });
  }
}

export class ConcurrencyError extends ApplicationError {
  readonly code = 'CONCURRENCY_ERROR';
  readonly statusCode = 409;

  constructor(resource: string, operation: string) {
    super(`Concurrent modification detected for ${resource} during ${operation}`, {
      resource,
      operation,
    });
  }
}

// データ転送エラー
export class MappingError extends ApplicationError {
  readonly code = 'MAPPING_ERROR';
  readonly statusCode = 500;

  constructor(from: string, to: string, cause?: Error) {
    super(`Failed to map from ${from} to ${to}`, { from, to, cause: cause?.message });
  }
}

export class SerializationError extends ApplicationError {
  readonly code = 'SERIALIZATION_ERROR';
  readonly statusCode = 500;

  constructor(data: string, format: string, cause?: Error) {
    super(`Failed to serialize ${data} to ${format}`, { data, format, cause: cause?.message });
  }
}

// 外部サービスエラー
export class ExternalServiceError extends ApplicationError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;

  constructor(service: string, operation: string, cause?: Error) {
    super(`External service error: ${service} during ${operation}`, {
      service,
      operation,
      cause: cause?.message,
    });
  }
}

export class RateLimitError extends ApplicationError {
  readonly code = 'RATE_LIMIT_ERROR';
  readonly statusCode = 429;

  constructor(service: string, retryAfter?: number) {
    super(`Rate limit exceeded for ${service}`, { service, retryAfter });
  }
}

// 統合エラー
export class IntegrationError extends ApplicationError {
  readonly code = 'INTEGRATION_ERROR';
  readonly statusCode = 502;

  constructor(integration: string, operation: string, cause?: Error) {
    super(`Integration error with ${integration} during ${operation}`, {
      integration,
      operation,
      cause: cause?.message,
    });
  }
}

// 設定エラー
export class ConfigurationError extends ApplicationError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly statusCode = 500;

  constructor(setting: string, value?: string) {
    super(`Configuration error: ${setting}`, { setting, value });
  }
}

// タイムアウトエラー
export class TimeoutError extends ApplicationError {
  readonly code = 'TIMEOUT_ERROR';
  readonly statusCode = 504;

  constructor(operation: string, timeout: number) {
    super(`Operation timed out: ${operation} after ${timeout}ms`, { operation, timeout });
  }
}

// エラーファクトリ関数
export function createUseCaseValidationError(message: string, useCase?: string): UseCaseValidationError {
  return new UseCaseValidationError(message, useCase);
}

export function createUseCaseExecutionError(message: string, useCase: string, cause?: Error): UseCaseExecutionError {
  return new UseCaseExecutionError(message, useCase, cause);
}

export function createConcurrencyError(resource: string, operation: string): ConcurrencyError {
  return new ConcurrencyError(resource, operation);
}

export function createMappingError(from: string, to: string, cause?: Error): MappingError {
  return new MappingError(from, to, cause);
}

export function createSerializationError(data: string, format: string, cause?: Error): SerializationError {
  return new SerializationError(data, format, cause);
}

export function createExternalServiceError(service: string, operation: string, cause?: Error): ExternalServiceError {
  return new ExternalServiceError(service, operation, cause);
}

export function createRateLimitError(service: string, retryAfter?: number): RateLimitError {
  return new RateLimitError(service, retryAfter);
}

export function createIntegrationError(integration: string, operation: string, cause?: Error): IntegrationError {
  return new IntegrationError(integration, operation, cause);
}

export function createConfigurationError(setting: string, value?: string): ConfigurationError {
  return new ConfigurationError(setting, value);
}

export function createTimeoutError(operation: string, timeout: number): TimeoutError {
  return new TimeoutError(operation, timeout);
}

// 型ガード
export function isApplicationError(error: unknown): error is ApplicationError {
  return error instanceof ApplicationError;
}

export function isUseCaseError(
  error: unknown
): error is UseCaseValidationError | UseCaseExecutionError {
  return error instanceof UseCaseValidationError || error instanceof UseCaseExecutionError;
}

export function isExternalError(error: unknown): error is ExternalServiceError | IntegrationError {
  return error instanceof ExternalServiceError || error instanceof IntegrationError;
}

export function isTemporaryError(error: unknown): boolean {
  return (
    error instanceof RateLimitError ||
    error instanceof TimeoutError ||
    error instanceof ConcurrencyError ||
    error instanceof ExternalServiceError
  );
}

export function isRetryableError(error: unknown): boolean {
  return (
    error instanceof RateLimitError ||
    error instanceof TimeoutError ||
    error instanceof ExternalServiceError ||
    error instanceof IntegrationError
  );
}

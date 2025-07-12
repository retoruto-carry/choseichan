/**
 * Infrastructure Layer Error Types
 *
 * インフラストラクチャ層のエラー定義
 * 外部依存関係（データベース、API、ファイルシステムなど）のエラーを管理
 */

export abstract class InfrastructureError extends Error {
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

// Database Errors
export class DatabaseConnectionError extends InfrastructureError {
  readonly code = 'DATABASE_CONNECTION_ERROR';
  readonly statusCode = 503;

  constructor(database: string, cause?: Error) {
    super(`Failed to connect to database: ${database}`, { database, cause: cause?.message });
  }
}

export class DatabaseQueryError extends InfrastructureError {
  readonly code = 'DATABASE_QUERY_ERROR';
  readonly statusCode = 500;

  constructor(query: string, cause?: Error) {
    super(`Database query failed: ${query}`, { query, cause: cause?.message });
  }
}

export class DatabaseTransactionError extends InfrastructureError {
  readonly code = 'DATABASE_TRANSACTION_ERROR';
  readonly statusCode = 500;

  constructor(operation: string, cause?: Error) {
    super(`Database transaction failed: ${operation}`, { operation, cause: cause?.message });
  }
}

export class DatabaseConstraintError extends InfrastructureError {
  readonly code = 'DATABASE_CONSTRAINT_ERROR';
  readonly statusCode = 409;

  constructor(constraint: string, table?: string) {
    super(`Database constraint violation: ${constraint}`, { constraint, table });
  }
}

// HTTP/API Errors
export class HttpRequestError extends InfrastructureError {
  readonly code = 'HTTP_REQUEST_ERROR';
  readonly statusCode: number;

  constructor(url: string, status: number, statusText?: string) {
    super(`HTTP request failed: ${status} ${statusText || ''} for ${url}`, {
      url,
      status,
      statusText,
    });
    this.statusCode = status;
  }
}

export class ApiResponseError extends InfrastructureError {
  readonly code = 'API_RESPONSE_ERROR';
  readonly statusCode = 502;

  constructor(api: string, message: string, status?: number) {
    super(`API response error from ${api}: ${message}`, { api, status });
  }
}

export class AuthenticationError extends InfrastructureError {
  readonly code = 'AUTHENTICATION_ERROR';
  readonly statusCode = 401;

  constructor(service: string, reason?: string) {
    super(`Authentication failed for ${service}`, { service, reason });
  }
}

export class AuthorizationError extends InfrastructureError {
  readonly code = 'AUTHORIZATION_ERROR';
  readonly statusCode = 403;

  constructor(service: string, action: string) {
    super(`Authorization failed for ${action} on ${service}`, { service, action });
  }
}

// Storage Errors
export class FileNotFoundError extends InfrastructureError {
  readonly code = 'FILE_NOT_FOUND_ERROR';
  readonly statusCode = 404;

  constructor(path: string) {
    super(`File not found: ${path}`, { path });
  }
}

export class FileAccessError extends InfrastructureError {
  readonly code = 'FILE_ACCESS_ERROR';
  readonly statusCode = 403;

  constructor(path: string, operation: string) {
    super(`File access denied: ${operation} on ${path}`, { path, operation });
  }
}

export class StorageError extends InfrastructureError {
  readonly code = 'STORAGE_ERROR';
  readonly statusCode = 500;

  constructor(operation: string, cause?: Error) {
    super(`Storage operation failed: ${operation}`, { operation, cause: cause?.message });
  }
}

// Network Errors
export class NetworkError extends InfrastructureError {
  readonly code = 'NETWORK_ERROR';
  readonly statusCode = 503;

  constructor(operation: string, cause?: Error) {
    super(`Network error during ${operation}`, { operation, cause: cause?.message });
  }
}

export class ConnectivityError extends InfrastructureError {
  readonly code = 'CONNECTIVITY_ERROR';
  readonly statusCode = 503;

  constructor(service: string, endpoint?: string) {
    super(`Connectivity error to ${service}`, { service, endpoint });
  }
}

// Cache Errors
export class CacheError extends InfrastructureError {
  readonly code = 'CACHE_ERROR';
  readonly statusCode = 500;

  constructor(operation: string, key?: string, cause?: Error) {
    super(`Cache operation failed: ${operation}`, { operation, key, cause: cause?.message });
  }
}

// Discord-specific Errors
export class DiscordApiError extends InfrastructureError {
  readonly code = 'DISCORD_API_ERROR';
  readonly statusCode: number;

  constructor(endpoint: string, status: number, message?: string) {
    super(`Discord API error: ${status} on ${endpoint}`, {
      endpoint,
      status,
      discordMessage: message,
    });
    this.statusCode = status >= 400 && status < 500 ? status : 502;
  }
}

export class DiscordRateLimitError extends InfrastructureError {
  readonly code = 'DISCORD_RATE_LIMIT_ERROR';
  readonly statusCode = 429;

  constructor(endpoint: string, retryAfter: number) {
    super(`Discord rate limit exceeded for ${endpoint}`, { endpoint, retryAfter });
  }
}

export class DiscordWebhookError extends InfrastructureError {
  readonly code = 'DISCORD_WEBHOOK_ERROR';
  readonly statusCode = 502;

  constructor(webhookId: string, cause?: Error) {
    super(`Discord webhook error: ${webhookId}`, { webhookId, cause: cause?.message });
  }
}

// Configuration/Environment Errors
export class EnvironmentError extends InfrastructureError {
  readonly code = 'ENVIRONMENT_ERROR';
  readonly statusCode = 500;

  constructor(variable: string, expected?: string) {
    super(`Environment variable error: ${variable}`, { variable, expected });
  }
}

export class ServiceUnavailableError extends InfrastructureError {
  readonly code = 'SERVICE_UNAVAILABLE_ERROR';
  readonly statusCode = 503;

  constructor(service: string, reason?: string) {
    super(`Service unavailable: ${service}`, { service, reason });
  }
}

// Error Factory
export class InfrastructureErrorFactory {
  static databaseConnection(database: string, cause?: Error): DatabaseConnectionError {
    return new DatabaseConnectionError(database, cause);
  }

  static databaseQuery(query: string, cause?: Error): DatabaseQueryError {
    return new DatabaseQueryError(query, cause);
  }

  static databaseTransaction(operation: string, cause?: Error): DatabaseTransactionError {
    return new DatabaseTransactionError(operation, cause);
  }

  static databaseConstraint(constraint: string, table?: string): DatabaseConstraintError {
    return new DatabaseConstraintError(constraint, table);
  }

  static httpRequest(url: string, status: number, statusText?: string): HttpRequestError {
    return new HttpRequestError(url, status, statusText);
  }

  static apiResponse(api: string, message: string, status?: number): ApiResponseError {
    return new ApiResponseError(api, message, status);
  }

  static authentication(service: string, reason?: string): AuthenticationError {
    return new AuthenticationError(service, reason);
  }

  static authorization(service: string, action: string): AuthorizationError {
    return new AuthorizationError(service, action);
  }

  static discordApi(endpoint: string, status: number, message?: string): DiscordApiError {
    return new DiscordApiError(endpoint, status, message);
  }

  static discordRateLimit(endpoint: string, retryAfter: number): DiscordRateLimitError {
    return new DiscordRateLimitError(endpoint, retryAfter);
  }

  static environment(variable: string, expected?: string): EnvironmentError {
    return new EnvironmentError(variable, expected);
  }

  static serviceUnavailable(service: string, reason?: string): ServiceUnavailableError {
    return new ServiceUnavailableError(service, reason);
  }
}

// Type Guards
export function isInfrastructureError(error: unknown): error is InfrastructureError {
  return error instanceof InfrastructureError;
}

export function isDatabaseError(
  error: unknown
): error is
  | DatabaseConnectionError
  | DatabaseQueryError
  | DatabaseTransactionError
  | DatabaseConstraintError {
  return (
    error instanceof DatabaseConnectionError ||
    error instanceof DatabaseQueryError ||
    error instanceof DatabaseTransactionError ||
    error instanceof DatabaseConstraintError
  );
}

export function isHttpError(error: unknown): error is HttpRequestError | ApiResponseError {
  return error instanceof HttpRequestError || error instanceof ApiResponseError;
}

export function isDiscordError(
  error: unknown
): error is DiscordApiError | DiscordRateLimitError | DiscordWebhookError {
  return (
    error instanceof DiscordApiError ||
    error instanceof DiscordRateLimitError ||
    error instanceof DiscordWebhookError
  );
}

export function isRetryableInfrastructureError(error: unknown): boolean {
  return (
    error instanceof NetworkError ||
    error instanceof ConnectivityError ||
    error instanceof ServiceUnavailableError ||
    error instanceof DiscordRateLimitError ||
    (error instanceof HttpRequestError && error.statusCode >= 500)
  );
}

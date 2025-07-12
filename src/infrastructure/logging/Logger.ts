/**
 * 構造化ログシステム
 *
 * Clean Architectureに適したログシステム
 * Cloudflare Workersでの実行を想定した軽量なロガー
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogContext {
  userId?: string;
  guildId?: string;
  scheduleId?: string;
  interaction?: string;
  useCase?: string;
  operation?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

export interface ILogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error, context?: LogContext): void;
  fatal(message: string, error?: Error, context?: LogContext): void;
}

export class Logger implements ILogger {
  private readonly minLevel: LogLevel;
  private readonly serviceName: string;

  constructor(serviceName: string = 'discord-choseisan', minLevel: LogLevel = LogLevel.INFO) {
    this.serviceName = serviceName;
    this.minLevel = minLevel;
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  fatal(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.FATAL, message, context, error);
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (level < this.minLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      context: {
        service: this.serviceName,
        ...context,
      },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: 'code' in error && typeof error.code === 'string' ? error.code : undefined,
      };
    }

    // Cloudflare Workersではconsole.logを使用
    const output = JSON.stringify(entry);

    switch (level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(output);
        break;
    }
  }
}

// シングルトンロガーインスタンス
let loggerInstance: Logger | null = null;

export function getLogger(): Logger {
  if (!loggerInstance) {
    // Workers環境では process.env は使用できないため、デフォルト値を使用
    loggerInstance = new Logger('discord-choseisan', LogLevel.INFO);
  }
  return loggerInstance;
}

// テスト用のロガーリセット
export function resetLogger(): void {
  loggerInstance = null;
}

// 自動ログ記録用デコレーター
export function LogExecution(operation?: string) {
  return <T extends Record<string, (...args: unknown[]) => Promise<unknown>>>(
    target: T,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) => {
    const method = descriptor.value;

    descriptor.value = async function <TArgs extends unknown[]>(...args: TArgs) {
      const logger = getLogger();
      const startTime = Date.now();
      const operationName = operation || `${target.constructor.name}.${propertyName}`;

      logger.info(`Starting operation: ${operationName}`, {
        operation: operationName,
        useCase: target.constructor.name,
      });

      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;

        logger.info(`Operation completed: ${operationName}`, {
          operation: operationName,
          useCase: target.constructor.name,
          duration,
          success: true,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        logger.error(
          `Operation failed: ${operationName}`,
          error instanceof Error ? error : new Error(String(error)),
          {
            operation: operationName,
            useCase: target.constructor.name,
            duration,
            success: false,
          }
        );

        throw error;
      }
    };
  };
}

// パフォーマンス測定ユーティリティ
export class PerformanceLogger {
  private static measurements = new Map<string, number>();

  static start(operation: string): void {
    PerformanceLogger.measurements.set(operation, Date.now());
  }

  static end(operation: string, context?: LogContext): void {
    const startTime = PerformanceLogger.measurements.get(operation);
    if (startTime) {
      const duration = Date.now() - startTime;
      PerformanceLogger.measurements.delete(operation);

      getLogger().info(`Performance: ${operation}`, {
        operation,
        duration,
        ...context,
      });
    }
  }

  static async measure<T>(
    operation: string,
    fn: () => T | Promise<T>,
    context?: LogContext
  ): Promise<T> {
    PerformanceLogger.start(operation);
    try {
      const result = await fn();
      PerformanceLogger.end(operation, context);
      return result;
    } catch (error) {
      PerformanceLogger.end(operation, { ...context, error: true });
      throw error;
    }
  }
}

// 重要なビジネスイベントの監査ログ
export class AuditLogger {
  private static logger = getLogger();

  static scheduleCreated(scheduleId: string, userId: string, guildId: string): void {
    AuditLogger.logger.info('Schedule created', {
      event: 'schedule_created',
      scheduleId,
      userId,
      guildId,
      audit: true,
    });
  }

  static scheduleUpdated(
    scheduleId: string,
    userId: string,
    guildId: string,
    changes: Record<string, unknown>
  ): void {
    AuditLogger.logger.info('Schedule updated', {
      event: 'schedule_updated',
      scheduleId,
      userId,
      guildId,
      changes,
      audit: true,
    });
  }

  static scheduleClosed(scheduleId: string, userId: string, guildId: string): void {
    AuditLogger.logger.info('Schedule closed', {
      event: 'schedule_closed',
      scheduleId,
      userId,
      guildId,
      audit: true,
    });
  }

  static scheduleDeleted(scheduleId: string, userId: string, guildId: string): void {
    AuditLogger.logger.warn('Schedule deleted', {
      event: 'schedule_deleted',
      scheduleId,
      userId,
      guildId,
      audit: true,
    });
  }

  static responseSubmitted(scheduleId: string, userId: string, guildId: string): void {
    AuditLogger.logger.info('Response submitted', {
      event: 'response_submitted',
      scheduleId,
      userId,
      guildId,
      audit: true,
    });
  }

  static reminderSent(scheduleId: string, guildId: string, reminderType: string): void {
    AuditLogger.logger.info('Reminder sent', {
      event: 'reminder_sent',
      scheduleId,
      guildId,
      reminderType,
      audit: true,
    });
  }

  static unauthorizedAccess(
    resource: string,
    userId: string,
    guildId?: string,
    action?: string
  ): void {
    AuditLogger.logger.warn('Unauthorized access attempt', {
      event: 'unauthorized_access',
      resource,
      userId,
      guildId,
      action,
      audit: true,
      security: true,
    });
  }

  static systemError(error: Error, context?: LogContext): void {
    AuditLogger.logger.error('System error occurred', error, {
      event: 'system_error',
      audit: true,
      ...context,
    });
  }
}

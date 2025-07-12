/**
 * Logger Port Interface
 *
 * Application層でのログ出力抽象化
 * Infrastructure層のLogger実装への依存を解消
 */

export interface ILogger {
  info(message: string, meta?: object): void;
  warn(message: string, meta?: object): void;
  error(message: string, error?: Error, meta?: object): void;
  debug(message: string, meta?: object): void;
}

/**
 * Application層でのログ文脈情報
 */
export interface LogContext {
  operation?: string;
  useCase?: string;
  scheduleId?: string;
  userId?: string;
  guildId?: string;
  [key: string]: string | number | boolean | undefined;
}

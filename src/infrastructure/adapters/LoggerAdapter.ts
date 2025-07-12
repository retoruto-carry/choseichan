/**
 * Logger Adapter
 *
 * Application層のILoggerポートの実装
 * Infrastructure層のLoggerを適合
 */

import type { ILogger, LogContext } from '../../application/ports/LoggerPort';
import { getLogger } from '../logging/Logger';

export class LoggerAdapter implements ILogger {
  private logger = getLogger();

  info(message: string, meta?: LogContext): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: LogContext): void {
    this.logger.warn(message, meta);
  }

  error(message: string, error?: Error, meta?: LogContext): void {
    this.logger.error(message, error, meta);
  }

  debug(message: string, meta?: LogContext): void {
    this.logger.debug(message, meta);
  }
}

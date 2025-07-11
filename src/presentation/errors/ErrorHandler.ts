/**
 * Presentation Layer Error Handler
 * 
 * プレゼンテーション層での統一的なエラーハンドリング
 * Discordインタラクションに適したエラーレスポンスを生成
 */

import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { DomainError, isDomainError, isValidationError } from '../../domain/errors/DomainErrors';
import { ApplicationError, isApplicationError, isTemporaryError } from '../../application/errors/ApplicationErrors';
import { InfrastructureError, isInfrastructureError, isDiscordError } from '../../infrastructure/errors/InfrastructureErrors';

export interface ErrorResponse {
  type: InteractionResponseType;
  data: {
    content: string;
    flags?: InteractionResponseFlags;
  };
}

export class ErrorHandler {
  /**
   * エラーをDiscordレスポンスに変換
   */
  static handleError(error: unknown): ErrorResponse {
    // ドメインエラーの処理
    if (isDomainError(error)) {
      return this.handleDomainError(error);
    }

    // アプリケーションエラーの処理
    if (isApplicationError(error)) {
      return this.handleApplicationError(error);
    }

    // インフラストラクチャエラーの処理
    if (isInfrastructureError(error)) {
      return this.handleInfrastructureError(error);
    }

    // 予期しないエラーの処理
    return this.handleUnexpectedError(error);
  }

  /**
   * ドメインエラーの処理
   */
  private static handleDomainError(error: DomainError): ErrorResponse {
    if (isValidationError(error)) {
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `❌ ${error.message}`,
          flags: InteractionResponseFlags.EPHEMERAL
        }
      };
    }

    switch (error.code) {
      case 'SCHEDULE_NOT_FOUND':
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ 指定された日程調整が見つかりません',
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };

      case 'SCHEDULE_ALREADY_CLOSED':
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ この日程調整は既に締め切られています',
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };

      case 'SCHEDULE_PERMISSION_ERROR':
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ この操作を実行する権限がありません',
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };

      case 'RESPONSE_NOT_FOUND':
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ 回答が見つかりません',
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };

      case 'DOMAIN_RULE_VIOLATION':
      case 'BUSINESS_LOGIC_ERROR':
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ ${error.message}`,
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };

      default:
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ エラーが発生しました: ${error.message}`,
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };
    }
  }

  /**
   * アプリケーションエラーの処理
   */
  private static handleApplicationError(error: ApplicationError): ErrorResponse {
    switch (error.code) {
      case 'USE_CASE_VALIDATION_ERROR':
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ 入力値に問題があります: ${error.message}`,
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };

      case 'CONCURRENCY_ERROR':
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ 他のユーザーが同時に編集しています。しばらく待ってから再試行してください',
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };

      case 'RATE_LIMIT_ERROR':
        const retryAfter = error.details?.retryAfter as number;
        const retryMessage = retryAfter ? ` ${Math.ceil(retryAfter / 1000)}秒後に再試行してください` : '';
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ 操作が制限されています。${retryMessage}`,
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };

      case 'TIMEOUT_ERROR':
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ 処理がタイムアウトしました。しばらく待ってから再試行してください',
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };

      case 'EXTERNAL_SERVICE_ERROR':
      case 'INTEGRATION_ERROR':
        if (isTemporaryError(error)) {
          return {
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ 一時的にサービスが利用できません。しばらく待ってから再試行してください',
              flags: InteractionResponseFlags.EPHEMERAL
            }
          };
        }
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ 外部サービスでエラーが発生しました',
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };

      case 'CONFIGURATION_ERROR':
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ システム設定に問題があります。管理者に連絡してください',
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };

      default:
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ アプリケーションエラーが発生しました',
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };
    }
  }

  /**
   * インフラストラクチャエラーの処理
   */
  private static handleInfrastructureError(error: InfrastructureError): ErrorResponse {
    if (isDiscordError(error)) {
      switch (error.code) {
        case 'DISCORD_RATE_LIMIT_ERROR':
          const retryAfter = error.details?.retryAfter as number;
          const retryMessage = retryAfter ? ` ${Math.ceil(retryAfter / 1000)}秒後に再試行してください` : '';
          return {
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `❌ Discord APIの制限に達しました。${retryMessage}`,
              flags: InteractionResponseFlags.EPHEMERAL
            }
          };

        case 'DISCORD_API_ERROR':
          const status = error.details?.status as number;
          if (status === 403) {
            return {
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: '❌ Botに必要な権限がありません。サーバー管理者に連絡してください',
                flags: InteractionResponseFlags.EPHEMERAL
              }
            };
          }
          return {
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ Discord APIでエラーが発生しました',
              flags: InteractionResponseFlags.EPHEMERAL
            }
          };

        default:
          return {
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ Discordとの通信でエラーが発生しました',
              flags: InteractionResponseFlags.EPHEMERAL
            }
          };
      }
    }

    switch (error.code) {
      case 'DATABASE_CONNECTION_ERROR':
      case 'DATABASE_QUERY_ERROR':
      case 'DATABASE_TRANSACTION_ERROR':
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ データベースエラーが発生しました。しばらく待ってから再試行してください',
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };

      case 'AUTHENTICATION_ERROR':
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ 認証に失敗しました。管理者に連絡してください',
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };

      case 'AUTHORIZATION_ERROR':
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ 必要な権限がありません',
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };

      case 'NETWORK_ERROR':
      case 'CONNECTIVITY_ERROR':
      case 'SERVICE_UNAVAILABLE_ERROR':
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ ネットワークエラーが発生しました。しばらく待ってから再試行してください',
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };

      default:
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ システムエラーが発生しました',
            flags: InteractionResponseFlags.EPHEMERAL
          }
        };
    }
  }

  /**
   * 予期しないエラーの処理
   */
  private static handleUnexpectedError(error: unknown): ErrorResponse {
    const message = error instanceof Error ? error.message : '不明なエラー';
    
    // 本番環境では詳細なエラー情報を隠す
    const isProduction = process.env.NODE_ENV === 'production';
    const content = isProduction 
      ? '❌ 予期しないエラーが発生しました。しばらく待ってから再試行してください'
      : `❌ エラーが発生しました: ${message}`;

    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content,
        flags: InteractionResponseFlags.EPHEMERAL
      }
    };
  }

  /**
   * エラーログ用の詳細情報を取得
   */
  static getErrorDetails(error: unknown): Record<string, unknown> {
    if (isDomainError(error) || isApplicationError(error) || isInfrastructureError(error)) {
      return {
        name: error.name,
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details,
        stack: error.stack
      };
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    return {
      error: String(error)
    };
  }

  /**
   * エラーの重要度を判定
   */
  static getErrorSeverity(error: unknown): 'low' | 'medium' | 'high' | 'critical' {
    if (isDomainError(error)) {
      if (isValidationError(error)) return 'low';
      if (error.code === 'SCHEDULE_PERMISSION_ERROR') return 'medium';
      return 'medium';
    }

    if (isApplicationError(error)) {
      if (error.code === 'USE_CASE_VALIDATION_ERROR') return 'low';
      if (error.code === 'CONFIGURATION_ERROR') return 'critical';
      if (isTemporaryError(error)) return 'medium';
      return 'high';
    }

    if (isInfrastructureError(error)) {
      if (error.code === 'DATABASE_CONNECTION_ERROR') return 'critical';
      if (error.code === 'AUTHENTICATION_ERROR') return 'high';
      if (error.statusCode >= 500) return 'high';
      return 'medium';
    }

    return 'high'; // 予期しないエラーは高優先度
  }
}
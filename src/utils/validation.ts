import { InteractionResponseType } from 'discord-interactions';
import { ButtonInteraction, CommandInteraction, ModalInteraction } from '../types/discord';
import { StorageServiceV2 } from '../services/storage-v2';
import { Schedule } from '../types/schedule';
import { ERROR_MESSAGES, DISCORD_FLAGS } from '../constants';

/**
 * カスタムエラークラス
 */
export class ScheduleNotFoundError extends Error {
  constructor(scheduleId?: string) {
    super(scheduleId ? `Schedule not found: ${scheduleId}` : 'Schedule not found');
    this.name = 'ScheduleNotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class PermissionError extends Error {
  constructor(message: string = 'Permission denied') {
    super(message);
    this.name = 'PermissionError';
  }
}

/**
 * 共通バリデーション機能
 */
export class ValidationUtils {
  /**
   * Guild IDを安全に取得
   */
  static extractGuildId(interaction: ButtonInteraction | CommandInteraction | ModalInteraction): string {
    return interaction.guild_id || 'default';
  }

  /**
   * ユーザーIDを安全に取得
   */
  static extractUserId(interaction: ButtonInteraction | CommandInteraction | ModalInteraction): string {
    return interaction.member?.user.id || interaction.user?.id || '';
  }

  /**
   * スケジュールの存在確認
   */
  static async validateScheduleExists(
    scheduleId: string, 
    guildId: string, 
    storage: StorageServiceV2
  ): Promise<Schedule> {
    const schedule = await storage.getSchedule(scheduleId, guildId);
    if (!schedule) {
      throw new ScheduleNotFoundError(scheduleId);
    }
    return schedule;
  }

  /**
   * スケジュールの作成者確認
   */
  static validateScheduleCreator(schedule: Schedule, userId: string): void {
    if (schedule.createdBy.id !== userId) {
      throw new PermissionError('この操作を実行する権限がありません。');
    }
  }

  /**
   * スケジュールが開いているかチェック
   */
  static validateScheduleOpen(schedule: Schedule): void {
    if (schedule.status !== 'open') {
      throw new ValidationError(ERROR_MESSAGES.SCHEDULE_CLOSED);
    }
  }

  /**
   * 必須フィールドのバリデーション
   */
  static validateRequiredFields(data: Record<string, any>, fields: string[]): void {
    for (const field of fields) {
      if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
        throw new ValidationError(`${field}は必須です。`);
      }
    }
  }

  /**
   * 文字列長バリデーション
   */
  static validateStringLength(
    value: string, 
    maxLength: number, 
    fieldName: string
  ): void {
    if (value.length > maxLength) {
      throw new ValidationError(`${fieldName}は${maxLength}文字以内で入力してください。`);
    }
  }

  /**
   * 配列長バリデーション
   */
  static validateArrayLength(
    array: any[], 
    maxLength: number, 
    fieldName: string
  ): void {
    if (array.length > maxLength) {
      throw new ValidationError(`${fieldName}は${maxLength}個以内で入力してください。`);
    }
  }
}

/**
 * エラーハンドリング機能
 */
export class ErrorHandler {
  /**
   * スケジュール関連のエラーハンドリング
   */
  static handleScheduleError(error: Error, context: string): Response {
    console.error(`Schedule error in ${context}:`, error);
    
    let message: string = ERROR_MESSAGES.INTERNAL_ERROR;
    
    if (error instanceof ScheduleNotFoundError) {
      message = ERROR_MESSAGES.SCHEDULE_NOT_FOUND;
    } else if (error instanceof ValidationError) {
      message = error.message;
    } else if (error instanceof PermissionError) {
      message = error.message;
    }
    
    return this.createErrorResponse(message);
  }

  /**
   * 標準エラーレスポンス作成
   */
  static createErrorResponse(message: string, ephemeral: boolean = true): Response {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: message,
        flags: ephemeral ? DISCORD_FLAGS.EPHEMERAL : 0
      }
    }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  /**
   * 成功レスポンス作成
   */
  static createSuccessResponse(message: string, ephemeral: boolean = true): Response {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: message,
        flags: ephemeral ? DISCORD_FLAGS.EPHEMERAL : 0
      }
    }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  /**
   * デフォルトエラーハンドラー
   */
  static handleUnknownError(error: Error, context: string): Response {
    console.error(`Unknown error in ${context}:`, error);
    return this.createErrorResponse(ERROR_MESSAGES.INTERNAL_ERROR);
  }
}

/**
 * 共通レスポンス作成機能
 */
export class ResponseUtils {
  /**
   * モーダルレスポンス作成
   */
  static createModalResponse(modal: any): Response {
    return new Response(JSON.stringify({
      type: InteractionResponseType.MODAL,
      data: modal
    }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  /**
   * メッセージレスポンス作成
   */
  static createMessageResponse(
    content?: string, 
    embeds?: any[], 
    components?: any[], 
    ephemeral: boolean = false
  ): Response {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content,
        embeds,
        components,
        flags: ephemeral ? DISCORD_FLAGS.EPHEMERAL : 0
      }
    }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  /**
   * 更新レスポンス作成
   */
  static createUpdateResponse(
    content?: string, 
    embeds?: any[], 
    components?: any[]
  ): Response {
    return new Response(JSON.stringify({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        content,
        embeds,
        components
      }
    }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  /**
   * 遅延レスポンス作成
   */
  static createDeferredResponse(ephemeral: boolean = false): Response {
    return new Response(JSON.stringify({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        flags: ephemeral ? DISCORD_FLAGS.EPHEMERAL : 0
      }
    }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
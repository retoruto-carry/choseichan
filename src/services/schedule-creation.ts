/**
 * スケジュール作成に関するビジネスロジック
 * handleCreateScheduleModal の分割により、責任を明確に分離
 */

import { ModalInteraction, Env } from '../types/discord';
import { Schedule, ScheduleDate } from '../types/schedule';
import { parseUserInputDate } from '../utils/date';
import { ValidationUtils, ValidationError } from '../utils/validation';
import { DISCORD_LIMITS } from '../constants';

export interface CreateScheduleFormData {
  title: string;
  description?: string;
  datesText: string;
  deadlineText?: string;
  reminderTimings?: string[];
  reminderMentions?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  formData?: CreateScheduleFormData;
  error?: string;
}

export interface CreatedScheduleData {
  schedule: Schedule;
  shouldSendReminder: boolean;
}

/**
 * スケジュール作成フォームの検証
 */
export class ScheduleFormValidator {
  /**
   * モーダルからフォームデータを抽出・検証
   */
  static extractAndValidateFormData(interaction: ModalInteraction): ValidationResult {
    try {
      const components = interaction.data.components;
      if (!components || components.length === 0) {
        return { isValid: false, error: 'フォームデータが見つかりません。' };
      }

      // フォームデータを抽出
      const formData: Record<string, any> = {};
      for (const actionRow of components) {
        if (actionRow.components) {
          for (const component of actionRow.components) {
            if (component.custom_id && component.value !== undefined) {
              formData[component.custom_id] = component.value;
            }
          }
        }
      }

      // 必須フィールドの検証
      ValidationUtils.validateRequiredFields(formData, ['title', 'dates']);

      // 文字列長の検証
      ValidationUtils.validateStringLength(formData.title, 100, 'タイトル');
      if (formData.description) {
        ValidationUtils.validateStringLength(formData.description, 500, '説明');
      }

      const result: CreateScheduleFormData = {
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        datesText: formData.dates.trim(),
        deadlineText: formData.deadline?.trim() || undefined,
        reminderTimings: formData.reminder_timings?.split(',').map((s: string) => s.trim()).filter(Boolean) || undefined,
        reminderMentions: formData.reminder_mentions?.split(',').map((s: string) => s.trim()).filter(Boolean) || undefined
      };

      return { isValid: true, formData: result };
    } catch (error) {
      const message = error instanceof ValidationError ? error.message : '入力内容の検証に失敗しました。';
      return { isValid: false, error: message };
    }
  }
}

/**
 * 日程候補の解析
 */
export class ScheduleDateParser {
  /**
   * 日程候補テキストをScheduleDate配列に変換
   */
  static parseScheduleDates(datesText: string): ScheduleDate[] {
    const lines = datesText.split('\n').map(line => line.trim()).filter(Boolean);
    
    if (lines.length === 0) {
      throw new ValidationError('日程候補を入力してください。');
    }

    ValidationUtils.validateArrayLength(lines, DISCORD_LIMITS.MAX_EMBED_FIELDS, '日程候補');

    const dates: ScheduleDate[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length === 0) continue;

      dates.push({
        id: `date${i + 1}`,
        datetime: line
      });
    }

    if (dates.length === 0) {
      throw new ValidationError('有効な日程候補が見つかりません。');
    }

    return dates;
  }
}

/**
 * 締切日の解析
 */
export class DeadlineParser {
  /**
   * 締切テキストをDate型に変換
   */
  static parseDeadline(deadlineText?: string): Date | undefined {
    if (!deadlineText || !deadlineText.trim()) {
      return undefined;
    }

    const parsed = parseUserInputDate(deadlineText.trim());
    if (!parsed) {
      throw new ValidationError('締切日の形式が正しくありません。');
    }

    // 過去の日付チェック
    if (parsed.getTime() <= Date.now()) {
      throw new ValidationError('締切日は現在より未来の日付を指定してください。');
    }

    return parsed;
  }
}

/**
 * リマインダー設定の解析
 */
export class ReminderParser {
  /**
   * リマインダータイミングの検証
   */
  static validateReminderTimings(timings?: string[]): string[] | undefined {
    if (!timings || timings.length === 0) {
      return undefined;
    }

    const validTimings: string[] = [];
    for (const timing of timings) {
      if (!this.isValidTimingFormat(timing)) {
        throw new ValidationError(`無効なリマインダータイミング: ${timing}`);
      }
      validTimings.push(timing);
    }

    return validTimings.length > 0 ? validTimings : undefined;
  }

  /**
   * リマインダーメンション先の検証
   */
  static validateReminderMentions(mentions?: string[]): string[] | undefined {
    if (!mentions || mentions.length === 0) {
      return undefined;
    }

    const validMentions: string[] = [];
    for (const mention of mentions) {
      if (mention.length === 0) continue;
      validMentions.push(mention);
    }

    return validMentions.length > 0 ? validMentions : undefined;
  }

  /**
   * タイミング形式の検証（例: 3d, 8h, 30m）
   */
  private static isValidTimingFormat(timing: string): boolean {
    return /^\d+[dhm]$/.test(timing);
  }
}

/**
 * スケジュール作成サービス
 */
export class ScheduleCreationService {
  /**
   * フォームデータからScheduleオブジェクトを作成
   */
  static createSchedule(
    formData: CreateScheduleFormData,
    interaction: ModalInteraction
  ): CreatedScheduleData {
    try {
      // 日程候補の解析
      const dates = ScheduleDateParser.parseScheduleDates(formData.datesText);

      // 締切日の解析
      const deadline = DeadlineParser.parseDeadline(formData.deadlineText);

      // リマインダー設定の解析
      const reminderTimings = ReminderParser.validateReminderTimings(formData.reminderTimings);
      const reminderMentions = ReminderParser.validateReminderMentions(formData.reminderMentions);

      // 作成者情報
      const userId = ValidationUtils.extractUserId(interaction);
      const username = interaction.member?.user.username || 
                      interaction.user?.username || 
                      'Unknown User';

      // スケジュール作成
      const schedule: Schedule = {
        id: this.generateScheduleId(),
        title: formData.title,
        description: formData.description,
        dates,
        createdBy: {
          id: userId,
          username
        },
        authorId: userId,
        channelId: interaction.channel_id || '',
        guildId: ValidationUtils.extractGuildId(interaction),
        deadline,
        reminderTimings,
        reminderMentions,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'open',
        notificationSent: false,
        totalResponses: 0
      };

      return {
        schedule,
        shouldSendReminder: Boolean(deadline && reminderTimings)
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('スケジュールの作成に失敗しました。');
    }
  }

  /**
   * 一意のスケジュールIDを生成
   */
  private static generateScheduleId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}

/**
 * 非同期処理のハンドラー
 */
export class ScheduleAsyncOperations {
  /**
   * メッセージID保存とリマインダー設定を非同期で実行
   */
  static async handleAsyncOperations(
    schedule: Schedule, 
    messageId: string,
    env: Env
  ): Promise<void> {
    try {
      // この処理は非同期で実行されるため、エラーがあってもユーザーには影響しない
      const { StorageServiceV2 } = await import('../services/storage-v2');
      const storage = new StorageServiceV2(env.SCHEDULES, env.RESPONSES, env);
      
      // メッセージIDを保存
      schedule.messageId = messageId;
      schedule.updatedAt = new Date();
      await storage.saveSchedule(schedule);

      console.log(`Schedule ${schedule.id} message ID saved: ${messageId}`);
      
      // 将来的にはここでリマインダーの予約処理なども追加可能
    } catch (error) {
      console.error(`Failed to handle async operations for schedule ${schedule.id}:`, error);
    }
  }
}
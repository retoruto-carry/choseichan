/**
 * Process Reminder Use Case
 * 
 * リマインダー処理のユースケース
 */

import { IScheduleRepository } from '../../../domain/repositories/interfaces';

export interface ProcessReminderRequest {
  scheduleId: string;
  guildId: string;
  reminderType: string;
}

export interface ProcessReminderUseCaseResult {
  success: boolean;
  updated?: boolean;
  errors?: string[];
}

export class ProcessReminderUseCase {
  constructor(
    private readonly scheduleRepository: IScheduleRepository
  ) {}

  async markReminderSent(request: ProcessReminderRequest): Promise<ProcessReminderUseCaseResult> {
    try {
      if (!request.scheduleId?.trim() || !request.guildId?.trim() || !request.reminderType?.trim()) {
        return {
          success: false,
          errors: ['スケジュールID、Guild ID、リマインダータイプが必要です']
        };
      }

      const schedule = await this.scheduleRepository.findById(request.scheduleId, request.guildId);
      
      if (!schedule) {
        return {
          success: false,
          errors: ['指定されたスケジュールが見つかりません']
        };
      }

      // Update remindersSent array
      const remindersSent = schedule.remindersSent || [];
      if (!remindersSent.includes(request.reminderType)) {
        remindersSent.push(request.reminderType);
      }

      // Keep backward compatibility
      const reminderSent = request.reminderType === '8h' ? true : false;

      const updateRequest = {
        scheduleId: request.scheduleId,
        guildId: request.guildId,
        remindersSent,
        reminderSent
      };

      await this.scheduleRepository.updateReminders(updateRequest);

      return {
        success: true,
        updated: true
      };

    } catch (error) {
      return {
        success: false,
        errors: [`リマインダー更新に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
}
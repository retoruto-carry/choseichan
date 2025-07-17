/**
 * Reminder State Service
 *
 * リマインダーの送信状態を管理するサービス
 * ユースケースから呼び出される補助サービス
 */

import type { IScheduleRepository } from '../../domain/repositories/interfaces';

export interface MarkReminderSentRequest {
  scheduleId: string;
  guildId: string;
  reminderType: string;
}

export class ReminderStateService {
  constructor(private readonly scheduleRepository: IScheduleRepository) {}

  /**
   * リマインダーを送信済みとしてマーク
   */
  async markReminderSent(request: MarkReminderSentRequest): Promise<void> {
    if (!request.scheduleId?.trim() || !request.guildId?.trim() || !request.reminderType?.trim()) {
      throw new Error('スケジュールID、Guild ID、リマインダータイプが必要です');
    }

    const schedule = await this.scheduleRepository.findById(request.scheduleId, request.guildId);

    if (!schedule) {
      throw new Error('指定されたスケジュールが見つかりません');
    }

    // Update remindersSent array
    const remindersSent = schedule.remindersSent || [];
    if (!remindersSent.includes(request.reminderType)) {
      remindersSent.push(request.reminderType);
    }

    // Keep backward compatibility
    const reminderSent = request.reminderType === '8h';

    await this.scheduleRepository.updateReminders({
      scheduleId: request.scheduleId,
      guildId: request.guildId,
      remindersSent,
      reminderSent,
    });
  }
}

/**
 * Deadline Reminder Queue Port
 *
 * 締切リマインダー処理用のキューインターフェース
 */

export interface DeadlineReminderTask {
  type: 'send_reminder' | 'close_schedule' | 'send_summary';
  scheduleId: string;
  guildId: string;
  customMessage?: string;
}

export interface DeadlineReminderQueuePort {
  /**
   * リマインダータスクをキューに送信
   */
  send(task: DeadlineReminderTask): Promise<void>;

  /**
   * バッチのタスクをキューに送信
   */
  sendBatch(tasks: DeadlineReminderTask[]): Promise<void>;
}

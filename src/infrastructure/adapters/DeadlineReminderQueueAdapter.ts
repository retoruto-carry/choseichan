/**
 * Deadline Reminder Queue Adapter
 *
 * 締切リマインダー処理用のCloudflare Queuesアダプター
 */

import type {
  DeadlineReminderQueuePort,
  DeadlineReminderTask,
} from '../ports/DeadlineReminderQueuePort';

export class DeadlineReminderQueueAdapter implements DeadlineReminderQueuePort {
  constructor(private queue: Queue<DeadlineReminderTask>) {}

  async send(task: DeadlineReminderTask): Promise<void> {
    await this.queue.send(task);
  }

  async sendBatch(tasks: DeadlineReminderTask[]): Promise<void> {
    await this.queue.sendBatch(
      tasks.map((task) => ({
        body: task,
      }))
    );
  }
}

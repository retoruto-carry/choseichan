/**
 * Deadline Reminder Queue Handler
 *
 * 締切リマインダーのキューコンシューマー
 */

import type { DeadlineReminderTask } from '../../application/ports/DeadlineReminderQueuePort';
import { NotificationService } from '../../application/services/NotificationService';
import { DependencyContainer } from '../../di/DependencyContainer';
import { DiscordApiAdapter } from '../adapters/DiscordApiAdapter';
import { LoggerAdapter } from '../adapters/LoggerAdapter';
import { MessageFormatterAdapter } from '../adapters/MessageFormatterAdapter';
import type { Env } from '../types/discord';

export async function handleDeadlineReminderBatch(
  batch: MessageBatch<DeadlineReminderTask>,
  env: Env
): Promise<void> {
  const container = new DependencyContainer(env);

  // Ensure Discord credentials are available
  const discordToken = env.DISCORD_TOKEN ?? '';
  const applicationId = env.DISCORD_APPLICATION_ID ?? '';

  if (!discordToken || !applicationId) {
    throw new Error('Discord credentials are not configured');
  }

  const notificationService = new NotificationService(
    new LoggerAdapter(),
    new DiscordApiAdapter(),
    container.infrastructureServices.repositoryFactory.getScheduleRepository(),
    container.infrastructureServices.repositoryFactory.getResponseRepository(),
    container.getScheduleSummaryUseCase,
    discordToken,
    applicationId,
    container.infrastructureServices.backgroundExecutor,
    new MessageFormatterAdapter()
  );

  // Process all tasks in the batch
  await Promise.allSettled(
    batch.messages.map(async (message) => {
      const task = message.body;

      try {
        switch (task.type) {
          case 'send_reminder': {
            const schedule = await container.getScheduleUseCase.execute(
              task.scheduleId,
              task.guildId
            );
            if (schedule.success && schedule.schedule) {
              await notificationService.sendDeadlineReminder(schedule.schedule, task.customMessage);
            }
            break;
          }

          case 'close_schedule': {
            await container.closeScheduleUseCase.execute({
              scheduleId: task.scheduleId,
              guildId: task.guildId,
              editorUserId: 'system', // システムによる自動締切
            });

            // メインメッセージを更新（締切済み状態に）
            await notificationService.updateMainMessage(task.scheduleId, task.guildId);
            break;
          }

          case 'send_summary': {
            await notificationService.sendSummaryMessage(task.scheduleId, task.guildId);

            // 一時的にPR通知機能をオフ
            /*
            // Get schedule for PR message
            const schedule = await container.getScheduleUseCase.execute(
              task.scheduleId,
              task.guildId
            );
            if (schedule.success && schedule.schedule) {
              notificationService.sendPRMessage(schedule.schedule);
            }
            */
            break;
          }
        }
      } catch (error) {
        console.error(`Error processing deadline reminder task:`, error, {
          task,
        });
        // エラーをスローしないことで、他のタスクの処理を継続
      }
    })
  );
}

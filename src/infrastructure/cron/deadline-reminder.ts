import { DependencyContainer } from '../../di/DependencyContainer';
import { getLogger } from '../logging/Logger';
import type { Env } from '../types/discord';

const logger = getLogger();

export async function sendDeadlineReminders(env: Env): Promise<void> {
  try {
    const container = new DependencyContainer(env);

    if (!container.processDeadlineRemindersUseCase) {
      logger.error(
        'ProcessDeadlineRemindersUseCase not available',
        new Error('Missing Discord credentials or configuration'),
        {
          hasDiscordToken: !!env.DISCORD_TOKEN,
          hasApplicationId: !!env.DISCORD_APPLICATION_ID,
          hasDB: !!env.DB,
          hasMessageUpdateQueue: !!env.MESSAGE_UPDATE_QUEUE,
          hasDeadlineReminderQueue: !!env.DEADLINE_REMINDER_QUEUE,
        }
      );
      throw new Error(
        'ProcessDeadlineRemindersUseCase is not available - check environment configuration'
      );
    }

    await container.processDeadlineRemindersUseCase.execute();
  } catch (error) {
    logger.error(
      'Failed to send deadline reminders',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'sendDeadlineReminders',
        errorMessage: error instanceof Error ? error.message : String(error),
      }
    );
    throw error;
  }
}

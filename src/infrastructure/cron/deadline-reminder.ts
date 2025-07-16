import { DependencyContainer } from '../../di/DependencyContainer';
import { getLogger } from '../logging/Logger';
import type { Env } from '../types/discord';

const logger = getLogger();

export async function sendDeadlineReminders(env: Env): Promise<void> {
  const container = new DependencyContainer(env);

  if (!container.processDeadlineRemindersUseCase) {
    logger.error(
      'ProcessDeadlineRemindersUseCase not available',
      new Error('Missing Discord credentials'),
      {
        hasDiscordToken: !!env.DISCORD_TOKEN,
        hasApplicationId: !!env.DISCORD_APPLICATION_ID,
      }
    );
    return;
  }

  await container.processDeadlineRemindersUseCase.execute();
}

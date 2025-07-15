import { DependencyContainer } from '../../di/DependencyContainer';
import type { Env } from '../types/discord';

export async function sendDeadlineReminders(env: Env): Promise<void> {
  const container = new DependencyContainer(env);

  if (!container.processDeadlineRemindersUseCase) {
    console.error('ProcessDeadlineRemindersUseCase not available (missing Discord credentials)');
    return;
  }

  await container.processDeadlineRemindersUseCase.execute();
}

import { Env } from '../types/discord';
import { DependencyContainer } from '../infrastructure/factories/DependencyContainer';

export async function sendDeadlineReminders(env: Env): Promise<void> {
  const container = new DependencyContainer(env);
  
  if (!container.processDeadlineRemindersUseCase) {
    console.error('ProcessDeadlineRemindersUseCase not available (missing Discord credentials)');
    return;
  }

  await container.processDeadlineRemindersUseCase.execute();
}
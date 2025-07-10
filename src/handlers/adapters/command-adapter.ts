/**
 * Command Handler Adapter
 * 
 * 既存のcommand handler関数をClean Architecture Controllerに委譲するアダプター
 */

import { CommandInteraction, Env } from '../../types/discord';
import { createCommandController } from '../../presentation/controllers/CommandController';

/**
 * メインコマンドハンドラー
 */
export async function handleChoseichanCommand(
  interaction: CommandInteraction,
  env: Env
): Promise<Response> {
  const controller = createCommandController(env);
  return controller.handleChoseichanCommand(interaction, env);
}
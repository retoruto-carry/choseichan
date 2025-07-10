/**
 * Button Handler Adapter
 * 
 * 既存のbutton handler関数をClean Architecture Controllerに委譲するアダプター
 */

import { ButtonInteraction, Env } from '../../types/discord';
import { createButtonInteractionController } from '../../presentation/controllers/ButtonInteractionController';

/**
 * ボタンインタラクション処理
 */
export async function handleButtonInteraction(
  interaction: ButtonInteraction,
  env: Env
): Promise<Response> {
  const controller = createButtonInteractionController();
  return controller.handleButtonInteraction(interaction, env);
}
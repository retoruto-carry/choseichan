/**
 * Display Handler Adapter
 * 
 * 既存のdisplay handler関数をClean Architecture Controllerに委譲するアダプター
 */

import { ButtonInteraction, Env } from '../../types/discord';
import { createDisplayController } from '../../presentation/controllers/DisplayController';
import { StorageServiceV2 as StorageService } from '../../services/storage-v2';

/**
 * 詳細表示切り替えボタン処理
 */
export async function handleToggleDetailsButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const controller = createDisplayController(env);
  return controller.handleToggleDetailsButton(interaction, params, env, storage);
}
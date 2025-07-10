/**
 * Create Schedule Handler Adapter
 * 
 * 既存のcreate schedule handler関数をClean Architecture Controllerに委譲するアダプター
 */

import { ModalInteraction, Env } from '../../types/discord';
import { createCreateScheduleController } from '../../presentation/controllers/CreateScheduleController';
import { StorageServiceV2 as StorageService } from '../../services/storage-v2';

/**
 * 日程調整作成モーダル処理
 */
export async function handleCreateScheduleModal(
  interaction: ModalInteraction,
  storage: StorageService,
  env: Env
): Promise<Response> {
  const controller = createCreateScheduleController(env);
  return controller.handleCreateScheduleModal(interaction, env, storage);
}
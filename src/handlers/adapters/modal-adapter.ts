/**
 * Modal Handler Adapter
 * 
 * 既存のmodal handler関数をClean Architecture Controllerに委譲するアダプター
 */

import { ModalInteraction, Env } from '../../types/discord';
import { createModalController } from '../../presentation/controllers/ModalController';
import { StorageServiceV2 as StorageService } from '../../services/storage-v2';

/**
 * モーダル送信処理
 */
export async function handleModalSubmit(
  interaction: ModalInteraction,
  env: Env
): Promise<Response> {
  const controller = createModalController(env);
  return controller.handleModalSubmit(interaction, env);
}
/**
 * Edit Modal Handler Adapter
 * 
 * 既存のedit modal handler関数をClean Architecture Controllerに委譲するアダプター
 */

import { ModalInteraction, Env } from '../../types/discord';
import { createEditModalController } from '../../presentation/controllers/EditModalController';
import { StorageServiceV2 as StorageService } from '../../services/storage-v2';

/**
 * StorageServiceV2から環境オブジェクトを抽出
 */
function extractEnvFromStorage(storage: StorageService): Env {
  return storage.getEnv();
}

/**
 * 基本情報編集モーダル処理
 */
export async function handleEditInfoModal(
  interaction: ModalInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const controller = createEditModalController(env);
  return controller.handleEditInfoModal(interaction, params, env, storage);
}

/**
 * 日程更新モーダル処理
 */
export async function handleUpdateDatesModal(
  interaction: ModalInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const controller = createEditModalController(env);
  return controller.handleUpdateDatesModal(interaction, params, env, storage);
}

/**
 * 日程追加モーダル処理
 */
export async function handleAddDatesModal(
  interaction: ModalInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const controller = createEditModalController(env);
  return controller.handleAddDatesModal(interaction, params, env, storage);
}

/**
 * 締切編集モーダル処理
 */
export async function handleEditDeadlineModal(
  interaction: ModalInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const controller = createEditModalController(env);
  return controller.handleEditDeadlineModal(interaction, params, env, storage);
}

/**
 * リマインダー編集モーダル処理
 */
export async function handleEditReminderModal(
  interaction: ModalInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const controller = createEditModalController(env);
  return controller.handleEditReminderModal(interaction, params, env, storage);
}
/**
 * Edit Handler Adapter
 * 
 * 既存のedit handler関数をClean Architecture Controllerに委譲するアダプター
 */

import { ButtonInteraction } from '../../types/discord';
import { createScheduleEditController } from '../../presentation/controllers/ScheduleEditController';
import { StorageServiceV2 as StorageService } from '../../services/storage-v2';

/**
 * StorageServiceV2から環境オブジェクトを抽出
 */
function extractEnvFromStorage(storage: StorageService): any {
  return storage.getEnv();
}

/**
 * 基本情報編集ボタン処理
 */
export async function handleEditInfoButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const env = extractEnvFromStorage(storage);
  const controller = createScheduleEditController(env);
  return controller.handleEditInfoButton(interaction, params);
}

/**
 * 日程更新ボタン処理
 */
export async function handleUpdateDatesButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const env = extractEnvFromStorage(storage);
  const controller = createScheduleEditController(env);
  return controller.handleUpdateDatesButton(interaction, params);
}

/**
 * 日程追加ボタン処理
 */
export async function handleAddDatesButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const env = extractEnvFromStorage(storage);
  const controller = createScheduleEditController(env);
  return controller.handleAddDatesButton(interaction, params);
}

/**
 * 日程削除ボタン処理
 */
export async function handleRemoveDatesButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const env = extractEnvFromStorage(storage);
  const controller = createScheduleEditController(env);
  return controller.handleRemoveDatesButton(interaction, params);
}

/**
 * 日程削除確認ボタン処理
 */
export async function handleConfirmRemoveDateButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const env = extractEnvFromStorage(storage);
  const controller = createScheduleEditController(env);
  return controller.handleConfirmRemoveDateButton(interaction, params);
}

/**
 * 締切編集ボタン処理
 */
export async function handleEditDeadlineButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const env = extractEnvFromStorage(storage);
  const controller = createScheduleEditController(env);
  return controller.handleEditDeadlineButton(interaction, params);
}

/**
 * リマインダー編集ボタン処理
 */
export async function handleReminderEditButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const env = extractEnvFromStorage(storage);
  const controller = createScheduleEditController(env);
  return controller.handleReminderEditButton(interaction, params);
}
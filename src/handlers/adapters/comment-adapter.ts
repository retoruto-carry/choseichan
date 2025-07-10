/**
 * Comment Handler Adapter
 * 
 * 既存のcomment handler関数をClean Architecture Controllerに委譲するアダプター
 */

import { ModalInteraction, ButtonInteraction, Env } from '../../types/discord';
import { createCommentController } from '../../presentation/controllers/CommentController';
import { StorageServiceV2 as StorageService } from '../../services/storage-v2';

/**
 * 全体コメント追加モーダル処理
 */
export async function handleAddCommentModal(
  interaction: ModalInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const env = storage.getEnv();
  const controller = createCommentController(env);
  return controller.handleAddCommentModal(interaction, params, env, storage);
}

/**
 * 日程別コメント追加モーダル処理
 */
export async function handleDateCommentModal(
  interaction: ModalInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const env = storage.getEnv();
  const controller = createCommentController(env);
  return controller.handleDateCommentModal(interaction, params, env, storage);
}

/**
 * 全体コメント追加ボタン処理
 */
export async function handleAddCommentButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const env = storage.getEnv();
  const controller = createCommentController(env);
  return controller.handleAddCommentButton(interaction, params, env, storage);
}

/**
 * 日程別コメントボタン処理
 */
export async function handleCommentButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const env = storage.getEnv();
  const controller = createCommentController(env);
  return controller.handleCommentButton(interaction, params, env, storage);
}
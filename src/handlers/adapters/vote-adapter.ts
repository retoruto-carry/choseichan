/**
 * Vote Handler Adapter
 * 
 * 既存のvote handler関数をClean Architecture Controllerに委譲するアダプター
 */

import { ButtonInteraction, Env } from '../../types/discord';
import { createVoteController } from '../../presentation/controllers/VoteController';
import { StorageServiceV2 as StorageService } from '../../services/storage-v2';

/**
 * 回答ボタン処理
 */
export async function handleRespondButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const controller = createVoteController(env);
  return controller.handleRespondButton(interaction, params, env, storage);
}


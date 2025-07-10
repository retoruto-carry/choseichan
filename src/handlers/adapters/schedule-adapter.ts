/**
 * Schedule Handler Adapter
 * 
 * 既存のhandler関数をClean Architecture Controllerに委譲するアダプター
 */

import { ButtonInteraction, Env } from '../../types/discord';
import { createScheduleManagementController } from '../../presentation/controllers/ScheduleManagementController';
import { StorageServiceV2 as StorageService } from '../../services/storage-v2';
import { ScheduleSummary, STATUS_EMOJI, EMBED_COLORS } from '../../types/schedule';

/**
 * 既存のhandleStatusButton関数のClean Architecture版
 */
export async function handleStatusButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  // StorageServiceV2から環境を取得
  const env = extractEnvFromStorage(storage);
  const controller = createScheduleManagementController(env);
  return controller.handleStatusButton(interaction, params);
}

/**
 * 既存のhandleEditButton関数のClean Architecture版
 */
export async function handleEditButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const env = extractEnvFromStorage(storage);
  const controller = createScheduleManagementController(env);
  return controller.handleEditButton(interaction, params);
}

/**
 * 既存のhandleDetailsButton関数のClean Architecture版
 */
export async function handleDetailsButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const env = extractEnvFromStorage(storage);
  const controller = createScheduleManagementController(env);
  return controller.handleDetailsButton(interaction, params);
}

/**
 * 既存のhandleCloseButton関数のClean Architecture版
 */
export async function handleCloseButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const controller = createScheduleManagementController(env);
  return controller.handleCloseButton(interaction, params, env);
}

/**
 * 既存のhandleReopenButton関数のClean Architecture版
 */
export async function handleReopenButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const controller = createScheduleManagementController(env);
  return controller.handleReopenButton(interaction, params, env);
}

/**
 * 既存のhandleDeleteButton関数のClean Architecture版
 */
export async function handleDeleteButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env?: Env
): Promise<Response> {
  const controller = createScheduleManagementController(env || createMockEnv());
  return controller.handleDeleteButton(interaction, params, env);
}

/**
 * 既存のhandleRefreshButton関数のClean Architecture版
 */
export async function handleRefreshButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const controller = createScheduleManagementController(env);
  return controller.handleRefreshButton(interaction, params);
}

/**
 * 既存のhandleHideDetailsButton関数のClean Architecture版
 */
export async function handleHideDetailsButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const controller = createScheduleManagementController(env);
  return controller.handleHideDetailsButton(interaction, params);
}

/**
 * StorageServiceV2から環境オブジェクトを抽出
 */
function extractEnvFromStorage(storage: StorageService): Env {
  // StorageServiceV2のpublicメソッドを使用
  return storage.getEnv();
}

/**
 * テスト用のMock環境の作成
 */
function createMockEnv(): Env {
  // テスト環境では適切なD1 mockを渡す
  return {
    DB: (globalThis as any).mockDB || null as any,
    DISCORD_TOKEN: '',
    DISCORD_APPLICATION_ID: '',
    ctx: undefined
  } as Env;
}

/**
 * Legacy createResponseTableEmbed function for backward compatibility
 */
export function createResponseTableEmbed(summary: ScheduleSummary) {
  const { schedule, userResponses, responseCounts, bestDateId } = summary;
  
  return {
    title: `📊 ${schedule.title}`,
    color: EMBED_COLORS.INFO,
    fields: schedule.dates.slice(0, 10).map((date, idx) => {
      const count = responseCounts[date.id];
      const isBest = date.id === bestDateId && userResponses.length > 0;
      
      // Get responses for this date
      const dateResponses = userResponses
        .map(ur => {
          const response = ur.responses.find(r => r.dateId === date.id);
          if (!response) return null;
          const comment = response.comment ? ` (${response.comment})` : '';
          return `${STATUS_EMOJI[response.status]} ${ur.userName}${comment}`;
        })
        .filter(Boolean);
      
      return {
        name: `${isBest ? '⭐ ' : ''}${idx + 1}. ${date.datetime}`,
        value: [
          `集計: ${STATUS_EMOJI.yes} ${count.yes}人 ${STATUS_EMOJI.maybe} ${count.maybe}人 ${STATUS_EMOJI.no} ${count.no}人`,
          dateResponses.length > 0 ? dateResponses.join(', ') : '回答なし'
        ].join('\n'),
        inline: false
      };
    }),
    footer: {
      text: `回答者: ${userResponses.length}人`
    }
  };
}
/**
 * Modal Controller
 *
 * モーダル関連の統合コントローラー
 * 元: src/handlers/modals/index.ts の Clean Architecture版
 */

import { InteractionResponseFlags, InteractionResponseType } from 'discord-interactions';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { getLogger } from '../../infrastructure/logging/Logger';
import type { Env, ModalInteraction } from '../../infrastructure/types/discord';

export class ModalController {
  private readonly logger = getLogger();

  constructor(private readonly dependencyContainer: DependencyContainer) {}

  /**
   * モーダル送信処理の統合ハンドラー
   */
  async handleModalSubmit(interaction: ModalInteraction, env: Env): Promise<Response> {
    try {
      const customId = interaction.data.custom_id;
      const { parseButtonId } = await import('../../utils/id');
      const { action, params } = parseButtonId(customId);

      // Handle both 'modal:create_schedule' and 'create_schedule' formats
      const modalAction = action === 'modal' && params.length > 0 ? params[0] : action;
      const modalParams = action === 'modal' ? params.slice(1) : params;

      switch (modalAction) {
        case 'create_schedule':
          return this.handleCreateScheduleModal(interaction, env);

        case 'edit_info':
          return this.handleEditInfoModal(interaction, modalParams, env);

        case 'update_dates':
          return this.handleUpdateDatesModal(interaction, modalParams, env);

        case 'add_dates':
          return this.handleAddDatesModal(interaction, modalParams, env);

        case 'edit_deadline':
          return this.handleEditDeadlineModal(interaction, modalParams, env);

        case 'edit_reminder':
          return this.handleEditReminderModal(interaction, modalParams, env);

        default:
          return this.createErrorResponse('不明なモーダルです。');
      }
    } catch (error) {
      this.logger.error('Error in handleModalSubmit', error instanceof Error ? error : new Error(String(error)), {
        operation: 'handle-modal-submit',
        useCase: 'ModalController',
        customId: interaction.data.custom_id,
        guildId: interaction.guild_id,
      });
      return this.createErrorResponse('モーダル処理中にエラーが発生しました。');
    }
  }

  private async handleCreateScheduleModal(
    interaction: ModalInteraction,
    env: Env
  ): Promise<Response> {
    const { createCreateScheduleController } = await import('./CreateScheduleController');
    const controller = createCreateScheduleController(env);
    return controller.handleCreateScheduleModal(interaction, env);
  }

  private async handleEditInfoModal(
    interaction: ModalInteraction,
    params: string[],
    env: Env
  ): Promise<Response> {
    const { createEditModalController } = await import('./EditModalController');
    const controller = createEditModalController(env);
    return controller.handleEditInfoModal(interaction, params, env);
  }

  private async handleUpdateDatesModal(
    interaction: ModalInteraction,
    params: string[],
    env: Env
  ): Promise<Response> {
    const { createEditModalController } = await import('./EditModalController');
    const controller = createEditModalController(env);
    return controller.handleUpdateDatesModal(interaction, params, env);
  }

  private async handleAddDatesModal(
    interaction: ModalInteraction,
    params: string[],
    env: Env
  ): Promise<Response> {
    const { createEditModalController } = await import('./EditModalController');
    const controller = createEditModalController(env);
    return controller.handleAddDatesModal(interaction, params, env);
  }

  private async handleEditDeadlineModal(
    interaction: ModalInteraction,
    params: string[],
    env: Env
  ): Promise<Response> {
    const { createEditModalController } = await import('./EditModalController');
    const controller = createEditModalController(env);
    return controller.handleEditDeadlineModal(interaction, params, env);
  }

  private async handleEditReminderModal(
    interaction: ModalInteraction,
    params: string[],
    env: Env
  ): Promise<Response> {
    const { createEditModalController } = await import('./EditModalController');
    const controller = createEditModalController(env);
    return controller.handleEditReminderModal(interaction, params, env);
  }

  private createErrorResponse(message: string): Response {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: message,
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Factory function for creating controller with dependencies
 */
export function createModalController(env: Env): ModalController {
  const container = new DependencyContainer(env);
  return new ModalController(container);
}

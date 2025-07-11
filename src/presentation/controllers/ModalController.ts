/**
 * Modal Controller
 * 
 * モーダル関連の統合コントローラー
 * 元: src/handlers/modals/index.ts の Clean Architecture版
 */

import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ModalInteraction, Env } from '../../types/discord';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { ModalUIBuilder } from '../builders/ModalUIBuilder';

export class ModalController {
  constructor(
    private readonly dependencyContainer: DependencyContainer,
    private readonly uiBuilder: ModalUIBuilder
  ) {}

  /**
   * モーダル送信処理の統合ハンドラー
   */
  async handleModalSubmit(
    interaction: ModalInteraction,
    env: Env,
  ): Promise<Response> {
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
          
        case 'add_comment':
          return this.handleAddCommentModal(interaction, modalParams, env);
          
        case 'date_comment':
          return this.handleDateCommentModal(interaction, modalParams, env);
          
        case 'edit_deadline':
          return this.handleEditDeadlineModal(interaction, modalParams, env);
          
        case 'edit_reminder':
          return this.handleEditReminderModal(interaction, modalParams, env);
          
        default:
          return this.createErrorResponse('不明なモーダルです。');
      }

    } catch (error) {
      console.error('Error in handleModalSubmit:', error);
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

  private async handleAddCommentModal(
    interaction: ModalInteraction,
    params: string[],
    env: Env
  ): Promise<Response> {
    const { createCommentController } = await import('./CommentController');
    const controller = createCommentController(env);
    return controller.handleAddCommentModal(interaction, params, env);
  }

  private async handleDateCommentModal(
    interaction: ModalInteraction,
    params: string[],
    env: Env
  ): Promise<Response> {
    const { createCommentController } = await import('./CommentController');
    const controller = createCommentController(env);
    // Comment functionality has been removed, use the generic handler
    return controller.handleAddCommentModal(interaction, params, env);
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
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: message,
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }
}

/**
 * Factory function for creating controller with dependencies
 */
export function createModalController(env: Env): ModalController {
  const container = new DependencyContainer(env);
  const uiBuilder = new ModalUIBuilder();
  
  return new ModalController(container, uiBuilder);
}
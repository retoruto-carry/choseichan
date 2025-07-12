/**
 * Button Interaction Controller
 *
 * ボタンインタラクション機能のコントローラー
 * 元: src/handlers/buttons.ts の Clean Architecture版
 */

import { InteractionResponseFlags, InteractionResponseType } from 'discord-interactions';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { getLogger } from '../../infrastructure/logging/Logger';
import type { ButtonInteraction, Env } from '../../infrastructure/types/discord';

export class ButtonInteractionController {
  private readonly logger = getLogger();

  constructor(private readonly dependencyContainer: DependencyContainer) {}

  /**
   * ボタンインタラクション処理
   */
  async handleButtonInteraction(interaction: ButtonInteraction, env: Env): Promise<Response> {
    try {
      const customId = interaction.data.custom_id;
      const { parseButtonId } = await import('../../utils/id');
      const parsed = parseButtonId(customId);

      if (!parsed) {
        return this.createErrorResponse('ボタンIDの解析に失敗しました');
      }

      const { action, params } = parsed;

      // Route to appropriate controller based on action
      switch (action) {
        // Vote actions
        case 'respond':
          return this.handleRespondButton(interaction, params, env);

        // Schedule management actions
        case 'status':
          return this.handleStatusButton(interaction, params);
        case 'edit':
          return this.handleEditButton(interaction, params);
        case 'details':
          return this.handleDetailsButton(interaction, params);
        case 'close':
          return this.handleCloseButton(interaction, params, env);
        case 'reopen':
          return this.handleReopenButton(interaction, params, env);
        case 'delete':
          return this.handleDeleteButton(interaction, params, env);
        case 'refresh':
          return this.handleRefreshButton(interaction, params);
        case 'hide_details':
          return this.handleHideDetailsButton(interaction, params);

        // Edit actions
        case 'edit_info':
          return this.handleEditInfoButton(interaction, params);
        case 'update_dates':
          return this.handleUpdateDatesButton(interaction, params);
        case 'add_dates':
          return this.handleAddDatesButton(interaction, params);
        case 'remove_dates':
          return this.handleRemoveDatesButton(interaction, params);
        case 'confirm_remove_date':
          return this.handleConfirmRemoveDateButton(interaction, params);
        case 'edit_deadline':
          return this.handleEditDeadlineButton(interaction, params);
        case 'reminder_edit':
          return this.handleReminderEditButton(interaction, params);

        // Display actions
        case 'toggle_details':
          return this.handleToggleDetailsButton(interaction, params, env);

        default:
          return this.createErrorResponse('不明なボタンです。');
      }
    } catch (error) {
      this.logger.error('Error in handleButtonInteraction', error instanceof Error ? error : new Error(String(error)), {
        operation: 'handle-button-interaction',
        useCase: 'ButtonInteractionController',
        customId: interaction.data.custom_id,
        guildId: interaction.guild_id,
      });
      return this.createErrorResponse('ボタンの処理中にエラーが発生しました。');
    }
  }

  // Vote handlers
  private async handleRespondButton(
    interaction: ButtonInteraction,
    params: string[],
    env: Env
  ): Promise<Response> {
    const { createVoteController } = await import('./VoteController');
    const controller = createVoteController(env);
    return controller.handleRespondButton(interaction, params, env);
  }

  // Schedule management handlers
  private async handleStatusButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    const { createScheduleManagementController } = await import('./ScheduleManagementController');
    const controller = createScheduleManagementController(this.dependencyContainer.env);
    return controller.handleStatusButton(interaction, params);
  }

  private async handleEditButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    const { createScheduleManagementController } = await import('./ScheduleManagementController');
    const controller = createScheduleManagementController(this.dependencyContainer.env);
    return controller.handleEditButton(interaction, params);
  }

  private async handleDetailsButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    const { createScheduleManagementController } = await import('./ScheduleManagementController');
    const controller = createScheduleManagementController(this.dependencyContainer.env);
    return controller.handleDetailsButton(interaction, params);
  }

  private async handleCloseButton(
    interaction: ButtonInteraction,
    params: string[],
    env: Env
  ): Promise<Response> {
    const { createScheduleManagementController } = await import('./ScheduleManagementController');
    const controller = createScheduleManagementController(env);
    return controller.handleCloseButton(interaction, params, env);
  }

  private async handleReopenButton(
    interaction: ButtonInteraction,
    params: string[],
    env: Env
  ): Promise<Response> {
    const { createScheduleManagementController } = await import('./ScheduleManagementController');
    const controller = createScheduleManagementController(env);
    return controller.handleReopenButton(interaction, params, env);
  }

  private async handleDeleteButton(
    interaction: ButtonInteraction,
    params: string[],
    env: Env
  ): Promise<Response> {
    const { createScheduleManagementController } = await import('./ScheduleManagementController');
    const controller = createScheduleManagementController(env);
    return controller.handleDeleteButton(interaction, params, env);
  }

  private async handleRefreshButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    const { createScheduleManagementController } = await import('./ScheduleManagementController');
    const controller = createScheduleManagementController(this.dependencyContainer.env);
    return controller.handleRefreshButton(interaction, params);
  }

  private async handleHideDetailsButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    const { createScheduleManagementController } = await import('./ScheduleManagementController');
    const controller = createScheduleManagementController(this.dependencyContainer.env);
    return controller.handleHideDetailsButton(interaction, params);
  }

  // Edit handlers
  private async handleEditInfoButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    const { createScheduleEditController } = await import('./ScheduleEditController');
    const controller = createScheduleEditController(this.dependencyContainer.env);
    return controller.handleEditInfoButton(interaction, params);
  }

  private async handleUpdateDatesButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    const { createScheduleEditController } = await import('./ScheduleEditController');
    const controller = createScheduleEditController(this.dependencyContainer.env);
    return controller.handleUpdateDatesButton(interaction, params);
  }

  private async handleAddDatesButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    const { createScheduleEditController } = await import('./ScheduleEditController');
    const controller = createScheduleEditController(this.dependencyContainer.env);
    return controller.handleAddDatesButton(interaction, params);
  }

  private async handleRemoveDatesButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    const { createScheduleEditController } = await import('./ScheduleEditController');
    const controller = createScheduleEditController(this.dependencyContainer.env);
    return controller.handleRemoveDatesButton(interaction, params);
  }

  private async handleConfirmRemoveDateButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    const { createScheduleEditController } = await import('./ScheduleEditController');
    const controller = createScheduleEditController(this.dependencyContainer.env);
    return controller.handleConfirmRemoveDateButton(interaction, params);
  }

  private async handleEditDeadlineButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    const { createScheduleEditController } = await import('./ScheduleEditController');
    const controller = createScheduleEditController(this.dependencyContainer.env);
    return controller.handleEditDeadlineButton(interaction, params);
  }

  private async handleReminderEditButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    const { createScheduleEditController } = await import('./ScheduleEditController');
    const controller = createScheduleEditController(this.dependencyContainer.env);
    return controller.handleReminderEditButton(interaction, params);
  }

  // Display handlers
  private async handleToggleDetailsButton(
    interaction: ButtonInteraction,
    params: string[],
    env: Env
  ): Promise<Response> {
    const { createDisplayController } = await import('./DisplayController');
    const controller = createDisplayController(env);
    return controller.handleToggleDetailsButton(interaction, params, env);
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
 * Factory function for creating controller
 */
export function createButtonInteractionController(env: Env): ButtonInteractionController {
  const container = new DependencyContainer(env);
  return new ButtonInteractionController(container);
}

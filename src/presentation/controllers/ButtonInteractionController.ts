/**
 * Button Interaction Controller
 * 
 * ボタンインタラクション機能のコントローラー
 * 元: src/handlers/buttons.ts の Clean Architecture版
 */

import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ButtonInteraction, Env } from '../../types/discord';
import { parseButtonId } from '../../utils/id';
import {
  handleEditButton,
  handleStatusButton,
  handleDetailsButton,
  handleCloseButton,
  handleReopenButton,
  handleDeleteButton,
  handleRefreshButton,
  handleHideDetailsButton,
} from '../../handlers/schedule-handlers';
import {
  handleToggleDetailsButton
} from '../../handlers/display-handlers';
import {
  handleEditInfoButton,
  handleUpdateDatesButton,
  handleAddDatesButton,
  handleRemoveDatesButton,
  handleConfirmRemoveDateButton,
  handleEditDeadlineButton,
  handleReminderEditButton
} from '../../handlers/edit-handlers';
import {
  handleAddCommentButton,
  handleCommentButton
} from '../../handlers/comment-handlers';
import {
  handleRespondButton
} from '../../handlers/vote-handlers';
import { StorageServiceV2 as StorageService } from '../../services/storage-v2';

export class ButtonInteractionController {
  /**
   * ボタンインタラクション処理
   */
  async handleButtonInteraction(
    interaction: ButtonInteraction,
    env: Env
  ): Promise<Response> {
    try {
      const customId = interaction.data.custom_id;
      const { action, params } = parseButtonId(customId);
      const storage = new StorageService(env);

      return this.routeButtonAction(action, interaction, storage, params, env);

    } catch (error) {
      console.error('Error in handleButtonInteraction:', error);
      return this.createErrorResponse('ボタンの処理中にエラーが発生しました。');
    }
  }

  private async routeButtonAction(
    action: string,
    interaction: ButtonInteraction,
    storage: StorageService,
    params: string[],
    env: Env
  ): Promise<Response> {
    switch (action) {
      case 'respond':
        return handleRespondButton(interaction, storage, params, env);
      case 'status':
        return handleStatusButton(interaction, storage, params);
      case 'edit':
        return handleEditButton(interaction, storage, params);
      case 'details':
        return handleDetailsButton(interaction, storage, params);
      case 'close':
        return handleCloseButton(interaction, storage, params, env);
      case 'reopen':
        return handleReopenButton(interaction, storage, params, env);
      case 'delete':
        return handleDeleteButton(interaction, storage, params, env);
      case 'edit_info':
        return handleEditInfoButton(interaction, storage, params);
      case 'update_dates':
        return handleUpdateDatesButton(interaction, storage, params);
      case 'add_dates':
        return handleAddDatesButton(interaction, storage, params);
      case 'remove_dates':
        return handleRemoveDatesButton(interaction, storage, params);
      case 'confirm_remove_date':
        return handleConfirmRemoveDateButton(interaction, storage, params);
      case 'edit_deadline':
        return handleEditDeadlineButton(interaction, storage, params);
      case 'add_comment':
        return handleAddCommentButton(interaction, storage, params);
      case 'comment':
        return handleCommentButton(interaction, storage, params);
      case 'toggle_details':
        return handleToggleDetailsButton(interaction, storage, params, env);
      case 'refresh':
        return handleRefreshButton(interaction, storage, params, env);
      case 'hide_details':
        return handleHideDetailsButton(interaction, storage, params, env);
      case 'reminder_edit':
        return handleReminderEditButton(interaction, storage, params);
      default:
        return this.createErrorResponse('不明なボタンです。');
    }
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
 * Factory function for creating controller
 */
export function createButtonInteractionController(): ButtonInteractionController {
  return new ButtonInteractionController();
}
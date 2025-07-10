import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ButtonInteraction, Env } from '../types/discord';
import { ResponseStatus, STATUS_EMOJI, EMBED_COLORS, ScheduleSummary, Schedule } from '../types/schedule';
import { StorageServiceV2 as StorageService } from '../services/storage-v2';
import { parseButtonId } from '../utils/id';
import {
  handleEditButton,
  handleStatusButton,
  handleDetailsButton,
  handleCloseButton,
  handleReopenButton,
  handleDeleteButton,
  handleRefreshButton,
  handleHideDetailsButton,
} from './schedule-handlers';
import {
  handleToggleDetailsButton
} from './display-handlers';
import {
  handleEditInfoButton,
  handleUpdateDatesButton,
  handleAddDatesButton,
  handleRemoveDatesButton,
  handleConfirmRemoveDateButton,
  handleEditDeadlineButton,
  handleReminderEditButton
} from './edit-handlers';
import {
  handleExportButton,
  handleShowAllButton
} from './export-handlers';
import {
  handleAddCommentButton,
  handleCommentButton
} from './comment-handlers';
import {
  handleDirectVoteButton
} from './quick-vote-handlers';
import {
  handleRespondButton,
  handleDateSelectMenu
} from './vote-handlers';

export async function handleButtonInteraction(
  interaction: ButtonInteraction,
  env: Env
): Promise<Response> {
  const customId = interaction.data.custom_id;
  
  // Handle select menu interactions
  if (customId.startsWith('dateselect:')) {
    return handleDateSelectMenu(interaction, env);
  }
  
  const { action, params } = parseButtonId(customId);
  const storage = new StorageService(env.SCHEDULES, env.RESPONSES);

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
    case 'export':
      return handleExportButton(interaction, storage, params);
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
    case 'direct_vote':
      return handleDirectVoteButton(interaction, storage, params, env);
    case 'add_comment':
      return handleAddCommentButton(interaction, storage, params);
    case 'comment':
      return handleCommentButton(interaction, storage, params);
    case 'show_all':
      return handleShowAllButton(interaction, storage, params);
    case 'toggle_details':
      return handleToggleDetailsButton(interaction, storage, params, env);
    case 'refresh':
      return handleRefreshButton(interaction, storage, params, env);
    case 'hide_details':
      return handleHideDetailsButton(interaction, storage, params, env);
    case 'reminder_edit':
      return handleReminderEditButton(interaction, storage, params);
    default:
      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '不明なボタンです。',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });
  }
}

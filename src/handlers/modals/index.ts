import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ModalSubmitInteraction, Env } from '../../types/discord';
import { StorageService } from '../../services/storage';
import { parseButtonId } from '../../utils/id';
import { handleCreateScheduleModal } from './create-schedule';
import { handleInteractiveResponseModal, handleBulkResponseModal } from './response';
import { 
  handleEditInfoModal, 
  handleUpdateDatesModal, 
  handleAddDatesModal, 
  handleEditDeadlineModal 
} from './edit';
import { handleAddCommentModal, handleDateCommentModal } from './comment';

export async function handleModalSubmit(
  interaction: ModalSubmitInteraction,
  env: Env
): Promise<Response> {
  const customId = interaction.data.custom_id;
  const { action, params } = parseButtonId(customId);
  const storage = new StorageService(env.SCHEDULES, env.RESPONSES);
  
  // Handle both 'modal:create_schedule' and 'create_schedule' formats
  const modalAction = action === 'modal' && params.length > 0 ? params[0] : action;
  const modalParams = action === 'modal' ? params.slice(1) : params;

  switch (modalAction) {
    case 'create_schedule':
      return handleCreateScheduleModal(interaction, storage, env);
      
    case 'interactive_response':
      return handleInteractiveResponseModal(interaction, storage, modalParams, env);
      
    case 'response':
      // Legacy response modal handling
      return handleBulkResponseModal(interaction, storage, modalParams, env);
      
    case 'bulk_response':
      return handleBulkResponseModal(interaction, storage, modalParams, env);
      
    case 'edit_info':
      return handleEditInfoModal(interaction, storage, modalParams, env);
      
    case 'update_dates':
      return handleUpdateDatesModal(interaction, storage, modalParams, env);
      
    case 'add_dates':
      return handleAddDatesModal(interaction, storage, modalParams, env);
      
    case 'add_comment':
      return handleAddCommentModal(interaction, storage, modalParams);
      
    case 'date_comment':
      return handleDateCommentModal(interaction, storage, modalParams);
      
    case 'select_response':
      // Legacy handling - can be removed
      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'この機能は新しい回答方法に置き換えられました。',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });
      
    case 'edit_deadline':
      return handleEditDeadlineModal(interaction, storage, modalParams, env);
      
    default:
      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '不明なモーダルです。',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });
  }
}
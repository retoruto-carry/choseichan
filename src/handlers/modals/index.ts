import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ModalInteraction, Env } from '../../types/discord';
import { StorageServiceV2 as StorageService } from '../../services/storage-v2';
import { parseButtonId } from '../../utils/id';
import { handleCreateScheduleModal } from './create-schedule';
import { 
  handleEditInfoModal, 
  handleUpdateDatesModal, 
  handleAddDatesModal, 
  handleEditDeadlineModal,
  handleEditReminderModal
} from './edit';
import { handleAddCommentModal, handleDateCommentModal } from './comment';

export async function handleModalSubmit(
  interaction: ModalInteraction,
  env: Env
): Promise<Response> {
  const customId = interaction.data.custom_id;
  const { action, params } = parseButtonId(customId);
  const storage = new StorageService(env);
  
  // Handle both 'modal:create_schedule' and 'create_schedule' formats
  const modalAction = action === 'modal' && params.length > 0 ? params[0] : action;
  const modalParams = action === 'modal' ? params.slice(1) : params;

  switch (modalAction) {
    case 'create_schedule':
      return handleCreateScheduleModal(interaction, storage, env);
      
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
      
      
    case 'edit_deadline':
      return handleEditDeadlineModal(interaction, storage, modalParams, env);
      
    case 'edit_reminder':
      return handleEditReminderModal(interaction, storage, modalParams, env);
      
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
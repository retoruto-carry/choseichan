import { InteractionResponseType } from 'discord-interactions';
import { ButtonInteraction } from '../types/discord';
import { StorageService } from '../services/storage';

export async function handleAddCommentButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const [scheduleId] = params;
  const userId = interaction.member?.user.id || interaction.user?.id || '';
  
  // 現在のコメントを取得
  const userResponse = await storage.getResponse(scheduleId, userId);
  const currentComment = userResponse?.comment || '';

  // モーダルを表示
  return new Response(JSON.stringify({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `modal:add_comment:${scheduleId}`,
      title: 'コメントを追加',
      components: [
        {
          type: 1,
          components: [{
            type: 4,
            custom_id: 'comment',
            label: 'コメント',
            style: 2,
            placeholder: '参加条件や要望など',
            value: currentComment,
            required: false,
            max_length: 200
          }]
        }
      ]
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleCommentButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const [scheduleId, dateId] = params;
  const userId = interaction.member?.user.id || interaction.user?.id || '';
  
  // Get current comment for this specific date
  const userResponse = await storage.getResponse(scheduleId, userId);
  const dateResponse = userResponse?.responses.find(r => r.dateId === dateId);
  const currentComment = dateResponse?.comment || '';
  
  const schedule = await storage.getSchedule(scheduleId);
  const date = schedule?.dates.find(d => d.id === dateId);
  
  // Show modal for adding/editing comment for specific date
  return new Response(JSON.stringify({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `modal:date_comment:${scheduleId}:${dateId}`,
      title: date ? date.datetime : 'コメント',
      components: [
        {
          type: 1,
          components: [{
            type: 4,
            custom_id: 'comment',
            label: 'この日程へのコメント',
            style: 2,
            placeholder: '例: 午後なら参加可能',
            value: currentComment,
            required: false,
            max_length: 100
          }]
        }
      ]
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
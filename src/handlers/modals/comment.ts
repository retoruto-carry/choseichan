import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ModalInteraction, Env } from '../../types/discord';
import { EMBED_COLORS } from '../../types/schedule';
import { StorageService } from '../../services/storage';

export async function handleAddCommentModal(
  interaction: ModalInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const [scheduleId] = params;
  
  const schedule = await storage.getSchedule(scheduleId);
  if (!schedule) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程調整が見つかりません。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const comment = interaction.data.components[0].components[0].value || '';
  
  // Get or create user response
  let userResponse = await storage.getResponse(scheduleId, userId);
  
  if (!userResponse) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'まず日程の回答を行ってからコメントを追加してください。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Update comment
  userResponse.comment = comment;
  userResponse.updatedAt = new Date();
  await storage.saveResponse(userResponse);

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '💬 コメントを更新しました',
        description: comment || 'コメントを削除しました。',
        color: EMBED_COLORS.INFO
      }],
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleDateCommentModal(
  interaction: ModalInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const [scheduleId, dateId] = params;
  
  const schedule = await storage.getSchedule(scheduleId);
  if (!schedule) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程調整が見つかりません。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const comment = interaction.data.components[0].components[0].value || '';
  
  // Get or create user response
  let userResponse = await storage.getResponse(scheduleId, userId);
  
  if (!userResponse) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'まず日程の回答を行ってからコメントを追加してください。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Find and update the specific date comment
  const responseIndex = userResponse.responses.findIndex(r => r.dateId === dateId);
  if (responseIndex >= 0) {
    userResponse.responses[responseIndex].comment = comment;
  }
  
  userResponse.updatedAt = new Date();
  await storage.saveResponse(userResponse);

  const dateInfo = schedule.dates.find(d => d.id === dateId);

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '💬 日程別コメントを更新しました',
        description: `**${dateInfo?.datetime || '不明な日程'}**\n${comment || 'コメントを削除しました。'}`,
        color: EMBED_COLORS.INFO
      }],
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
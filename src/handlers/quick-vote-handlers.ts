import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ButtonInteraction, Env } from '../types/discord';
import { ResponseStatus, STATUS_EMOJI } from '../types/schedule';
import { StorageServiceV2 as StorageService } from '../services/storage-v2';
import { updateOriginalMessage } from '../utils/discord';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../utils/embeds';
import { saveScheduleMessageId } from '../utils/schedule-updater';

export async function handleDirectVoteButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const guildId = interaction.guild_id || 'default';
  const [scheduleId, dateId, status] = params;
  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userName = interaction.member?.user.username || interaction.user?.username || '';
  
  const schedule = await storage.getSchedule(scheduleId, guildId);
  if (!schedule || schedule.status === 'closed') {
    // Don't send error messages for main message button clicks
    return new Response(JSON.stringify({
      type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Get or create user response
  let userResponse = await storage.getResponse(scheduleId, userId, guildId);
  
  if (!userResponse) {
    userResponse = {
      scheduleId,
      userId,
      userName,
      responses: [],
      comment: '',
      updatedAt: new Date()
    };
  }

  // Update the specific date response
  const responseStatus = status as ResponseStatus;
  const existingIndex = userResponse.responses.findIndex(r => r.dateId === dateId);
  
  if (existingIndex >= 0) {
    userResponse.responses[existingIndex].status = responseStatus;
  } else {
    userResponse.responses.push({
      dateId,
      status: responseStatus
    });
  }
  
  userResponse.updatedAt = new Date();
  await storage.saveResponse(userResponse, guildId);

  // Save message ID if not already saved
  if (interaction.message?.id && !schedule.messageId) {
    await saveScheduleMessageId(scheduleId, interaction.message.id, storage, guildId);
  }

  // Update the message with optimistic update
  const summary = await storage.getScheduleSummaryWithOptimisticUpdate(scheduleId, guildId, userResponse);
  if (summary && interaction.message?.id && env.DISCORD_APPLICATION_ID) {
    try {
      await updateOriginalMessage(
        env.DISCORD_APPLICATION_ID,
        interaction.token,
        interaction.message.id,
        {
          embeds: [createScheduleEmbedWithTable(summary, false)],
          components: createSimpleScheduleComponents(summary.schedule)
        }
      );
    } catch (error) {
      console.error('Failed to update original message:', error);
    }
  }

  return new Response(JSON.stringify({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE
  }), { headers: { 'Content-Type': 'application/json' } });
}
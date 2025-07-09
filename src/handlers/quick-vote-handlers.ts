import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ButtonInteraction, Env } from '../types/discord';
import { ResponseStatus, STATUS_EMOJI } from '../types/schedule';
import { StorageService } from '../services/storage';
import { createButtonId } from '../utils/id';
import { updateOriginalMessage } from '../utils/discord';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../utils/embeds';

export async function handleQuickVoteButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
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

  if (schedule.status === 'closed') {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'この日程調整は締め切られています。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Create voting buttons for all dates
  const components = [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3, // Success
          label: 'すべて○',
          custom_id: createButtonId('quick_vote_status', scheduleId, 'yes'),
          emoji: { name: '⭕' }
        },
        {
          type: 2,
          style: 1, // Primary
          label: 'すべて△',
          custom_id: createButtonId('quick_vote_status', scheduleId, 'maybe'),
          emoji: { name: '🔺' }
        },
        {
          type: 2,
          style: 4, // Danger
          label: 'すべて×',
          custom_id: createButtonId('quick_vote_status', scheduleId, 'no'),
          emoji: { name: '❌' }
        },
        {
          type: 2,
          style: 2, // Secondary
          label: '個別に回答',
          custom_id: createButtonId('response', scheduleId),
          emoji: { name: '📝' }
        }
      ]
    }
  ];

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `**${schedule.title}**\n\nすべての日程に同じ回答をする場合は以下のボタンを、個別に回答する場合は「個別に回答」を選択してください。`,
      components,
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleQuickVoteStatusButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId, status] = params;
  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userName = interaction.member?.user.username || interaction.user?.username || '';
  
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

  // Create responses for all dates
  const responses = schedule.dates.map(date => ({
    dateId: date.id,
    status: status as ResponseStatus
  }));

  const userResponse = {
    scheduleId,
    userId,
    userName,
    responses,
    comment: '',
    updatedAt: new Date()
  };

  await storage.saveResponse(userResponse);

  // Update the original message
  if (interaction.message?.message_reference?.message_id && env.DISCORD_APPLICATION_ID) {
    const summary = await storage.getScheduleSummary(scheduleId);
    if (summary) {
      try {
        await updateOriginalMessage(
          env.DISCORD_APPLICATION_ID,
          interaction.token,
          interaction.message.message_reference.message_id,
          {
            embeds: [createScheduleEmbedWithTable(summary)],
            components: createSimpleScheduleComponents(summary.schedule)
          }
        );
      } catch (error) {
        console.error('Failed to update original message:', error);
      }
    }
  }

  return new Response(JSON.stringify({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      content: `✅ すべての日程に ${STATUS_EMOJI[status as ResponseStatus]} で回答しました！`
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleDirectVoteButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId, dateId, status] = params;
  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userName = interaction.member?.user.username || interaction.user?.username || '';
  
  const schedule = await storage.getSchedule(scheduleId);
  if (!schedule || schedule.status === 'closed') {
    // Don't send error messages for main message button clicks
    return new Response(JSON.stringify({
      type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Get or create user response
  let userResponse = await storage.getResponse(scheduleId, userId);
  
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
  await storage.saveResponse(userResponse);

  // Update the message
  const summary = await storage.getScheduleSummary(scheduleId);
  if (summary && interaction.message?.id && env.DISCORD_APPLICATION_ID) {
    try {
      await updateOriginalMessage(
        env.DISCORD_APPLICATION_ID,
        interaction.token,
        interaction.message.id,
        {
          embeds: [createScheduleEmbedWithTable(summary)],
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
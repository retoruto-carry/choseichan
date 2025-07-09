import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ButtonInteraction, Env } from '../types/discord';
import { ResponseStatus, STATUS_EMOJI, Schedule } from '../types/schedule';
import { StorageService } from '../services/storage';
import { updateOriginalMessage } from '../utils/discord';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../utils/embeds';
import { 
  createEphemeralResponse, 
  createErrorResponse
} from '../utils/responses';

export async function handleRespondButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId] = params;
  
  const schedule = await storage.getSchedule(scheduleId);
  if (!schedule) {
    return createErrorResponse('日程調整が見つかりません。');
  }

  if (schedule.status === 'closed') {
    return createErrorResponse('この日程調整は締め切られています。');
  }

  // Get current user's responses
  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userResponse = await storage.getResponse(scheduleId, userId);
  
  // Create ephemeral message with select menus for each date (limit to 4 to leave room for complete button)
  const components = schedule.dates.slice(0, 4).map((date, idx) => {
    const existingResponse = userResponse?.responses.find(r => r.dateId === date.id);
    const existingStatus = existingResponse?.status;
    
    // Set placeholder based on current status
    let placeholder = '';
    if (!existingStatus) {
      placeholder = `未回答 ${date.datetime}`;
    } else if (existingStatus === 'yes') {
      placeholder = `○ ${date.datetime}`;
    } else if (existingStatus === 'maybe') {
      placeholder = `△ ${date.datetime}`;
    } else if (existingStatus === 'no') {
      placeholder = `× ${date.datetime}`;
    }
    
    return {
      type: 1, // Action Row
      components: [{
        type: 3, // Select Menu
        custom_id: `dateselect:${scheduleId}:${date.id}`,
        placeholder,
        options: [
          {
            label: `未回答 ${date.datetime}`,
            value: 'none',
            default: !existingStatus
          },
          {
            label: `○ ${date.datetime}`,
            value: 'yes',
            default: existingStatus === 'yes'
          },
          {
            label: `△ ${date.datetime}`,
            value: 'maybe',
            default: existingStatus === 'maybe'
          },
          {
            label: `× ${date.datetime}`,
            value: 'no',
            default: existingStatus === 'no'
          }
        ]
      }]
    };
  });

  const message = `**${schedule.title}** の回答を選択してください:\n`

  return createEphemeralResponse(
    message,
    undefined,
    components
  );
}

export async function handleResponseButton(
  interaction: ButtonInteraction,
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

  if (schedule.status === 'closed') {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'この日程調整は締め切られています。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userName = interaction.member?.user.username || interaction.user?.username || 'Unknown';

  // Get existing user response
  const existingResponse = await storage.getResponse(scheduleId, userId);

  // Create components for each date with current status
  const components = schedule.dates.slice(0, 25).map((date, idx) => {
    const userDateResponse = existingResponse?.responses.find(r => r.dateId === date.id);
    const currentStatus = userDateResponse?.status;

    return {
      type: 1, // Action Row
      components: [
        {
          type: 2,
          style: currentStatus === 'yes' ? 3 : 2, // Green if yes, gray otherwise
          label: '○',
          custom_id: `vote:${scheduleId}:${date.id}:yes`,
          emoji: { name: '⭕' }
        },
        {
          type: 2,
          style: currentStatus === 'maybe' ? 3 : 2, // Green if maybe, gray otherwise
          label: '△',
          custom_id: `vote:${scheduleId}:${date.id}:maybe`,
          emoji: { name: '🔺' }
        },
        {
          type: 2,
          style: currentStatus === 'no' ? 4 : 2, // Red if no, gray otherwise
          label: '×',
          custom_id: `vote:${scheduleId}:${date.id}:no`,
          emoji: { name: '❌' }
        },
        {
          type: 2,
          style: 2,
          label: date.datetime,
          custom_id: `date_label:${date.id}`,
          disabled: true
        }
      ]
    };
  });

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `**${schedule.title}** への回答\n\n各日程に対して ○（参加可能）、△（調整中）、×（参加不可）で回答してください。`,
      components: components.slice(0, 5), // Discord limit
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleVoteButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId, dateId, status] = params;
  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userName = interaction.member?.user.username || interaction.user?.username || 'Unknown';
  
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

  // Find existing response for this date
  const existingIndex = userResponse.responses.findIndex(r => r.dateId === dateId);
  
  if (existingIndex >= 0) {
    // Update existing response
    userResponse.responses[existingIndex].status = status as ResponseStatus;
  } else {
    // Add new response
    userResponse.responses.push({
      dateId,
      status: status as ResponseStatus
    });
  }
  
  userResponse!.updatedAt = new Date();
  await storage.saveResponse(userResponse!);

  // Update the main message
  const summary = await storage.getScheduleSummary(scheduleId);
  if (summary && interaction.message?.message_reference?.message_id && env.DISCORD_APPLICATION_ID) {
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

  const date = schedule.dates.find(d => d.id === dateId);
  const statusText = status === 'yes' ? '○ 参加可能' :
    status === 'maybe' ? '△ 調整中' : '× 参加不可';

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ ${date ? date.datetime : '日程'} を ${statusText} に更新しました`,
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleDateSelectMenu(
  interaction: ButtonInteraction,
  env: Env
): Promise<Response> {
  const parts = interaction.data.custom_id.split(':');
  const [_, scheduleId, dateId] = parts;
  
  const storage = new StorageService(env.SCHEDULES, env.RESPONSES);
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
  const userName = interaction.member?.user.username || interaction.user?.username || '';
  
  // Get selected value from select menu
  const selectedValue = interaction.data.values?.[0] || 'none';
  
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
  if (selectedValue === 'none') {
    // Remove the response for this date
    userResponse.responses = userResponse.responses.filter(r => r.dateId !== dateId);
  } else {
    const status = selectedValue as ResponseStatus;
    const existingIndex = userResponse.responses.findIndex(r => r.dateId === dateId);
    
    if (existingIndex >= 0) {
      userResponse.responses[existingIndex].status = status;
    } else {
      userResponse.responses.push({
        dateId,
        status
      });
    }
  }
  
  userResponse.updatedAt = new Date();
  await storage.saveResponse(userResponse);
  
  // Update the original message with new vote counts
  const summary = await storage.getScheduleSummary(scheduleId);
  if (summary && interaction.message?.message_reference?.message_id && env.DISCORD_APPLICATION_ID) {
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
  
  // Simple acknowledgment without updating components
  const date = schedule.dates.find(d => d.id === dateId);
  const statusText = selectedValue === 'none' ? '未回答' : 
    selectedValue === 'yes' ? '○ 参加可能' :
    selectedValue === 'maybe' ? '△ 調整中' : '× 参加不可';
  
  // Use type 6 for DEFERRED_UPDATE_MESSAGE to immediately acknowledge
  return new Response(JSON.stringify({
    type: 6
  }), { headers: { 'Content-Type': 'application/json' } });
}
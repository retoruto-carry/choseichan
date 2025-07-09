import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { Env } from '../types/discord';
import { Response as ScheduleResponse, ResponseStatus, STATUS_EMOJI, EMBED_COLORS } from '../types/schedule';
import { StorageService } from '../services/storage';
import { formatDate } from '../utils/date';
import { updateOriginalMessage } from '../utils/discord';
import { createButtonId } from '../utils/id';

interface ModalSubmitInteraction {
  id: string;
  type: number;
  data: {
    custom_id: string;
    components: Array<{
      type: number;
      components: Array<{
        type: number;
        custom_id: string;
        value: string;
      }>;
    }>;
  };
  guild_id?: string;
  channel_id?: string;
  member?: {
    user: {
      id: string;
      username: string;
      discriminator: string;
    };
    roles: string[];
  };
  user?: {
    id: string;
    username: string;
    discriminator: string;
  };
  token: string;
  message?: {
    id: string;
    embeds: any[];
  };
}

export async function handleModalSubmit(
  interaction: ModalSubmitInteraction,
  env: Env
): Promise<Response> {
  const parts = interaction.data.custom_id.split(':');
  const [type, action, ...params] = parts;

  if (type !== 'modal') {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '不明なモーダルです。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const storage = new StorageService(env.SCHEDULES, env.RESPONSES);

  switch (action) {
    case 'response':
      return handleResponseModal(interaction, storage, params, env);
    default:
      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '不明なモーダルタイプです。',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleResponseModal(
  interaction: ModalSubmitInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId, dateId] = params;
  
  // Extract values from modal
  const statusValue = interaction.data.components
    .flatMap(row => row.components)
    .find(c => c.custom_id === 'status')?.value || '';
  
  const comment = interaction.data.components
    .flatMap(row => row.components)
    .find(c => c.custom_id === 'comment')?.value || '';

  // Convert status symbol to enum
  let status: ResponseStatus;
  switch (statusValue) {
    case '○':
    case 'o':
    case 'O':
      status = 'yes';
      break;
    case '△':
    case '▲':
    case '?':
      status = 'maybe';
      break;
    case '×':
    case 'x':
    case 'X':
      status = 'no';
      break;
    default:
      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '参加可否は ○、△、× のいずれかで入力してください。',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });
  }

  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userName = interaction.member?.user.username || interaction.user?.username || '';

  // Get or create user response
  let userResponse = await storage.getResponse(scheduleId, userId);
  
  if (!userResponse) {
    userResponse = {
      scheduleId,
      userId,
      userName,
      responses: [],
      comment,
      updatedAt: new Date()
    };
  }

  // Update the specific date response
  const existingIndex = userResponse.responses.findIndex(r => r.dateId === dateId);
  if (existingIndex >= 0) {
    userResponse.responses[existingIndex].status = status;
  } else {
    userResponse.responses.push({
      dateId,
      status
    });
  }
  
  userResponse.comment = comment;
  userResponse.updatedAt = new Date();

  await storage.saveResponse(userResponse);

  // Get updated summary
  const summary = await storage.getScheduleSummary(scheduleId);
  if (!summary) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程調整の更新に失敗しました。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Update the original message with new counts
  const updatedEmbed = createUpdatedScheduleEmbed(summary);
  const components = createScheduleComponents(summary.schedule);
  
  // Update the original message
  if (interaction.message?.id && env.DISCORD_APPLICATION_ID && interaction.token) {
    try {
      await updateOriginalMessage(
        env.DISCORD_APPLICATION_ID,
        interaction.token,
        interaction.message.id,
        {
          embeds: [updatedEmbed],
          components
        }
      );
    } catch (error) {
      console.error('Failed to update original message:', error);
    }
  }
  
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `${STATUS_EMOJI[status]} 回答を記録しました！`,
      embeds: [createResponseConfirmationEmbed(userResponse, summary)],
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

function createUpdatedScheduleEmbed(summary: import('../types/schedule').ScheduleSummary) {
  const { schedule, responseCounts, userResponses, bestDateId } = summary;
  
  return {
    title: `📅 ${schedule.title}`,
    description: schedule.description || '日程調整にご協力ください',
    color: schedule.status === 'open' ? EMBED_COLORS.OPEN : EMBED_COLORS.CLOSED,
    fields: [
      {
        name: '状態',
        value: schedule.status === 'open' ? '🟢 受付中' : '🔴 締切',
        inline: true
      },
      {
        name: '作成者',
        value: schedule.createdBy.username,
        inline: true
      },
      {
        name: '回答者数',
        value: `${userResponses.length}人`,
        inline: true
      },
      ...schedule.dates.map(date => {
        const count = responseCounts[date.id];
        const isBest = date.id === bestDateId && userResponses.length > 0;
        return {
          name: `${isBest ? '⭐ ' : ''}${formatDate(date.datetime)}`,
          value: `${STATUS_EMOJI.yes} ${count.yes}人　${STATUS_EMOJI.maybe} ${count.maybe}人　${STATUS_EMOJI.no} ${count.no}人`,
          inline: false
        };
      })
    ],
    footer: {
      text: schedule.deadline ? `締切: ${formatDate(schedule.deadline.toISOString())}` : `ID: ${schedule.id}`
    },
    timestamp: schedule.updatedAt.toISOString()
  };
}

function createResponseConfirmationEmbed(
  userResponse: ScheduleResponse,
  summary: import('../types/schedule').ScheduleSummary
) {
  const { schedule } = summary;
  
  const responseDetails = schedule.dates.map(date => {
    const response = userResponse.responses.find(r => r.dateId === date.id);
    if (!response) return null;
    return `${formatDate(date.datetime)}: ${STATUS_EMOJI[response.status]}`;
  }).filter(Boolean);

  return {
    title: '✅ 回答を記録しました',
    color: EMBED_COLORS.INFO,
    fields: [
      {
        name: '日程調整',
        value: schedule.title,
        inline: false
      },
      {
        name: 'あなたの回答',
        value: responseDetails.join('\n') || '回答なし',
        inline: false
      },
      {
        name: 'コメント',
        value: userResponse.comment || 'なし',
        inline: false
      }
    ],
    footer: {
      text: '回答は何度でも変更できます'
    }
  };
}

function createScheduleComponents(schedule: import('../types/schedule').Schedule) {
  if (schedule.status === 'closed') {
    return [];
  }

  const rows = [];
  const dateButtons = schedule.dates.map(date => ({
    type: 2,
    style: 2, // Secondary
    label: formatDate(date.datetime),
    custom_id: createButtonId('response', schedule.id, date.id),
    emoji: { name: '📝' }
  }));

  // Split buttons into rows (max 5 per row)
  for (let i = 0; i < dateButtons.length; i += 5) {
    rows.push({
      type: 1,
      components: dateButtons.slice(i, i + 5)
    });
  }

  // Add action buttons
  rows.push({
    type: 1,
    components: [
      {
        type: 2,
        style: 1, // Primary
        label: '詳細を見る',
        custom_id: createButtonId('details', schedule.id),
        emoji: { name: '📋' }
      }
    ]
  });

  return rows;
}
import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ButtonInteraction, Env } from '../types/discord';
import { ResponseStatus, STATUS_EMOJI, EMBED_COLORS } from '../types/schedule';
import { StorageService } from '../services/storage';
import { parseButtonId } from '../utils/id';
import { formatDate } from '../utils/date';

export async function handleButtonInteraction(
  interaction: ButtonInteraction,
  env: Env
): Promise<Response> {
  const { action, params } = parseButtonId(interaction.data.custom_id);
  const storage = new StorageService(env.SCHEDULES, env.RESPONSES);

  switch (action) {
    case 'response':
      return handleResponseButton(interaction, storage, params);
    case 'details':
      return handleDetailsButton(interaction, storage, params);
    case 'close':
      return handleCloseButton(interaction, storage, params);
    case 'delete':
      return handleDeleteButton(interaction, storage, params);
    case 'export':
      return handleExportButton(interaction, storage, params);
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

async function handleResponseButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const [scheduleId, dateId] = params;
  
  if (!scheduleId || !dateId) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '無効なボタンです。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

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

  const date = schedule.dates.find(d => d.id === dateId);
  if (!date) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '指定された日程が見つかりません。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Show modal for response input
  return new Response(JSON.stringify({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `modal:response:${scheduleId}:${dateId}`,
      title: `${schedule.title} - ${formatDate(date.datetime)}`,
      components: [
        {
          type: 1, // Action Row
          components: [{
            type: 4, // Text Input
            custom_id: 'status',
            label: '参加可否',
            style: 1, // Short
            placeholder: '○、△、× のいずれかを入力',
            required: true,
            min_length: 1,
            max_length: 1
          }]
        },
        {
          type: 1,
          components: [{
            type: 4,
            custom_id: 'comment',
            label: 'コメント（任意）',
            style: 2, // Paragraph
            placeholder: '補足事項があれば入力してください',
            required: false,
            max_length: 200
          }]
        }
      ]
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleDetailsButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const [scheduleId] = params;
  
  const summary = await storage.getScheduleSummary(scheduleId);
  if (!summary) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程調整が見つかりません。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const { schedule, responseCounts, userResponses, bestDateId } = summary;
  
  // Create detailed embed
  const embed = {
    title: `📊 ${schedule.title} - 詳細`,
    color: EMBED_COLORS.INFO,
    fields: [
      {
        name: '基本情報',
        value: [
          `作成者: ${schedule.createdBy.username}`,
          `作成日: ${formatDate(schedule.createdAt.toISOString())}`,
          `状態: ${schedule.status === 'open' ? '🟢 受付中' : '🔴 締切'}`,
          schedule.deadline ? `締切: ${formatDate(schedule.deadline.toISOString())}` : '',
          `回答者数: ${userResponses.length}人`
        ].filter(Boolean).join('\n'),
        inline: false
      },
      ...schedule.dates.map(date => {
        const count = responseCounts[date.id];
        const isBest = date.id === bestDateId;
        const respondents = userResponses
          .map(ur => {
            const response = ur.responses.find(r => r.dateId === date.id);
            if (!response) return null;
            return `${STATUS_EMOJI[response.status]} ${ur.userName}`;
          })
          .filter(Boolean);
        
        return {
          name: `${isBest ? '⭐ ' : ''}${formatDate(date.datetime)}`,
          value: [
            `${STATUS_EMOJI.yes} ${count.yes}人　${STATUS_EMOJI.maybe} ${count.maybe}人　${STATUS_EMOJI.no} ${count.no}人`,
            respondents.length > 0 ? respondents.join(', ') : '回答なし'
          ].join('\n'),
          inline: false
        };
      })
    ],
    footer: {
      text: `ID: ${schedule.id}`
    },
    timestamp: schedule.updatedAt.toISOString()
  };

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [embed],
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleCloseButton(
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

  const userId = interaction.member?.user.id || interaction.user?.id;
  if (schedule.createdBy.id !== userId) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程調整を締め切ることができるのは作成者のみです。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  schedule.status = 'closed';
  schedule.updatedAt = new Date();
  await storage.saveSchedule(schedule);

  // Update the original message
  return new Response(JSON.stringify({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      embeds: [createClosedScheduleEmbed(schedule)],
      components: [] // Remove all buttons
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleDeleteButton(
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

  const userId = interaction.member?.user.id || interaction.user?.id;
  if (schedule.createdBy.id !== userId) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程調整を削除できるのは作成者のみです。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  await storage.deleteSchedule(scheduleId);

  return new Response(JSON.stringify({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      content: `日程調整「${schedule.title}」を削除しました。`,
      embeds: [],
      components: []
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleExportButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const [scheduleId] = params;
  
  const summary = await storage.getScheduleSummary(scheduleId);
  if (!summary) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程調整が見つかりません。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const { schedule, userResponses } = summary;
  
  // Create CSV content
  const headers = ['参加者', ...schedule.dates.map(d => formatDate(d.datetime))];
  const rows = userResponses.map(ur => {
    const row = [ur.userName];
    for (const date of schedule.dates) {
      const response = ur.responses.find(r => r.dateId === date.id);
      row.push(response ? STATUS_EMOJI[response.status] : '');
    }
    return row;
  });
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `\`\`\`csv\n${csv}\n\`\`\``,
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

function createClosedScheduleEmbed(schedule: import('../types/schedule').Schedule) {
  return {
    title: `📅 ${schedule.title}`,
    description: schedule.description || '日程調整は締め切られました',
    color: EMBED_COLORS.CLOSED,
    fields: [
      {
        name: '状態',
        value: '🔴 締切',
        inline: true
      },
      {
        name: '作成者',
        value: schedule.createdBy.username,
        inline: true
      },
      {
        name: 'ID',
        value: schedule.id,
        inline: true
      }
    ],
    footer: {
      text: '締め切られた日程調整です'
    },
    timestamp: schedule.updatedAt.toISOString()
  };
}
import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ButtonInteraction, Env } from '../types/discord';
import { ResponseStatus, STATUS_EMOJI, EMBED_COLORS, ScheduleSummary } from '../types/schedule';
import { StorageService } from '../services/storage';
import { parseButtonId, createButtonId } from '../utils/id';
import { formatDate } from '../utils/date';
import { updateOriginalMessage } from '../utils/discord';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from './modals';

export async function handleButtonInteraction(
  interaction: ButtonInteraction,
  env: Env
): Promise<Response> {
  const { action, params } = parseButtonId(interaction.data.custom_id);
  const storage = new StorageService(env.SCHEDULES, env.RESPONSES);

  switch (action) {
    case 'response':
      return handleResponseButton(interaction, storage, params);
    case 'vote':
      return handleVoteButton(interaction, storage, params);
    case 'status':
      return handleStatusButton(interaction, storage, params);
    case 'edit':
      return handleEditButton(interaction, storage, params);
    case 'details':
      return handleDetailsButton(interaction, storage, params);
    case 'close':
      return handleCloseButton(interaction, storage, params);
    case 'delete':
      return handleDeleteButton(interaction, storage, params);
    case 'export':
      return handleExportButton(interaction, storage, params);
    case 'edit_info':
      return handleEditInfoButton(interaction, storage, params);
    case 'add_dates':
      return handleAddDatesButton(interaction, storage, params);
    case 'remove_dates':
      return handleRemoveDatesButton(interaction, storage, params);
    case 'confirm_remove_date':
      return handleConfirmRemoveDateButton(interaction, storage, params);
    case 'date_label':
      // 日付ラベルボタンは非活性だが、念のためハンドラーを追加
      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'このボタンは表示用です。○△×ボタンで回答してください。',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    case 'quick_vote':
      return handleQuickVoteButton(interaction, storage, params, env);
    case 'quick_vote_status':
      return handleQuickVoteStatusButton(interaction, storage, params, env);
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

  // Get current user's responses
  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userResponses = await storage.getUserResponses(scheduleId, userId);
  const userResponseMap = new Map<string, ResponseStatus>();
  
  // Create a map of dateId to status for easier lookup
  for (const response of userResponses) {
    for (const dateResponse of response.responses) {
      userResponseMap.set(dateResponse.dateId, dateResponse.status);
    }
  }
  
  // Create buttons for each date with voting options
  const components = schedule.dates.map(date => {
    const currentStatus = userResponseMap.get(date.id);
    const dateLabel = formatDate(date.datetime);
    
    return {
      type: 1, // Action Row
      components: [
        {
          type: 2, // Button
          style: 2, // Secondary
          label: dateLabel.length > 20 ? dateLabel.substring(0, 20) + '...' : dateLabel,
          custom_id: `date_label:${scheduleId}:${date.id}`, // Unique ID to avoid conflicts
          disabled: true
        },
        {
          type: 2,
          custom_id: `vote:${scheduleId}:${date.id}:yes`,
          label: `○`,
          style: currentStatus === 'yes' ? 3 : 2, // Success if selected
          emoji: { name: '⭕' }
        },
        {
          type: 2,
          custom_id: `vote:${scheduleId}:${date.id}:maybe`,
          label: `△`,
          style: currentStatus === 'maybe' ? 1 : 2, // Primary if selected
          emoji: { name: '🔺' }
        },
        {
          type: 2,
          custom_id: `vote:${scheduleId}:${date.id}:no`,
          label: `×`,
          style: currentStatus === 'no' ? 4 : 2, // Danger if selected
          emoji: { name: '❌' }
        }
      ]
    };
  });

  // Create response status table
  const summary = await storage.getScheduleSummary(scheduleId);
  const tableEmbed = createResponseTableEmbed(summary!);

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `**${schedule.title}** の回答を選択してください:\n\n各日程の横にあるボタンをクリックして回答してください。`,
      embeds: [tableEmbed],
      components: components.slice(0, 5), // Discord限界は5行まで
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleVoteButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
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

  // Handle vote or clear
  if (status === 'clear') {
    // Remove the response for this date
    userResponse!.responses = userResponse!.responses.filter(r => r.dateId !== dateId);
  } else {
    const responseStatus = status as ResponseStatus;
    // Update or add the response for this date
    const existingIndex = userResponse!.responses.findIndex(r => r.dateId === dateId);
    if (existingIndex >= 0) {
      userResponse!.responses[existingIndex].status = responseStatus;
    } else {
      userResponse!.responses.push({
        dateId,
        status: responseStatus
      });
    }
  }
  
  userResponse!.updatedAt = new Date();
  await storage.saveResponse(userResponse!);

  // Update the message with new response data
  const summary = await storage.getScheduleSummary(scheduleId);
  const tableEmbed = createResponseTableEmbed(summary!);
  
  // Get updated user responses
  const updatedUserResponses = await storage.getUserResponses(scheduleId, userId);
  const updatedResponseMap = new Map<string, ResponseStatus>();
  
  // Create a map of dateId to status for easier lookup
  for (const response of updatedUserResponses) {
    for (const dateResponse of response.responses) {
      updatedResponseMap.set(dateResponse.dateId, dateResponse.status);
    }
  }
  
  // Re-create voting buttons with updated state
  const components = schedule.dates.map(date => {
    const currentStatus = updatedResponseMap.get(date.id);
    const dateLabel = formatDate(date.datetime);
    
    return {
      type: 1,
      components: [
        {
          type: 2,
          style: 2,
          label: dateLabel.length > 20 ? dateLabel.substring(0, 20) + '...' : dateLabel,
          custom_id: `date_label:${scheduleId}:${date.id}`,
          disabled: true
        },
        {
          type: 2,
          custom_id: `vote:${scheduleId}:${date.id}:yes`,
          label: `○`,
          style: currentStatus === 'yes' ? 3 : 2,
          emoji: { name: '⭕' }
        },
        {
          type: 2,
          custom_id: `vote:${scheduleId}:${date.id}:maybe`,
          label: `△`,
          style: currentStatus === 'maybe' ? 1 : 2,
          emoji: { name: '🔺' }
        },
        {
          type: 2,
          custom_id: `vote:${scheduleId}:${date.id}:no`,
          label: `×`,
          style: currentStatus === 'no' ? 4 : 2,
          emoji: { name: '❌' }
        }
      ]
    };
  });

  const date = schedule.dates.find(d => d.id === dateId);
  const statusText = status === 'clear' ? 'クリアしました' : STATUS_EMOJI[status as ResponseStatus];
  
  return new Response(JSON.stringify({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      content: `**${schedule.title}** の回答を選択してください:\n✅ ${date ? formatDate(date.datetime) : '日程'} を ${statusText} に更新しました`,
      embeds: [tableEmbed],
      components: components.slice(0, 5)
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

function createResponseTableEmbed(summary: ScheduleSummary) {
  const { schedule, userResponses, responseCounts, bestDateId } = summary;
  
  // 日付を短い形式で表示（月/日 時:分）
  const formatShortDate = (datetime: string) => {
    const date = new Date(datetime);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };
  
  // Create date list with indices
  const dateList = schedule.dates
    .map((date, idx) => {
      const count = responseCounts[date.id];
      const isBest = date.id === bestDateId && userResponses.length > 0;
      return `${idx + 1}. ${isBest ? '⭐ ' : ''}${formatShortDate(date.datetime)} - ○${count.yes} △${count.maybe} ×${count.no}`;
    })
    .join('\n');
  
  // Create compact response table
  let responseTable = '';
  if (userResponses.length > 0) {
    // Header
    const numberHeaders = schedule.dates.map((_, idx) => (idx + 1).toString().padStart(2, ' ')).join(' ');
    responseTable = `\`\`\`\n   ${numberHeaders}\n`;
    
    // User responses
    userResponses.forEach(ur => {
      const userName = ur.userName.length > 10 ? ur.userName.substring(0, 9) + '…' : ur.userName.padEnd(10, ' ');
      const responses = schedule.dates.map(date => {
        const response = ur.responses.find(r => r.dateId === date.id);
        if (!response) return '・';
        switch (response.status) {
          case 'yes': return '○';
          case 'maybe': return '△';
          case 'no': return '×';
          default: return '・';
        }
      }).join(' ');
      responseTable += `${userName} ${responses}\n`;
    });
    
    responseTable += '```';
  }
  
  return {
    title: `📊 ${schedule.title}`,
    description: [
      '**候補日時と集計:**',
      dateList,
      userResponses.length > 0 ? '\n**回答一覧:**' : '',
      responseTable
    ].filter(Boolean).join('\n'),
    color: EMBED_COLORS.INFO,
    fields: [
      {
        name: '回答者数',
        value: `${userResponses.length}人`,
        inline: true
      },
      {
        name: '状態',
        value: schedule.status === 'open' ? '🟢 受付中' : '🔴 締切',
        inline: true
      }
    ],
    footer: {
      text: `ID: ${schedule.id} | 番号は日程の順番を表します`
    },
    timestamp: new Date().toISOString()
  };
}

async function handleStatusButton(
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

  const tableEmbed = createResponseTableEmbed(summary!);
  
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [tableEmbed],
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleEditButton(
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

  // Check if user is the owner
  const userId = interaction.member?.user.id || interaction.user?.id;
  if (schedule.createdBy.id !== userId) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程調整を編集できるのは作成者のみです。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Show edit menu
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: '編集する項目を選択してください：',
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 2,
              label: 'タイトル・説明を編集',
              custom_id: createButtonId('edit_info', scheduleId),
              emoji: { name: '📝' }
            },
            {
              type: 2,
              style: 2,
              label: '日程を追加',
              custom_id: createButtonId('add_dates', scheduleId),
              emoji: { name: '➕' }
            },
            {
              type: 2,
              style: 2,
              label: '日程を削除',
              custom_id: createButtonId('remove_dates', scheduleId),
              emoji: { name: '➖' }
            }
          ]
        },
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 4, // Danger
              label: '締め切る',
              custom_id: createButtonId('close', scheduleId),
              emoji: { name: '🔒' }
            },
            {
              type: 2,
              style: 4, // Danger
              label: '削除する',
              custom_id: createButtonId('delete', scheduleId),
              emoji: { name: '🗑️' }
            }
          ]
        }
      ],
      flags: InteractionResponseFlags.EPHEMERAL
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

async function handleEditInfoButton(
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

  // Show modal for editing title and description
  return new Response(JSON.stringify({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `modal:edit_info:${scheduleId}`,
      title: '日程調整の編集',
      components: [
        {
          type: 1,
          components: [{
            type: 4,
            custom_id: 'title',
            label: 'タイトル',
            style: 1,
            value: schedule.title,
            required: true,
            min_length: 1,
            max_length: 100
          }]
        },
        {
          type: 1,
          components: [{
            type: 4,
            custom_id: 'description',
            label: '説明',
            style: 2,
            value: schedule.description || '',
            required: false,
            max_length: 500
          }]
        }
      ]
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleAddDatesButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const [scheduleId] = params;
  
  return new Response(JSON.stringify({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `modal:add_dates:${scheduleId}`,
      title: '日程を追加',
      components: [
        {
          type: 1,
          components: [{
            type: 4,
            custom_id: 'dates',
            label: '追加する日時（1行に1つずつ）',
            style: 2,
            placeholder: '例:\n12/28 19:00\n12/29 18:00',
            required: true,
            min_length: 1,
            max_length: 500
          }]
        }
      ]
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleRemoveDatesButton(
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

  // Show date selection buttons
  const dateButtons = schedule.dates.map((date, index) => ({
    type: 2,
    style: 4, // Danger
    label: formatDate(date.datetime),
    custom_id: createButtonId('confirm_remove_date', scheduleId, date.id),
    emoji: { name: '🗑️' }
  }));

  const rows = [];
  for (let i = 0; i < dateButtons.length; i += 5) {
    rows.push({
      type: 1,
      components: dateButtons.slice(i, i + 5)
    });
  }

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: '削除する日程を選択してください：',
      components: rows,
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleConfirmRemoveDateButton(
  interaction: ButtonInteraction,
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

  // Remove the date
  const removedDate = schedule.dates.find(d => d.id === dateId);
  schedule.dates = schedule.dates.filter(d => d.id !== dateId);
  
  if (schedule.dates.length === 0) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '最後の日程は削除できません。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  schedule.updatedAt = new Date();
  await storage.saveSchedule(schedule);

  // Also remove all responses for this date
  const responses = await storage.listResponsesBySchedule(scheduleId);
  for (const response of responses) {
    response.responses = response.responses.filter(r => r.dateId !== dateId);
    if (response.responses.length > 0) {
      await storage.saveResponse(response);
    }
  }

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ ${removedDate ? formatDate(removedDate.datetime) : '日程'}を削除しました。`,
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleQuickVoteButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId, dateId] = params;
  const userId = interaction.member?.user.id || interaction.user?.id || '';
  
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

  // 現在の回答を取得
  const userResponses = await storage.getUserResponses(scheduleId, userId);
  const currentResponse = userResponses
    .flatMap(r => r.responses)
    .find(r => r.dateId === dateId);

  // この日程の投票ボタンを表示
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `**${formatDate(date.datetime)}** の参加可否を選択してください:`,
      components: [{
        type: 1,
        components: [
          {
            type: 2,
            style: currentResponse?.status === 'yes' ? 3 : 2,
            label: '参加可能',
            custom_id: createButtonId('quick_vote_status', scheduleId, dateId, 'yes'),
            emoji: { name: '⭕' }
          },
          {
            type: 2,
            style: currentResponse?.status === 'maybe' ? 1 : 2,
            label: '未定',
            custom_id: createButtonId('quick_vote_status', scheduleId, dateId, 'maybe'),
            emoji: { name: '🔺' }
          },
          {
            type: 2,
            style: currentResponse?.status === 'no' ? 4 : 2,
            label: '不参加',
            custom_id: createButtonId('quick_vote_status', scheduleId, dateId, 'no'),
            emoji: { name: '❌' }
          }
        ]
      }],
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleQuickVoteStatusButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId, dateId, status] = params;
  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userName = interaction.member?.user.username || interaction.user?.username || 'Unknown';
  
  // 回答を保存
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

  const responseStatus = status as ResponseStatus;
  const existingIndex = userResponse!.responses.findIndex(r => r.dateId === dateId);
  if (existingIndex >= 0) {
    userResponse!.responses[existingIndex].status = responseStatus;
  } else {
    userResponse!.responses.push({
      dateId,
      status: responseStatus
    });
  }
  
  userResponse!.updatedAt = new Date();
  await storage.saveResponse(userResponse!);

  // 回答状況を取得
  const summary = await storage.getScheduleSummary(scheduleId);

  const date = summary?.schedule.dates.find(d => d.id === dateId);
  const statusEmoji = STATUS_EMOJI[responseStatus];
  
  return new Response(JSON.stringify({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      content: `✅ ${date ? formatDate(date.datetime) : '日程'} を **${statusEmoji}** に更新しました！`,
      components: []
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
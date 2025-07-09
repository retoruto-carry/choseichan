import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ButtonInteraction, Env } from '../types/discord';
import { ResponseStatus, STATUS_EMOJI, EMBED_COLORS, ScheduleSummary } from '../types/schedule';
import { StorageService } from '../services/storage';
import { parseButtonId, createButtonId } from '../utils/id';
import { formatDate } from '../utils/date';
import { updateOriginalMessage } from '../utils/discord';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../utils/embeds';
import { 
  createEphemeralResponse, 
  createErrorResponse, 
  createUpdateResponse,
  createModalResponse,
  createDeferredUpdateResponse 
} from '../utils/responses';

export async function handleButtonInteraction(
  interaction: ButtonInteraction,
  env: Env
): Promise<Response> {
  const customId = interaction.data.custom_id;
  
  // Handle select menu interactions
  if (customId.startsWith('dateselect:')) {
    return handleDateSelectMenu(interaction, env);
  }
  
  const { action, params } = parseButtonId(customId);
  const storage = new StorageService(env.SCHEDULES, env.RESPONSES);

  switch (action) {
    case 'respond':
      return handleRespondButton(interaction, storage, params);
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
      return handleCloseButton(interaction, storage, params, env);
    case 'reopen':
      return handleReopenButton(interaction, storage, params, env);
    case 'delete':
      return handleDeleteButton(interaction, storage, params);
    case 'export':
      return handleExportButton(interaction, storage, params);
    case 'edit_info':
      return handleEditInfoButton(interaction, storage, params);
    case 'update_dates':
      return handleUpdateDatesButton(interaction, storage, params);
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
    case 'direct_vote':
      return handleDirectVoteButton(interaction, storage, params, env);
    case 'add_comment':
      return handleAddCommentButton(interaction, storage, params);
    case 'comment':
      return handleCommentButton(interaction, storage, params);
    case 'show_all':
      return handleShowAllButton(interaction, storage, params);
    case 'complete_vote':
      return handleCompleteVoteButton(interaction, storage, params, env);
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

async function handleRespondButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
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
      placeholder = `未回答 ${formatDate(date.datetime)}`;
    } else if (existingStatus === 'yes') {
      placeholder = `○ ${formatDate(date.datetime)}`;
    } else if (existingStatus === 'maybe') {
      placeholder = `△ ${formatDate(date.datetime)}`;
    } else if (existingStatus === 'no') {
      placeholder = `× ${formatDate(date.datetime)}`;
    }
    
    return {
      type: 1, // Action Row
      components: [{
        type: 3, // Select Menu
        custom_id: `dateselect:${scheduleId}:${date.id}`,
        placeholder,
        options: [
          {
            label: `未回答 ${formatDate(date.datetime)}`,
            value: 'none',
            default: !existingStatus
          },
          {
            label: `○ ${formatDate(date.datetime)}`,
            value: 'yes',
            default: existingStatus === 'yes'
          },
          {
            label: `△ ${formatDate(date.datetime)}`,
            value: 'maybe',
            default: existingStatus === 'maybe'
          },
          {
            label: `× ${formatDate(date.datetime)}`,
            value: 'no',
            default: existingStatus === 'no'
          }
        ]
      }]
    };
  });

  // Add complete button at the end
  const componentsWithComplete = [
    ...components,
    {
      type: 1,
      components: [{
        type: 2,
        style: 3, // Success
        label: '回答を完了',
        custom_id: `complete_vote:${scheduleId}`,
        emoji: { name: '✅' }
      }]
    }
  ];
  
  const message = schedule.dates.length > 4 
    ? `**${schedule.title}** の回答を選択してください:\n\n各日程のドロップダウンから選択してください。\n⚠️ 日程が多いため、最初の4つの日程のみ表示されています。\n回答が完了したら「回答を完了」ボタンを押してください。`
    : `**${schedule.title}** の回答を選択してください:\n\n各日程のドロップダウンから選択してください。\n回答が完了したら「回答を完了」ボタンを押してください。`;

  return createEphemeralResponse(
    message,
    undefined,
    componentsWithComplete // Now limited to 5 components total
  );
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
  const statusText = status === 'clear' ? 'クリアしました' : STATUS_EMOJI[status as ResponseStatus];
  
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ ${date ? formatDate(date.datetime) : '日程'} を ${statusText} に更新しました`,
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

function createResponseTableEmbed(summary: ScheduleSummary) {
  const { schedule, userResponses, responseCounts, bestDateId } = summary;
  
  return {
    title: `📊 ${schedule.title}`,
    color: EMBED_COLORS.INFO,
    fields: schedule.dates.slice(0, 10).map((date, idx) => {
      const count = responseCounts[date.id];
      const isBest = date.id === bestDateId && userResponses.length > 0;
      
      // Get responses for this date
      const dateResponses = userResponses
        .map(ur => {
          const response = ur.responses.find(r => r.dateId === date.id);
          if (!response) return null;
          const comment = response.comment ? ` (${response.comment})` : '';
          return `${STATUS_EMOJI[response.status]} ${ur.userName}${comment}`;
        })
        .filter(Boolean);
      
      return {
        name: `${isBest ? '⭐ ' : ''}${idx + 1}. ${formatDate(date.datetime)}`,
        value: [
          `集計: ${STATUS_EMOJI.yes} ${count.yes}人 ${STATUS_EMOJI.maybe} ${count.maybe}人 ${STATUS_EMOJI.no} ${count.no}人`,
          dateResponses.length > 0 ? dateResponses.join(', ') : '回答なし'
        ].join('\n'),
        inline: false
      };
    }),
    footer: {
      text: `回答者: ${userResponses.length}人`
    }
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

  const tableEmbed = createResponseTableEmbed(summary);

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
              label: '日程を一括更新',
              custom_id: createButtonId('update_dates', scheduleId),
              emoji: { name: '📅' }
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

  const embed = createScheduleEmbedWithTable(summary);
  const components = createSimpleScheduleComponents(schedule);

  return new Response(JSON.stringify({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      embeds: [embed],
      components
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleReopenButton(
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

  const userId = interaction.member?.user.id || interaction.user?.id;
  if (schedule.createdBy.id !== userId) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程調整を再開できるのは作成者のみです。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  schedule.status = 'open';
  schedule.updatedAt = new Date();
  await storage.saveSchedule(schedule);

  // Update the original message
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

  const embed = createScheduleEmbedWithTable(summary);
  const components = createSimpleScheduleComponents(schedule);

  return new Response(JSON.stringify({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      embeds: [embed],
      components
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

async function handleUpdateDatesButton(
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

  // 現在の日程を整形して表示
  const currentDates = schedule.dates
    .map(date => formatDate(date.datetime))
    .join('\n');

  // Show modal for updating all dates
  return new Response(JSON.stringify({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `modal:update_dates:${scheduleId}`,
      title: '日程を一括更新',
      components: [
        {
          type: 1,
          components: [{
            type: 4,
            custom_id: 'dates',
            label: '候補（1行に1つずつ）',
            style: 2,
            value: currentDates,
            placeholder: '例:\n4/1 (月) 19:00\n4/2 (火) 20:00\n4/3 (水) 19:00',
            required: true,
            min_length: 1,
            max_length: 1000
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

  // Show modal for adding dates
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
            label: '追加する日程候補（1行に1つずつ）',
            style: 2,
            placeholder: '例:\n4/4 (木) 19:00\n4/5 (金) 20:00',
            required: true,
            min_length: 1,
            max_length: 1000
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

  // Create buttons for each date to remove
  const components = schedule.dates.map((date, idx) => ({
    type: 1,
    components: [{
      type: 2,
      style: 4, // Danger
      label: `${idx + 1}. ${formatDate(date.datetime)}`,
      custom_id: createButtonId('confirm_remove_date', scheduleId, date.id),
      emoji: { name: '🗑️' }
    }]
  }));

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: '削除する日程を選択してください：',
      components: components.slice(0, 5), // Max 5 rows
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
  schedule.updatedAt = new Date();
  
  await storage.saveSchedule(schedule);

  // Remove all responses for this date
  const responses = await storage.listResponsesBySchedule(scheduleId);
  for (const response of responses) {
    response.responses = response.responses.filter(r => r.dateId !== dateId);
    await storage.saveResponse(response);
  }

  return new Response(JSON.stringify({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      content: `✅ 日程「${removedDate ? formatDate(removedDate.datetime) : ''}」を削除しました。`
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleQuickVoteButton(
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

async function handleQuickVoteStatusButton(
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

async function handleDirectVoteButton(
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

async function handleAddCommentButton(
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

async function handleCommentButton(
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
      title: date ? formatDate(date.datetime) : 'コメント',
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

async function handleShowAllButton(
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

  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userResponse = await storage.getResponse(scheduleId, userId);

  // Open modal for all dates
  const modal = {
    title: schedule.title.length > 40 ? schedule.title.substring(0, 40) + '...' : schedule.title,
    custom_id: `modal:interactive_response:${scheduleId}`,
    components: schedule.dates.slice(0, 5).map((date, idx) => {
      const existingResponse = userResponse?.responses.find(r => r.dateId === date.id);
      const existingStatus = existingResponse?.status;
      const existingComment = existingResponse?.comment || '';
      
      return {
        type: 1,
        components: [{
          type: 4,
          custom_id: `date_${date.id}`,
          label: `${idx + 1}. ${formatDate(date.datetime)}`,
          style: 1,
          placeholder: '○、△、× のいずれかと、必要ならコメント',
          value: existingStatus ? 
            `${STATUS_EMOJI[existingStatus]} ${existingComment}`.trim() : 
            '',
          required: false,
          max_length: 100
        }]
      };
    })
  };

  return new Response(JSON.stringify({
    type: InteractionResponseType.MODAL,
    data: modal
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleDateSelectMenu(
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
  
  // Update the current message with new selection
  const components = schedule.dates.slice(0, 5).map((date, idx) => {
    const existingResponse = userResponse?.responses.find(r => r.dateId === date.id);
    const existingStatus = existingResponse?.status;
    
    // Set placeholder based on current status
    let placeholder = '';
    if (!existingStatus) {
      placeholder = `未回答 ${formatDate(date.datetime)}`;
    } else if (existingStatus === 'yes') {
      placeholder = `○ ${formatDate(date.datetime)}`;
    } else if (existingStatus === 'maybe') {
      placeholder = `△ ${formatDate(date.datetime)}`;
    } else if (existingStatus === 'no') {
      placeholder = `× ${formatDate(date.datetime)}`;
    }
    
    return {
      type: 1,
      components: [{
        type: 3,
        custom_id: `dateselect:${scheduleId}:${date.id}`,
        placeholder,
        options: [
          {
            label: `未回答 ${formatDate(date.datetime)}`,
            value: 'none',
            default: !existingStatus
          },
          {
            label: `○ ${formatDate(date.datetime)}`,
            value: 'yes',
            default: existingStatus === 'yes'
          },
          {
            label: `△ ${formatDate(date.datetime)}`,
            value: 'maybe',
            default: existingStatus === 'maybe'
          },
          {
            label: `× ${formatDate(date.datetime)}`,
            value: 'no',
            default: existingStatus === 'no'
          }
        ]
      }]
    };
  });
  
  // メインメッセージの更新は完了ボタンを押した時に行う
  
  const date = schedule.dates.find(d => d.id === dateId);
  const statusText = selectedValue === 'none' ? '未回答' : 
    selectedValue === 'yes' ? '○ 参加可能' :
    selectedValue === 'maybe' ? '△ 調整中' : '× 参加不可';
  
  // Add complete button at the end
  const componentsWithComplete = [
    ...components,
    {
      type: 1,
      components: [{
        type: 2,
        style: 3, // Success
        label: '回答を完了',
        custom_id: `complete_vote:${scheduleId}`,
        emoji: { name: '✅' }
      }]
    }
  ];
  
  return new Response(JSON.stringify({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      content: `**${schedule.title}** の回答を選択してください:\n✅ ${date ? formatDate(date.datetime) : '日程'} を ${statusText} に更新しました\n\n回答が完了したら「回答を完了」ボタンを押してください。`,
      components: componentsWithComplete.slice(0, 5) // Discord limit
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleCompleteVoteButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId] = params;
  const userId = interaction.member?.user.id || interaction.user?.id || '';
  
  // Get user's response summary
  const userResponse = await storage.getResponse(scheduleId, userId);
  const schedule = await storage.getSchedule(scheduleId);
  
  if (!schedule) {
    return createUpdateResponse('日程調整が見つかりません。');
  }
  
  let responsesSummary = '';
  if (userResponse && userResponse.responses.length > 0) {
    responsesSummary = '\n\n**あなたの回答:**\n';
    for (const date of schedule.dates) {
      const response = userResponse.responses.find(r => r.dateId === date.id);
      if (response) {
        const emoji = STATUS_EMOJI[response.status];
        responsesSummary += `${emoji} ${formatDate(date.datetime)}\n`;
      }
    }
  } else {
    responsesSummary = '\n\n回答がありません。';
  }
  
  // メインメッセージを更新するため、チャンネルにフォローアップメッセージを送信
  if (env.DISCORD_APPLICATION_ID && interaction.channel_id) {
    const summary = await storage.getScheduleSummary(scheduleId);
    if (summary) {
      try {
        // 最新の状態を反映したメッセージを送信
        await fetch(`https://discord.com/api/v10/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: `📊 **${schedule.title}** の最新状況:`,
            embeds: [createScheduleEmbedWithTable(summary)],
            components: createSimpleScheduleComponents(summary.schedule)
          })
        });
      } catch (error) {
        console.error('Failed to send follow-up message:', error);
      }
    }
  }
  
  return createUpdateResponse(
    `✅ **${schedule.title}** の回答を完了しました！${responsesSummary}\n\n回答を変更する場合は、もう一度「回答する」ボタンを押してください。`,
    undefined,
    []
  );
}


import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { Env, ModalInteraction } from '../types/discord';
import { Response as ScheduleResponse, ResponseStatus, STATUS_EMOJI, EMBED_COLORS, Schedule, ScheduleDate, ScheduleSummary } from '../types/schedule';
import { StorageService } from '../services/storage';
import { formatDate, parseUserInputDate } from '../utils/date';
import { createScheduleEmbed, createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../utils/embeds';
import { updateOriginalMessage } from '../utils/discord';
import { createButtonId, generateId } from '../utils/id';

interface ModalSubmitInteraction extends ModalInteraction {
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
    case 'bulk_response':
      return handleBulkResponseModal(interaction, storage, params, env);
    case 'interactive_response':
      return handleInteractiveResponseModal(interaction, storage, params, env);
    case 'create_schedule':
      return handleCreateScheduleModal(interaction, storage, env);
    case 'edit_info':
      return handleEditInfoModal(interaction, storage, params, env);
    case 'update_dates':
      return handleUpdateDatesModal(interaction, storage, params, env);
    case 'add_dates':
      return handleAddDatesModal(interaction, storage, params, env);
    case 'add_comment':
      return handleAddCommentModal(interaction, storage, params, env);
    case 'date_comment':
      return handleDateCommentModal(interaction, storage, params, env);
    case 'select_response':
      return handleSelectResponseModal(interaction, storage, params, env);
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

async function handleInteractiveResponseModal(
  interaction: ModalSubmitInteraction,
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
      comment: '',
      updatedAt: new Date()
    };
  }

  // Parse each date field
  const newResponses: Array<{ dateId: string; status: ResponseStatus; comment?: string }> = [];
  
  for (const date of schedule.dates) {
    const fieldValue = interaction.data.components
      .flatMap(row => row.components)
      .find(c => c.custom_id === `date_${date.id}`)?.value || '';
    
    if (fieldValue.trim()) {
      let status: ResponseStatus | null = null;
      let comment = '';
      
      // Extract status and comment
      const trimmed = fieldValue.trim();
      if (trimmed.includes('✅') || trimmed.includes('○') || trimmed.includes('o') || trimmed.includes('O')) {
        status = 'yes';
        comment = trimmed.replace(/[✅○oO]/g, '').trim();
      } else if (trimmed.includes('🟡') || trimmed.includes('△') || trimmed.includes('▲') || trimmed.includes('?')) {
        status = 'maybe';
        comment = trimmed.replace(/[🟡△▲?]/g, '').trim();
      } else if (trimmed.includes('❌') || trimmed.includes('×') || trimmed.includes('x') || trimmed.includes('X')) {
        status = 'no';
        comment = trimmed.replace(/[❌×xX]/g, '').trim();
      } else {
        // Try to parse the first character
        const firstChar = trimmed[0];
        if (['○', 'o', 'O'].includes(firstChar)) {
          status = 'yes';
          comment = trimmed.substring(1).trim();
        } else if (['△', '▲', '?'].includes(firstChar)) {
          status = 'maybe';
          comment = trimmed.substring(1).trim();
        } else if (['×', 'x', 'X'].includes(firstChar)) {
          status = 'no';
          comment = trimmed.substring(1).trim();
        }
      }
      
      if (status) {
        newResponses.push({
          dateId: date.id,
          status,
          comment: comment || undefined
        });
      }
    }
  }

  // Update responses
  userResponse.responses = newResponses;
  userResponse.updatedAt = new Date();
  await storage.saveResponse(userResponse);

  // Get updated summary and update main message
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

  // Update the original message
  if (interaction.message?.id && env.DISCORD_APPLICATION_ID) {
    try {
      await updateOriginalMessage(
        env.DISCORD_APPLICATION_ID,
        interaction.token,
        interaction.message.id,
        {
          embeds: [createScheduleEmbedWithTable(summary)],
          components: createSimpleScheduleComponents(schedule)
        }
      );
    } catch (error) {
      console.error('Failed to update original message:', error);
    }
  }
  
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ 回答を更新しました！`,
      embeds: [createResponseConfirmationEmbed(userResponse, summary)],
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleBulkResponseModal(
  interaction: ModalSubmitInteraction,
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

  // Extract values from modal
  const responsesText = interaction.data.components
    .flatMap(row => row.components)
    .find(c => c.custom_id === 'responses')?.value || '';
    
  const comment = interaction.data.components
    .flatMap(row => row.components)
    .find(c => c.custom_id === 'comment')?.value || '';

  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userName = interaction.member?.user.username || interaction.user?.username || '';

  // Parse responses (one per line)
  const responseLines = responsesText.split('\n');
  const dateResponses: Array<{ dateId: string; status: ResponseStatus }> = [];

  schedule.dates.forEach((date, idx) => {
    const line = responseLines[idx]?.trim() || '';
    let status: ResponseStatus | null = null;
    
    if (line.includes('○') || line.includes('o') || line.includes('O')) {
      status = 'yes';
    } else if (line.includes('△') || line.includes('▲') || line.includes('?')) {
      status = 'maybe';
    } else if (line.includes('×') || line.includes('x') || line.includes('X')) {
      status = 'no';
    }
    
    if (status) {
      dateResponses.push({
        dateId: date.id,
        status
      });
    }
  });

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

  // Replace all responses
  userResponse.responses = dateResponses;
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
  
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ 回答を更新しました！`,
      embeds: [createResponseConfirmationEmbed(userResponse, summary)],
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
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
          name: `${isBest ? '⭐ ' : ''}${date.datetime}`,
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
    const comment = response.comment ? ` - ${response.comment}` : '';
    return `${date.datetime}: ${STATUS_EMOJI[response.status]}${comment}`;
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
    label: date.datetime,
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

async function handleCreateScheduleModal(
  interaction: ModalSubmitInteraction,
  storage: StorageService,
  env: Env
): Promise<Response> {
  // Extract values from modal
  const title = interaction.data.components
    .flatMap(row => row.components)
    .find(c => c.custom_id === 'title')?.value || '';
    
  const description = interaction.data.components
    .flatMap(row => row.components)
    .find(c => c.custom_id === 'description')?.value || '';
    
  const datesText = interaction.data.components
    .flatMap(row => row.components)
    .find(c => c.custom_id === 'dates')?.value || '';
    
  const deadlineText = interaction.data.components
    .flatMap(row => row.components)
    .find(c => c.custom_id === 'deadline')?.value || '';

  // Parse dates from text (one per line)
  const dateLines = datesText.split('\n').filter(line => line.trim());
  
  if (dateLines.length === 0) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程候補を入力してください。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Create schedule
  const scheduleId = generateId();
  const scheduleDates: ScheduleDate[] = dateLines.map((line) => ({
    id: generateId(),
    datetime: line.trim(), // Store as-is
    description: undefined
  }));

  const schedule: Schedule = {
    id: scheduleId,
    title,
    description: description || undefined,
    dates: scheduleDates,
    createdBy: {
      id: interaction.member?.user.id || interaction.user?.id || '',
      username: interaction.member?.user.username || interaction.user?.username || ''
    },
    channelId: interaction.channel_id || '',
    createdAt: new Date(),
    updatedAt: new Date(),
    deadline: deadlineText ? parseUserInputDate(deadlineText) || undefined : undefined,
    status: 'open',
    notificationSent: false
  };

  await storage.saveSchedule(schedule);

  // Get empty summary for initial display
  const summary = await storage.getScheduleSummary(schedule.id);
  const embed = createScheduleEmbedWithTable(summary!);
  const components = createSimpleScheduleComponents(schedule);

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [embed],
      components
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}


async function handleEditInfoModal(
  interaction: ModalSubmitInteraction,
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

  // Extract new values
  const newTitle = interaction.data.components
    .flatMap(row => row.components)
    .find(c => c.custom_id === 'title')?.value || schedule.title;
    
  const newDescription = interaction.data.components
    .flatMap(row => row.components)
    .find(c => c.custom_id === 'description')?.value || '';

  // Update schedule
  schedule.title = newTitle;
  schedule.description = newDescription || undefined;
  schedule.updatedAt = new Date();
  
  await storage.saveSchedule(schedule);

  // Update the original message with new title and description
  if (env.DISCORD_APPLICATION_ID && interaction.message?.message_reference?.message_id) {
    try {
      const summary = await storage.getScheduleSummary(scheduleId);
      if (summary) {
        const originalMessageId = interaction.message.message_reference.message_id;
        await updateOriginalMessage(
          env.DISCORD_APPLICATION_ID,
          interaction.token,
          originalMessageId,
          {
            embeds: [createScheduleEmbedWithTable(summary)],
            components: createSimpleScheduleComponents(summary.schedule)
          }
        );
      }
    } catch (error) {
      console.error('Failed to update original message after info edit:', error);
    }
  }

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: '✅ 日程調整の情報を更新しました。',
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleUpdateDatesModal(
  interaction: ModalSubmitInteraction,
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

  // Extract dates
  const datesText = interaction.data.components
    .flatMap(row => row.components)
    .find(c => c.custom_id === 'dates')?.value || '';

  const dateLines = datesText.split('\n').filter(line => line.trim());
  
  if (dateLines.length === 0) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程候補を入力してください。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const newDates: ScheduleDate[] = [];
  const invalidDates: string[] = [];
  
  for (const line of dateLines) {
    const trimmedLine = line.trim();
    const parsedDate = parseUserInputDate(trimmedLine);
    
    if (parsedDate) {
      newDates.push({
        id: generateId(),
        datetime: parsedDate.toISOString(),
        description: undefined
      });
    } else {
      // If parsing fails, keep as-is
      newDates.push({
        id: generateId(),
        datetime: trimmedLine,
        description: undefined
      });
      invalidDates.push(trimmedLine);
    }
  }
  
  if (invalidDates.length > 0) {
    console.warn('Some dates could not be parsed:', invalidDates);
  }

  // Create a map of old dates for matching
  const oldDatesMap = new Map<string, string>();
  for (const oldDate of schedule.dates) {
    const formatted = oldDate.datetime;
    oldDatesMap.set(formatted, oldDate.id);
  }
  
  // Create a map to track old date ID to new date ID mapping
  const dateIdMapping = new Map<string, string>();
  
  // Try to match new dates with old dates
  for (const newDate of newDates) {
    const formatted = newDate.datetime;
    const oldDateId = oldDatesMap.get(formatted);
    if (oldDateId) {
      dateIdMapping.set(oldDateId, newDate.id);
    }
  }
  
  // Replace all dates
  schedule.dates = newDates;
  schedule.updatedAt = new Date();
  
  await storage.saveSchedule(schedule);

  // Update responses to use new date IDs where possible
  const responses = await storage.listResponsesBySchedule(scheduleId);
  let updatedCount = 0;
  
  for (const response of responses) {
    let hasChanges = false;
    const updatedResponses = response.responses.filter(r => {
      const newDateId = dateIdMapping.get(r.dateId);
      if (newDateId) {
        r.dateId = newDateId;
        hasChanges = true;
        return true;
      }
      // Remove responses for dates that no longer exist
      return false;
    });
    
    if (hasChanges) {
      response.responses = updatedResponses;
      response.updatedAt = new Date();
      await storage.saveResponse(response);
      updatedCount++;
    } else if (updatedResponses.length === 0) {
      // Delete response if no dates match
      await storage.deleteResponse(scheduleId, response.userId);
    }
  }

  // 更新後の情報を取得
  const summary = await storage.getScheduleSummary(scheduleId);
  
  // メインメッセージを更新
  if (env.DISCORD_APPLICATION_ID && interaction.message?.message_reference?.message_id && summary) {
    try {
      const originalMessageId = interaction.message.message_reference.message_id;
      await updateOriginalMessage(
        env.DISCORD_APPLICATION_ID,
        interaction.token,
        originalMessageId,
        {
          embeds: [createScheduleEmbedWithTable(summary)],
          components: createSimpleScheduleComponents(summary.schedule)
        }
      );
    } catch (error) {
      console.error('Failed to update original message after dates update:', error);
    }
  }

  const message = updatedCount > 0 
    ? `✅ 日程を${newDates.length}件に更新しました。\n✅ ${updatedCount}人の回答を新しい日程に引き継ぎました。`
    : `✅ 日程を${newDates.length}件に更新しました。\n⚠️ 日程が大幅に変更されたため、以前の回答はリセットされました。`;
  
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: message,
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleAddDatesModal(
  interaction: ModalSubmitInteraction,
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

  // Extract dates
  const datesText = interaction.data.components
    .flatMap(row => row.components)
    .find(c => c.custom_id === 'dates')?.value || '';

  const dateLines = datesText.split('\n').filter(line => line.trim());
  
  if (dateLines.length === 0) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程候補を入力してください。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const newDates: ScheduleDate[] = [];
  const invalidDates: string[] = [];
  
  for (const line of dateLines) {
    const trimmedLine = line.trim();
    const parsedDate = parseUserInputDate(trimmedLine);
    
    if (parsedDate) {
      newDates.push({
        id: generateId(),
        datetime: parsedDate.toISOString(),
        description: undefined
      });
    } else {
      // If parsing fails, keep as-is
      newDates.push({
        id: generateId(),
        datetime: trimmedLine,
        description: undefined
      });
      invalidDates.push(trimmedLine);
    }
  }
  
  if (invalidDates.length > 0) {
    console.warn('Some dates could not be parsed:', invalidDates);
  }

  // Add new dates
  schedule.dates.push(...newDates);
  schedule.updatedAt = new Date();
  
  await storage.saveSchedule(schedule);

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ ${newDates.length}件の日程を追加しました。`,
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleAddCommentModal(
  interaction: ModalSubmitInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId] = params;
  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userName = interaction.member?.user.username || interaction.user?.username || '';
  
  // Extract comment
  const comment = interaction.data.components
    .flatMap(row => row.components)
    .find(c => c.custom_id === 'comment')?.value || '';

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

  // Update comment
  userResponse.comment = comment;
  userResponse.updatedAt = new Date();
  await storage.saveResponse(userResponse);

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ コメントを${comment ? '更新' : '削除'}しました。`,
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleDateCommentModal(
  interaction: ModalSubmitInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId, dateId] = params;
  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userName = interaction.member?.user.username || interaction.user?.username || '';
  
  // Extract comment
  const comment = interaction.data.components
    .flatMap(row => row.components)
    .find(c => c.custom_id === 'comment')?.value || '';

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

  // Update comment for specific date
  const existingResponseIndex = userResponse.responses.findIndex(r => r.dateId === dateId);
  if (existingResponseIndex >= 0) {
    userResponse.responses[existingResponseIndex].comment = comment || undefined;
  } else {
    // If no response exists for this date, don't create one with just a comment
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'この日程にはまだ回答していません。先に○△×で回答してからコメントを追加してください。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  userResponse.updatedAt = new Date();
  await storage.saveResponse(userResponse);

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ コメントを${comment ? '更新' : '削除'}しました。`,
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleSelectResponseModal(
  interaction: ModalSubmitInteraction,
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
      comment: '',
      updatedAt: new Date()
    };
  }

  // Parse select menu responses
  const newResponses: Array<{ dateId: string; status: ResponseStatus; comment?: string }> = [];
  
  // Get all select components from the interaction
  const components = interaction.data.components || [];
  
  for (const actionRow of components) {
    for (const component of actionRow.components) {
      // Check if this is a select menu component
      if (component.custom_id?.startsWith('select_')) {
        const dateId = component.custom_id.replace('select_', '');
        // For select menus in modals, the value is in component.values[0]
        const selectedValue = (component as any).values?.[0] || (component as any).value;
        
        if (selectedValue && selectedValue !== 'none') {
          const status = selectedValue as ResponseStatus;
          // Preserve existing comment for this date
          const existingResponse = userResponse.responses.find(r => r.dateId === dateId);
          newResponses.push({
            dateId,
            status,
            comment: existingResponse?.comment
          });
        }
      }
    }
  }

  // Update responses
  userResponse.responses = newResponses;
  userResponse.updatedAt = new Date();
  await storage.saveResponse(userResponse);

  // Get updated summary and update main message
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

  // Update the original message if possible
  if (interaction.message?.id && env.DISCORD_APPLICATION_ID) {
    try {
      await updateOriginalMessage(
        env.DISCORD_APPLICATION_ID,
        interaction.token,
        interaction.message.id,
        {
          embeds: [createScheduleEmbedWithTable(summary)],
          components: createSimpleScheduleComponents(schedule)
        }
      );
    } catch (error) {
      console.error('Failed to update original message:', error);
    }
  }
  
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ 回答を更新しました！`,
      embeds: [createResponseConfirmationEmbed(userResponse, summary)],
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
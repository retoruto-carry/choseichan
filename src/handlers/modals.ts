import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { Env, ModalInteraction } from '../types/discord';
import { Response as ScheduleResponse, ResponseStatus, STATUS_EMOJI, EMBED_COLORS, Schedule, ScheduleDate, ScheduleSummary } from '../types/schedule';
import { StorageService } from '../services/storage';
import { formatDate, parseUserInputDate } from '../utils/date';
import { createScheduleEmbed, createScheduleEmbedWithTable, createSimpleScheduleComponents, createScheduleComponents } from '../utils/embeds';
import { updateOriginalMessage } from '../utils/discord';
import { updateScheduleMainMessage } from '../utils/schedule-updater';
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
    case 'edit_deadline':
      return handleEditDeadlineModal(interaction, storage, params, env);
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

  // Update the comment
  const comment = interaction.data.components[0].components[0].value || '';
  userResponse.comment = comment;
  userResponse.updatedAt = new Date();
  
  await storage.saveResponse(userResponse);

  // Show interactive response menu
  const dateButtons = schedule.dates.map((date, idx) => {
    const existingResponse = userResponse.responses.find(r => r.dateId === date.id);
    const existingStatus = existingResponse?.status;
    
    return {
      type: 1,
      components: [
        {
          type: 2,
          style: 2,
          label: `${idx + 1}. ${date.datetime}`,
          custom_id: createButtonId('date_label', date.id),
          disabled: true
        },
        {
          type: 2,
          style: existingStatus === 'yes' ? 3 : 2,
          label: STATUS_EMOJI.yes,
          custom_id: createButtonId('direct_vote', scheduleId, date.id, 'yes')
        },
        {
          type: 2,
          style: existingStatus === 'maybe' ? 1 : 2,
          label: STATUS_EMOJI.maybe,
          custom_id: createButtonId('direct_vote', scheduleId, date.id, 'maybe')
        },
        {
          type: 2,
          style: existingStatus === 'no' ? 4 : 2,
          label: STATUS_EMOJI.no,
          custom_id: createButtonId('direct_vote', scheduleId, date.id, 'no')
        }
      ]
    };
  });

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `**${schedule.title}** の回答を選択してください:\n${comment ? `💬 コメント: ${comment}` : ''}`,
      components: dateButtons.slice(0, 5),
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

  // Update the original message
  if (interaction.message?.id && env.DISCORD_APPLICATION_ID) {
    try {
      const summary = await storage.getScheduleSummary(scheduleId);
      await updateOriginalMessage(
        env.DISCORD_APPLICATION_ID,
        interaction.token,
        interaction.message.id,
        {
          embeds: [createScheduleEmbedWithTable(summary, false)],
          components: createSimpleScheduleComponents(schedule, false)
        }
      );
    } catch (error) {
      console.error('Failed to update original message:', error);
    }
  }
  
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ **${schedule.title}** への回答を受け付けました！`,
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleCreateScheduleModal(
  interaction: ModalSubmitInteraction,
  storage: StorageService,
  env: Env
): Promise<Response> {
  const components = interaction.data.components;
  const title = components[0].components[0].value;
  const description = components[1].components[0].value || '';
  const dates = components[2].components[0].value;
  const deadline = components[3]?.components[0]?.value || null;

  // Parse dates
  const dateLines = dates.split('\n').filter(line => line.trim());
  if (dateLines.length === 0) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程候補を入力してください。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (dateLines.length > 25) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程候補は25個までです。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const scheduleDates: ScheduleDate[] = dateLines.map(date => ({
    id: generateId(),
    datetime: date.trim()
  }));

  // Parse deadline if provided
  let deadlineDate: Date | null = null;
  if (deadline) {
    deadlineDate = parseUserInputDate(deadline);
    if (!deadlineDate) {
      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '締切日時の形式が正しくありません。',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  const schedule: Schedule = {
    id: generateId(),
    title,
    description,
    dates: scheduleDates,
    deadline: deadlineDate,
    status: 'open',
    createdBy: {
      id: interaction.member?.user.id || interaction.user?.id || '',
      username: interaction.member?.user.username || interaction.user?.username || ''
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await storage.saveSchedule(schedule);

  const embed = createScheduleEmbed(schedule);
  const components_ui = createScheduleComponents(schedule);

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [embed],
      components: components_ui
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

  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userName = interaction.member?.user.username || interaction.user?.username || '';
  const responses = interaction.data.components[0].components[0].value || '';
  const comment = interaction.data.components[1]?.components[0]?.value || '';

  // Parse responses
  const responseLines = responses.split('\n').filter(line => line.trim());
  
  // Build user response
  const userResponse: ScheduleResponse = {
    scheduleId,
    userId,
    userName,
    responses: [],
    comment,
    updatedAt: new Date()
  };

  // Process each response line
  for (let i = 0; i < responseLines.length && i < schedule.dates.length; i++) {
    const line = responseLines[i].trim().toLowerCase();
    let status: ResponseStatus = 'no';
    
    if (line.includes('○') || line.includes('o') || line.includes('yes') || line === '◯') {
      status = 'yes';
    } else if (line.includes('△') || line.includes('maybe') || line === '▲') {
      status = 'maybe';
    } else if (line.includes('×') || line.includes('x') || line.includes('no') || line === '✕' || line === '✖') {
      status = 'no';
    }
    
    userResponse.responses.push({
      dateId: schedule.dates[i].id,
      status
    });
  }

  await storage.saveResponse(userResponse);

  // Create confirmation embed
  const confirmEmbed = {
    title: '✅ 回答を受け付けました',
    color: EMBED_COLORS.SUCCESS,
    fields: schedule.dates.map((date, idx) => {
      const response = userResponse.responses.find(r => r.dateId === date.id);
      return {
        name: `${idx + 1}. ${date.datetime}`,
        value: response ? STATUS_EMOJI[response.status] : STATUS_EMOJI.no,
        inline: true
      };
    }),
    footer: {
      text: comment ? `💬 ${comment}` : ''
    }
  };

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [confirmEmbed],
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleEditInfoModal(
  interaction: ModalSubmitInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId, messageId] = params;
  const title = interaction.data.components[0].components[0].value;
  const description = interaction.data.components[1]?.components[0]?.value || '';
  
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

  // Update schedule
  schedule.title = title;
  schedule.description = description;
  schedule.updatedAt = new Date();
  await storage.saveSchedule(schedule);

  // Update the main message if possible
  if (messageId && env.DISCORD_APPLICATION_ID) {
    const updatePromise = updateScheduleMainMessage(
      scheduleId,
      messageId,
      interaction.token,
      storage,
      env
    ).catch(error => console.error('Failed to update main message:', error));
    
    if (env.ctx && typeof env.ctx.waitUntil === 'function') {
      env.ctx.waitUntil(updatePromise);
    }
  }

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: '✅ タイトルと説明を更新しました。',
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
  const [scheduleId, messageId] = params;
  const datesInput = interaction.data.components[0].components[0].value;
  
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

  // Parse new dates
  const dateLines = datesInput.split('\n').filter(line => line.trim());
  if (dateLines.length === 0) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程候補を入力してください。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (dateLines.length > 25) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程候補は25個までです。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Create a mapping from datetime to old date IDs to preserve responses
  const oldDateMap = new Map(schedule.dates.map(d => [d.datetime, d.id]));
  
  // Create new dates array, preserving IDs for unchanged dates
  const newDates: ScheduleDate[] = dateLines.map(datetime => {
    const trimmedDatetime = datetime.trim();
    const existingId = oldDateMap.get(trimmedDatetime);
    
    return {
      id: existingId || generateId(),
      datetime: trimmedDatetime
    };
  });

  // Get all responses and update them to remove orphaned date responses
  const responses = await storage.listResponsesBySchedule(scheduleId);
  const newDateIds = new Set(newDates.map(d => d.id));
  
  for (const response of responses) {
    response.responses = response.responses.filter(r => newDateIds.has(r.dateId));
    await storage.saveResponse(response);
  }

  // Update schedule
  schedule.dates = newDates;
  schedule.updatedAt = new Date();
  await storage.saveSchedule(schedule);

  // Update the main message if possible
  if (messageId && env.DISCORD_APPLICATION_ID) {
    const updatePromise = updateScheduleMainMessage(
      scheduleId,
      messageId,
      interaction.token,
      storage,
      env
    ).catch(error => console.error('Failed to update main message:', error));
    
    if (env.ctx && typeof env.ctx.waitUntil === 'function') {
      env.ctx.waitUntil(updatePromise);
    }
  }

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: '✅ 日程を更新しました。同じ日時の回答は引き継がれています。',
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
  const datesInput = interaction.data.components[0].components[0].value;
  
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

  // Parse new dates
  const dateLines = datesInput.split('\n').filter(line => line.trim());
  if (dateLines.length === 0) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '追加する日程を入力してください。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const totalDates = schedule.dates.length + dateLines.length;
  if (totalDates > 25) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `日程候補は25個までです。現在${schedule.dates.length}個あるので、あと${25 - schedule.dates.length}個まで追加できます。`,
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Add new dates
  const newDates: ScheduleDate[] = dateLines.map(date => ({
    id: generateId(),
    datetime: date.trim()
  }));

  schedule.dates.push(...newDates);
  schedule.updatedAt = new Date();
  await storage.saveSchedule(schedule);

  // Update the original message
  const summary = await storage.getScheduleSummary(scheduleId);
  if (summary && interaction.message?.id && env.DISCORD_APPLICATION_ID) {
    try {
      await updateOriginalMessage(
        env.DISCORD_APPLICATION_ID,
        interaction.token,
        interaction.message.id,
        {
          embeds: [createScheduleEmbedWithTable(summary, false)],
          components: createSimpleScheduleComponents(schedule, false)
        }
      );
    } catch (error) {
      console.error('Failed to update original message:', error);
    }
  }

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
  const comment = interaction.data.components[0].components[0].value || '';
  
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

  // Update comment
  userResponse.comment = comment;
  userResponse.updatedAt = new Date();
  await storage.saveResponse(userResponse);

  // Update the original message
  const summary = await storage.getScheduleSummary(scheduleId);
  if (summary && interaction.message?.id && env.DISCORD_APPLICATION_ID) {
    try {
      await updateOriginalMessage(
        env.DISCORD_APPLICATION_ID,
        interaction.token,
        interaction.message.id,
        {
          embeds: [createScheduleEmbedWithTable(summary, false)],
          components: createSimpleScheduleComponents(schedule, false)
        }
      );
    } catch (error) {
      console.error('Failed to update original message:', error);
    }
  }

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: '✅ コメントを更新しました。',
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
  const comment = interaction.data.components[0].components[0].value || '';
  
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

  // Update or add date response with comment
  const existingIndex = userResponse.responses.findIndex(r => r.dateId === dateId);
  if (existingIndex >= 0) {
    userResponse.responses[existingIndex].comment = comment;
  } else {
    userResponse.responses.push({
      dateId,
      status: 'no',
      comment
    });
  }

  userResponse.updatedAt = new Date();
  await storage.saveResponse(userResponse);

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: '✅ この日程へのコメントを更新しました。',
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

function createResponseConfirmationEmbed(userResponse: ScheduleResponse, summary: ScheduleSummary) {
  const { schedule } = summary;
  
  const fields = schedule.dates.map((date, idx) => {
    const response = userResponse.responses.find(r => r.dateId === date.id);
    const status = response?.status || 'none';
    const comment = response?.comment;
    
    let value = status === 'none' ? '未回答' : STATUS_EMOJI[status];
    if (comment) {
      value += ` (${comment})`;
    }
    
    return {
      name: `${idx + 1}. ${date.datetime}`,
      value,
      inline: true
    };
  });
  
  return {
    title: `✅ ${schedule.title}への回答`,
    color: EMBED_COLORS.SUCCESS,
    fields,
    footer: {
      text: userResponse.comment ? `💬 ${userResponse.comment}` : undefined
    },
    timestamp: userResponse.updatedAt.toISOString()
  };
}

async function handleSelectResponseModal(
  interaction: ModalSubmitInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId] = params;
  const responsesText = interaction.data.components[0].components[0].value || '';
  const comment = interaction.data.components[1]?.components[0]?.value || '';
  
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
  
  // Parse responses
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
  
  // Parse each line for status
  const lines = responsesText.split('\n').filter(line => line.trim());
  
  lines.forEach((line, index) => {
    if (index >= schedule.dates.length) return;
    
    const dateId = schedule.dates[index].id;
    const trimmedLine = line.trim().toLowerCase();
    
    let status: ResponseStatus = 'no';
    if (trimmedLine.includes('○') || trimmedLine.includes('o') || trimmedLine === 'yes' || trimmedLine === '◯') {
      status = 'yes';
    } else if (trimmedLine.includes('△') || trimmedLine === 'maybe' || trimmedLine === '▲') {
      status = 'maybe';
    } else if (trimmedLine.includes('×') || trimmedLine.includes('x') || trimmedLine === 'no' || trimmedLine === '✕' || trimmedLine === '✖') {
      status = 'no';
    }
    
    const existingIndex = userResponse.responses.findIndex(r => r.dateId === dateId);
    if (existingIndex >= 0) {
      userResponse.responses[existingIndex].status = status;
    } else {
      userResponse.responses.push({
        dateId,
        status
      });
    }
  });
  
  userResponse.comment = comment;
  userResponse.updatedAt = new Date();
  
  await storage.saveResponse(userResponse);
  
  // Get updated summary
  const summary = await storage.getScheduleSummary(scheduleId);
  if (!summary) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'エラーが発生しました。',
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
          embeds: [createScheduleEmbedWithTable(summary, false)],
          components: createSimpleScheduleComponents(schedule, false)
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

async function handleEditDeadlineModal(
  interaction: ModalSubmitInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId, messageId] = params;
  console.log('handleEditDeadlineModal - scheduleId:', scheduleId, 'messageId:', messageId);
  const deadlineInput = interaction.data.components[0].components[0].value?.trim() || '';
  
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

  // Parse deadline input
  let newDeadline: Date | null = null;
  if (deadlineInput) {
    newDeadline = parseUserInputDate(deadlineInput);
    if (!newDeadline) {
      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '締切日時の形式が正しくありません。例: 2024-04-01 19:00',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    
  }

  // Update schedule
  schedule.deadline = newDeadline;
  
  // Update status based on deadline
  if (!newDeadline) {
    // No deadline = always open
    schedule.status = 'open';
  } else if (newDeadline > new Date()) {
    // Future deadline = open
    schedule.status = 'open';
  } else {
    // Past deadline = closed
    schedule.status = 'closed';
  }
  
  schedule.updatedAt = new Date();
  await storage.saveSchedule(schedule);

  // Update the main message if possible
  if (messageId && env.DISCORD_APPLICATION_ID) {
    const updatePromise = updateScheduleMainMessage(
      scheduleId,
      messageId,
      interaction.token,
      storage,
      env
    ).catch(error => console.error('Failed to update main message:', error));
    
    if (env.ctx && typeof env.ctx.waitUntil === 'function') {
      env.ctx.waitUntil(updatePromise);
    }
  }

  const deadlineText = newDeadline ? formatDate(newDeadline.toISOString()) : '無期限';
  
  // Determine status message
  let statusText = '';
  if (!newDeadline && schedule.status === 'open') {
    statusText = ' 受付中です。';
  } else if (newDeadline && newDeadline > new Date() && schedule.status === 'open') {
    statusText = ' 受付中です。';
  } else if (newDeadline && newDeadline <= new Date() && schedule.status === 'closed') {
    statusText = ' 締切済みです。';
  }

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ 締切日を「${deadlineText}」に変更しました。${statusText}`,
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
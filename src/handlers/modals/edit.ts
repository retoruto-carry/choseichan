import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ModalInteraction, Env } from '../../types/discord';
import { ScheduleDate, EMBED_COLORS } from '../../types/schedule';
import { StorageService } from '../../services/storage';
import { generateId } from '../../utils/id';
import { parseUserInputDate } from '../../utils/date';
import { updateScheduleMainMessage, saveScheduleMessageId } from '../../utils/schedule-updater';

export async function handleEditInfoModal(
  interaction: ModalInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId, messageId] = params;
  
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
  schedule.title = interaction.data.components[0].components[0].value;
  schedule.description = interaction.data.components[1].components[0].value || undefined;
  schedule.updatedAt = new Date();
  
  await storage.saveSchedule(schedule);
  
  // Save message ID if provided
  if (messageId) {
    await saveScheduleMessageId(scheduleId, messageId, storage);
  }

  // Update main message
  const updated = await updateScheduleMainMessage(
    scheduleId,
    messageId,
    interaction.token,
    storage,
    env
  );

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: updated ? '✅ タイトルと説明を更新しました。' : '✅ タイトルと説明を更新しました。\n（メイン画面の更新には失敗しました）',
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleUpdateDatesModal(
  interaction: ModalInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId, messageId] = params;
  
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

  // Parse dates
  const datesText = interaction.data.components[0].components[0].value;
  const dates = datesText.split('\n').filter((line: string) => line.trim());
  
  if (dates.length === 0) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程候補を入力してください。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Update dates
  schedule.dates = dates.map((date: string) => ({
    id: generateId(),
    datetime: date.trim()
  }));
  schedule.updatedAt = new Date();
  
  await storage.saveSchedule(schedule);
  
  // Delete all responses when dates are updated
  const responses = await storage.listResponsesBySchedule(scheduleId);
  for (const response of responses) {
    await storage.deleteResponse(response.scheduleId, response.userId);
  }
  
  // Save message ID if provided
  if (messageId) {
    await saveScheduleMessageId(scheduleId, messageId, storage);
  }

  // Update main message
  const updated = await updateScheduleMainMessage(
    scheduleId,
    messageId,
    interaction.token,
    storage,
    env
  );

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '✅ 日程を更新しました',
        description: '既存の回答はすべてリセットされました。',
        color: EMBED_COLORS.INFO,
        fields: [{
          name: '新しい日程候補',
          value: schedule.dates.map((d, i) => `${i + 1}. ${d.datetime}`).join('\n')
        }]
      }],
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleAddDatesModal(
  interaction: ModalInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId, messageId] = params;
  
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

  // Parse dates
  const datesText = interaction.data.components[0].components[0].value;
  const newDates = datesText.split('\n').filter((line: string) => line.trim());
  
  if (newDates.length === 0) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '追加する日程を入力してください。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Add new dates
  const additionalDates: ScheduleDate[] = newDates.map((date: string) => ({
    id: generateId(),
    datetime: date.trim()
  }));
  
  schedule.dates = [...schedule.dates, ...additionalDates];
  schedule.updatedAt = new Date();
  
  await storage.saveSchedule(schedule);
  
  // Save message ID if provided
  if (messageId) {
    await saveScheduleMessageId(scheduleId, messageId, storage);
  }

  // Update main message
  const updated = await updateScheduleMainMessage(
    scheduleId,
    messageId,
    interaction.token,
    storage,
    env
  );

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '✅ 日程を追加しました',
        color: EMBED_COLORS.INFO,
        fields: [{
          name: '追加された日程',
          value: additionalDates.map((d, i) => `• ${d.datetime}`).join('\n')
        }]
      }],
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleEditDeadlineModal(
  interaction: ModalInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId, messageId] = params;
  
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

  const newDeadlineStr = interaction.data.components[0].components[0].value || '';
  
  // Parse deadline
  let newDeadline: Date | null = null;
  if (newDeadlineStr.trim()) {
    newDeadline = parseUserInputDate(newDeadlineStr);
    if (!newDeadline) {
      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '締切日時の形式が正しくありません。',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    
  }

  // Update schedule
  schedule.deadline = newDeadline || undefined;
  
  // Update status based on deadline
  if (!newDeadline) {
    schedule.status = 'open';
  } else if (newDeadline > new Date()) {
    schedule.status = 'open';
  } else {
    schedule.status = 'closed';
  }
  
  schedule.updatedAt = new Date();
  
  await storage.saveSchedule(schedule);
  
  // Save message ID if provided
  if (messageId) {
    await saveScheduleMessageId(scheduleId, messageId, storage);
  }

  // Update main message
  const updated = await updateScheduleMainMessage(
    scheduleId,
    messageId,
    interaction.token,
    storage,
    env
  );

  const message = !newDeadline 
    ? '✅ 締切日を削除しました（無期限になりました）。'
    : `✅ 締切日を ${newDeadline.toLocaleString('ja-JP')} に更新しました。${schedule.status === 'closed' ? '\n⚠️ 締切日が過去のため、日程調整は締め切られました。' : ''}`;

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: updated ? message : message + '\n（メイン画面の更新には失敗しました）',
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
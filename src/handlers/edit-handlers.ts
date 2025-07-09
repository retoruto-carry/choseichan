import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ButtonInteraction } from '../types/discord';
import { StorageService } from '../services/storage';
import { createButtonId } from '../utils/id';

export async function handleEditInfoButton(
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

  // Get original message ID for later updates
  const originalMessageId = interaction.message?.message_reference?.message_id || interaction.message?.id || '';
  
  // Show modal for editing title and description
  return new Response(JSON.stringify({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `modal:edit_info:${scheduleId}:${originalMessageId}`,
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

export async function handleUpdateDatesButton(
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
    .map(date => date.datetime)
    .join('\n');

  // Get original message ID for later updates
  const originalMessageId = interaction.message?.message_reference?.message_id || interaction.message?.id || '';

  // Show modal for updating all dates
  return new Response(JSON.stringify({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `modal:update_dates:${scheduleId}:${originalMessageId}`,
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

export async function handleAddDatesButton(
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

export async function handleRemoveDatesButton(
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
      label: `${idx + 1}. ${date.datetime}`,
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

export async function handleConfirmRemoveDateButton(
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
      content: `✅ 日程「${removedDate ? removedDate.datetime : ''}」を削除しました。`
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
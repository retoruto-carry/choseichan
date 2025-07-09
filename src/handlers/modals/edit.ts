import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ModalInteraction, Env } from '../../types/discord';
import { ScheduleDate, EMBED_COLORS } from '../../types/schedule';
import { StorageServiceV2 as StorageService } from '../../services/storage-v2';
import { generateId } from '../../utils/id';
import { parseUserInputDate } from '../../utils/date';
import { updateScheduleMainMessage, saveScheduleMessageId } from '../../utils/schedule-updater';
import { NotificationService } from '../../services/notification';

export async function handleEditInfoModal(
  interaction: ModalInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const guildId = interaction.guild_id || 'default';
  const [scheduleId, messageId] = params;
  
  const schedule = await storage.getSchedule(scheduleId, guildId);
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
  
  if (!schedule.guildId) schedule.guildId = guildId;
  await storage.saveSchedule(schedule);
  
  // Save message ID if provided
  if (messageId) {
    await saveScheduleMessageId(scheduleId, messageId, storage, guildId);
  }

  // Update main message in background
  if (env.ctx) {
    env.ctx.waitUntil(
      updateScheduleMainMessage(
        scheduleId,
        messageId,
        interaction.token,
        storage,
        env
      ).catch(error => console.error('Failed to update main message:', error))
    );
  }

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: '✅ タイトルと説明を更新しました。',
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
  const guildId = interaction.guild_id || 'default';
  const [scheduleId, messageId] = params;
  
  const schedule = await storage.getSchedule(scheduleId, guildId);
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

  // Store old dates for comparison
  const oldDates = schedule.dates;
  const oldDateMap = new Map(oldDates.map(d => [d.datetime, d.id]));
  
  // Update dates, preserving IDs for existing dates
  const newDates = dates.map((date: string) => {
    const trimmedDate = date.trim();
    const existingId = oldDateMap.get(trimmedDate);
    return {
      id: existingId || generateId(),
      datetime: trimmedDate
    };
  });
  
  // Find removed date IDs
  const newDateTexts = new Set(newDates.map(d => d.datetime));
  const removedDateIds = oldDates
    .filter(d => !newDateTexts.has(d.datetime))
    .map(d => d.id);
  
  schedule.dates = newDates;
  schedule.updatedAt = new Date();
  
  if (!schedule.guildId) schedule.guildId = guildId;
  await storage.saveSchedule(schedule);
  
  // Save message ID if provided
  if (messageId) {
    await saveScheduleMessageId(scheduleId, messageId, storage, guildId);
  }

  // Delete responses for removed dates and update main message in background
  if (env.ctx) {
    env.ctx.waitUntil(
      (async () => {
        try {
          // Delete responses only for removed dates
          if (removedDateIds.length > 0) {
            const responses = await storage.listResponsesBySchedule(scheduleId);
            for (const response of responses) {
              // Filter out responses for removed dates
              const filteredResponses = response.responses.filter(
                r => !removedDateIds.includes(r.dateId)
              );
              
              if (filteredResponses.length !== response.responses.length) {
                // Update response with filtered dates
                response.responses = filteredResponses;
                await storage.saveResponse(response, guildId);
              }
            }
          }
          
          // Update main message
          await updateScheduleMainMessage(
            scheduleId,
            messageId,
            interaction.token,
            storage,
            env
          );
        } catch (error) {
          console.error('Failed to update schedule after date change:', error);
        }
      })()
    );
  }

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [{
        title: '✅ 日程を更新しました',
        description: removedDateIds.length > 0 
          ? `${removedDateIds.length}件の削除された日程の回答がリセットされました。既存の日程への回答は保持されています。`
          : '既存の日程への回答は保持されています。',
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
  const guildId = interaction.guild_id || 'default';
  const [scheduleId, messageId] = params;
  
  const schedule = await storage.getSchedule(scheduleId, guildId);
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
  
  if (!schedule.guildId) schedule.guildId = guildId;
  await storage.saveSchedule(schedule);
  
  // Save message ID if provided
  if (messageId) {
    await saveScheduleMessageId(scheduleId, messageId, storage, guildId);
  }

  // Update main message in background
  if (env.ctx) {
    env.ctx.waitUntil(
      updateScheduleMainMessage(
        scheduleId,
        messageId,
        interaction.token,
        storage,
        env
      ).catch(error => console.error('Failed to update main message:', error))
    );
  }

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
  const guildId = interaction.guild_id || 'default';
  const [scheduleId, messageId] = params;
  
  const schedule = await storage.getSchedule(scheduleId, guildId);
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
  const reminderTimingsStr = interaction.data.components[1]?.components[0]?.value || '';
  const reminderMentionsStr = interaction.data.components[2]?.components[0]?.value || '';
  
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

  // Save previous status and settings to check if they changed
  const previousStatus = schedule.status;
  const previousDeadline = schedule.deadline;
  const previousTimings = schedule.reminderTimings;
  
  // Update schedule
  schedule.deadline = newDeadline || undefined;
  
  // Parse and validate reminder timings
  if (reminderTimingsStr.trim()) {
    const timings = reminderTimingsStr.split(',').map(t => t.trim()).filter(t => t);
    const validTimings = timings.filter(t => {
      const match = t.match(/^(\d+)([dhm])$/);
      if (!match) return false;
      
      const value = parseInt(match[1]);
      const unit = match[2];
      
      // Validate reasonable ranges
      if (unit === 'd' && (value < 1 || value > 30)) return false; // 1-30 days
      if (unit === 'h' && (value < 1 || value > 720)) return false; // 1-720 hours (30 days)
      if (unit === 'm' && (value < 5 || value > 1440)) return false; // 5-1440 minutes (1 day)
      
      return true;
    });
    if (validTimings.length > 0) {
      schedule.reminderTimings = validTimings;
    }
  } else if (!newDeadline) {
    // Clear timings if no deadline
    schedule.reminderTimings = undefined;
  }
  
  // Parse reminder mentions
  if (reminderMentionsStr.trim()) {
    const mentions = reminderMentionsStr.split(',').map(m => m.trim()).filter(m => m);
    schedule.reminderMentions = mentions;
  } else if (!newDeadline) {
    // Clear mentions if no deadline
    schedule.reminderMentions = undefined;
  }
  
  // Reset reminder status if deadline or timings changed
  const timingsChanged = JSON.stringify(schedule.reminderTimings) !== JSON.stringify(previousTimings);
  if ((!previousDeadline && newDeadline) || 
      (previousDeadline && newDeadline && previousDeadline.getTime() !== newDeadline.getTime()) ||
      (previousDeadline && !newDeadline) ||
      timingsChanged) {
    // Deadline or timings were changed - reset all reminders
    schedule.reminderSent = false;
    schedule.remindersSent = [];
    console.log(`Reset reminders for schedule ${scheduleId}: deadline or timings changed`);
  }
  
  // Update status based on deadline
  if (!newDeadline) {
    schedule.status = 'open';
  } else if (newDeadline > new Date()) {
    schedule.status = 'open';
  } else {
    schedule.status = 'closed';
  }
  
  schedule.updatedAt = new Date();
  
  if (!schedule.guildId) schedule.guildId = guildId;
  await storage.saveSchedule(schedule);
  
  // Send summary message if schedule was just closed
  if (previousStatus === 'open' && schedule.status === 'closed' && env.DISCORD_TOKEN && env.DISCORD_APPLICATION_ID && env.ctx) {
    const notificationService = new NotificationService(
      storage,
      env.DISCORD_TOKEN,
      env.DISCORD_APPLICATION_ID
    );
    
    env.ctx.waitUntil(
      notificationService.sendSummaryMessage(scheduleId)
        .catch(error => {
          console.error('Failed to send summary message:', error);
          console.error('Error details:', {
            scheduleId,
            previousStatus,
            currentStatus: schedule.status
          });
        })
    );
  }
  
  // Save message ID if provided
  if (messageId) {
    await saveScheduleMessageId(scheduleId, messageId, storage, guildId);
  }

  // Update main message
  const updatePromise = updateScheduleMainMessage(
    scheduleId,
    messageId,
    interaction.token,
    storage,
    env
  );

  // Try to wait for update, but don't block response for too long
  const updateResult = await Promise.race([
    updatePromise.then(() => true).catch(() => false),
    new Promise<boolean>(resolve => setTimeout(() => resolve(true), 1000)) // 1秒に短縮
  ]);

  // Continue any remaining work in background
  if (env.ctx && typeof env.ctx.waitUntil === 'function') {
    env.ctx.waitUntil(updatePromise.catch(error => {
      console.error('Failed to update main message:', error);
    }));
  }

  let message = !newDeadline 
    ? '✅ 締切日を削除しました（無期限になりました）。'
    : `✅ 締切日を ${newDeadline.toLocaleString('ja-JP')} に更新しました。`;
  
  if (schedule.status === 'closed') {
    message += '\n⚠️ 締切日が過去のため、日程調整は締め切られました。';
  }
  
  if (reminderTimingsStr.trim()) {
    const originalTimings = reminderTimingsStr.split(',').map(t => t.trim()).filter(t => t);
    const invalidTimings = originalTimings.filter(t => !schedule.reminderTimings?.includes(t));
    
    if (invalidTimings.length > 0) {
      message += `\n⚠️ 無効なリマインダー設定は無視されました: ${invalidTimings.join(', ')}`;
      message += '\n（有効な範囲: 1-30日, 1-720時間, 5-1440分）';
    }
  }
  
  if (schedule.reminderTimings && schedule.reminderTimings.length > 0) {
    message += `\n⏰ リマインダー: ${schedule.reminderTimings.join(', ')}`;
  }
  
  if (schedule.reminderMentions && schedule.reminderMentions.length > 0) {
    message += `\n👥 通知先: ${schedule.reminderMentions.join(', ')}`;
  }

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: message,
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ButtonInteraction, Env } from '../types/discord';
import { ResponseStatus, STATUS_EMOJI, EMBED_COLORS, ScheduleSummary } from '../types/schedule';
import { StorageServiceV2 as StorageService } from '../services/storage-v2';
import { createButtonId } from '../utils/id';
import { updateOriginalMessage } from '../utils/discord';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../utils/embeds';
import { createErrorResponse } from '../utils/responses';
import { NotificationService } from '../services/notification';

export function createResponseTableEmbed(summary: ScheduleSummary) {
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
        name: `${isBest ? '⭐ ' : ''}${idx + 1}. ${date.datetime}`,
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

export async function handleStatusButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const [scheduleId] = params;
  const guildId = interaction.guild_id || 'default';
  
  // Save message ID if not already saved
  const schedule = await storage.getSchedule(scheduleId, guildId);
  if (schedule && interaction.message?.id && !schedule.messageId) {
    const { saveScheduleMessageId } = await import('../utils/schedule-updater');
    await saveScheduleMessageId(scheduleId, interaction.message.id, storage, guildId);
  }
  
  const summary = await storage.getScheduleSummary(scheduleId, guildId);
  if (!summary) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程調整が見つかりません。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Update the main message to show details
  return new Response(JSON.stringify({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      embeds: [createScheduleEmbedWithTable(summary, true)],
      components: createSimpleScheduleComponents(summary.schedule, true)
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleEditButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const guildId = interaction.guild_id || 'default';
  const [scheduleId] = params;
  
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

  // Save message ID if not already saved
  if (interaction.message?.id && !schedule.messageId) {
    const { saveScheduleMessageId } = await import('../utils/schedule-updater');
    await saveScheduleMessageId(scheduleId, interaction.message.id, storage);
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

  // Get the original message ID (the schedule message)
  const originalMessageId = interaction.message?.id || '';

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
              custom_id: createButtonId('edit_info', scheduleId, originalMessageId),
              emoji: { name: '📝' }
            },
            {
              type: 2,
              style: 2,
              label: '日程を編集',
              custom_id: createButtonId('update_dates', scheduleId, originalMessageId),
              emoji: { name: '📅' }
            },
            {
              type: 2,
              style: 2,
              label: '締切日を編集',
              custom_id: createButtonId('edit_deadline', scheduleId, originalMessageId),
              emoji: { name: '⏰' }
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

export async function handleDetailsButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const guildId = interaction.guild_id || 'default';
  const [scheduleId] = params;
  
  const summary = await storage.getScheduleSummary(scheduleId, guildId);
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
          `作成日: ${schedule.createdAt.toISOString()}`,
          `状態: ${schedule.status === 'open' ? '🟢 受付中' : '🔴 締切'}`,
          schedule.deadline ? `締切: ${schedule.deadline.toISOString()}` : '',
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
          name: `${isBest ? '⭐ ' : ''}${date.datetime}`,
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

  // Update the main message with detailed view
  const components = createSimpleScheduleComponents(schedule, true); // true = showing details
  
  return new Response(JSON.stringify({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      embeds: [embed],
      components
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleCloseButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const guildId = interaction.guild_id || 'default';
  const [scheduleId] = params;
  
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
  if (!schedule.guildId) schedule.guildId = guildId;
  await storage.saveSchedule(schedule);

  // Update the main schedule message
  if (schedule.messageId && env.DISCORD_APPLICATION_ID) {
    const { updateScheduleMainMessage } = await import('../utils/schedule-updater');
    const updatePromise = updateScheduleMainMessage(
      scheduleId,
      schedule.messageId,
      interaction.token,
      storage,
      env,
      guildId
    ).catch(error => console.error('Failed to update main message after closing:', error));
    
    if (env.ctx && typeof env.ctx.waitUntil === 'function') {
      env.ctx.waitUntil(updatePromise);
    }
  }
  
  // Send summary message and PR message to channel
  if (env.DISCORD_TOKEN && env.DISCORD_APPLICATION_ID && env.ctx) {
    const notificationService = new NotificationService(
      storage,
      env.DISCORD_TOKEN,
      env.DISCORD_APPLICATION_ID
    );
    
    env.ctx.waitUntil(
      (async () => {
        try {
          await notificationService.sendSummaryMessage(scheduleId, guildId);
          await notificationService.sendPRMessage(schedule);
        } catch (error) {
          console.error('Failed to send closure notifications:', error);
        }
      })()
    );
  }

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: '✅ 日程調整を締め切りました。',
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleReopenButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const guildId = interaction.guild_id || 'default';
  const [scheduleId] = params;
  
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
  if (!schedule.guildId) schedule.guildId = guildId;
  await storage.saveSchedule(schedule);

  // Update the main schedule message
  if (schedule.messageId && env.DISCORD_APPLICATION_ID) {
    const { updateScheduleMainMessage } = await import('../utils/schedule-updater');
    const updatePromise = updateScheduleMainMessage(
      scheduleId,
      schedule.messageId,
      interaction.token,
      storage,
      env,
      guildId
    ).catch(error => console.error('Failed to update main message after reopening:', error));
    
    if (env.ctx && typeof env.ctx.waitUntil === 'function') {
      env.ctx.waitUntil(updatePromise);
    }
  }

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: '✅ 日程調整を再開しました。',
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleDeleteButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env?: Env
): Promise<Response> {
  const guildId = interaction.guild_id || 'default';
  const [scheduleId] = params;
  
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

  // Delete the main Discord message if it exists
  if (schedule.messageId && env?.DISCORD_APPLICATION_ID && env?.ctx) {
    env.ctx.waitUntil(
      (async () => {
        try {
          const { deleteMessage } = await import('../utils/discord');
          await deleteMessage(env.DISCORD_APPLICATION_ID!, interaction.token, schedule.messageId!);
        } catch (error) {
          console.error('Failed to delete main Discord message:', error);
          // Continue with schedule deletion even if message deletion fails
        }
      })()
    );
  }

  await storage.deleteSchedule(scheduleId, guildId);

  return new Response(JSON.stringify({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      content: `日程調整「${schedule.title}」を削除しました。`,
      embeds: [],
      components: []
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleRefreshButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const guildId = interaction.guild_id || 'default';
  const [scheduleId] = params;
  
  // Get the latest schedule summary
  const summary = await storage.getScheduleSummary(scheduleId, guildId);
  if (!summary) {
    return createErrorResponse('日程調整が見つかりません。');
  }

  // Update the message with latest data
  try {
    return new Response(JSON.stringify({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        embeds: [createScheduleEmbedWithTable(summary, false)],
        components: createSimpleScheduleComponents(summary.schedule, false)
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Failed to refresh message:', error);
    return createErrorResponse('メッセージの更新に失敗しました。');
  }
}

export async function handleHideDetailsButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const guildId = interaction.guild_id || 'default';
  const [scheduleId] = params;
  
  // Get the schedule summary
  const summary = await storage.getScheduleSummary(scheduleId, guildId);
  if (!summary) {
    return createErrorResponse('日程調整が見つかりません。');
  }

  // Update to simple view
  return new Response(JSON.stringify({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      embeds: [createScheduleEmbedWithTable(summary, false)],
      components: createSimpleScheduleComponents(summary.schedule, false)
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
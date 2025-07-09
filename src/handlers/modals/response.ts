import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ModalInteraction, Env } from '../../types/discord';
import { ResponseStatus, Response as UserResponse, STATUS_EMOJI, EMBED_COLORS } from '../../types/schedule';
import { StorageServiceV2 as StorageService } from '../../services/storage-v2';
import { updateOriginalMessage } from '../../utils/discord';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../../utils/embeds';
import { createErrorResponse } from '../../utils/responses';

export async function handleInteractiveResponseModal(
  interaction: ModalInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const guildId = interaction.guild_id || 'default';
  const [scheduleId] = params;
  
  const schedule = await storage.getSchedule(scheduleId, guildId);
  if (!schedule) {
    return createErrorResponse('日程調整が見つかりません。');
  }

  if (schedule.status === 'closed') {
    return createErrorResponse('この日程調整は締め切られています。');
  }

  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userName = interaction.member?.user.username || interaction.user?.username || '';
  const comment = interaction.data.components[schedule.dates.length]?.components[0]?.value || '';

  // Build user response
  const userResponse: UserResponse = {
    scheduleId,
    userId,
    userName,
    responses: [],
    comment,
    updatedAt: new Date()
  };

  // Process each date input
  for (let i = 0; i < schedule.dates.length; i++) {
    const value = interaction.data.components[i]?.components[0]?.value || '';
    let status: ResponseStatus = 'no';
    
    if (value.includes('○') || value.includes('o') || value.includes('◯')) {
      status = 'yes';
    } else if (value.includes('△') || value.includes('▲')) {
      status = 'maybe';
    }
    
    userResponse.responses.push({
      dateId: schedule.dates[i].id,
      status
    });
  }

  // Save response and wait for it to complete
  await storage.saveResponse(userResponse, guildId);

  // Create confirmation embed
  const embed = {
    title: '✅ 回答を受け付けました',
    description: `**${schedule.title}** への回答を登録しました。\n\n💡 最大1分程度で反映されます。`,
    color: EMBED_COLORS.INFO,
    fields: schedule.dates.map((date, idx) => {
      const response = userResponse.responses[idx];
      return {
        name: date.datetime,
        value: STATUS_EMOJI[response.status as keyof typeof STATUS_EMOJI],
        inline: true
      };
    }),
    footer: {
      text: comment ? `コメント: ${comment}` : undefined
    }
  };

  // Note: We don't update the original message immediately due to KV eventual consistency
  // and potential concurrent write issues. The message will be updated when:
  // 1. Another user interacts with the message
  // 2. Someone clicks the details button
  // 3. The deadline reminder runs
  // This approach avoids showing incorrect counts during concurrent responses.
  
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [embed],
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleBulkResponseModal(
  interaction: ModalInteraction,
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

  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userName = interaction.member?.user.username || interaction.user?.username || '';
  const responses = interaction.data.components[0].components[0].value || '';
  const comment = interaction.data.components[1]?.components[0]?.value || '';

  // Parse responses
  const responseLines = responses.split('\n').filter((line: string) => line.trim());
  
  // Build user response
  const userResponse: UserResponse = {
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

  await storage.saveResponse(userResponse, guildId);

  // Create confirmation embed
  const confirmEmbed = {
    title: '✅ 回答を受け付けました',
    color: EMBED_COLORS.INFO,
    fields: schedule.dates.map((date, idx) => {
      const response = userResponse.responses.find((r: any) => r.dateId === date.id);
      return {
        name: `${idx + 1}. ${date.datetime}`,
        value: response ? STATUS_EMOJI[response.status as keyof typeof STATUS_EMOJI] : STATUS_EMOJI.no,
        inline: true
      };
    })
  };

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [confirmEmbed],
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
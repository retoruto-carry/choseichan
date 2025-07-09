import { InteractionResponseType } from 'discord-interactions';
import { CommandInteraction, Env } from '../types/discord';
import { Schedule, ScheduleDate, STATUS_EMOJI, EMBED_COLORS } from '../types/schedule';
import { StorageService } from '../services/storage';
import { generateId, createButtonId } from '../utils/id';
import { parseUserInputDate, formatDate } from '../utils/date';

export async function handleScheduleCommand(
  interaction: CommandInteraction,
  env: Env
): Promise<Response> {
  const subcommand = interaction.data.options?.[0];
  
  if (!subcommand) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'サブコマンドを指定してください。',
        flags: 64 // Ephemeral
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const storage = new StorageService(env.SCHEDULES, env.RESPONSES);

  switch (subcommand.name) {
    case 'create':
      return handleCreateCommand(interaction, storage);
    case 'list':
      return handleListCommand(interaction, storage);
    case 'status':
      return handleStatusCommand(interaction, storage);
    case 'close':
      return handleCloseCommand(interaction, storage);
    default:
      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '不明なサブコマンドです。',
          flags: 64
        }
      }), { headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleCreateCommand(
  interaction: CommandInteraction,
  storage: StorageService
): Promise<Response> {
  const options = interaction.data.options?.[0]?.options;
  
  if (!options) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'オプションが指定されていません。',
        flags: 64
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Extract options
  const title = options.find(o => o.name === 'title')?.value as string;
  const description = options.find(o => o.name === 'description')?.value as string | undefined;
  const deadline = options.find(o => o.name === 'deadline')?.value as string | undefined;
  
  // Extract dates (date1, date2, date3...)
  const dates: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const dateOption = options.find(o => o.name === `date${i}`)?.value as string | undefined;
    if (dateOption) {
      const parsedDate = parseUserInputDate(dateOption);
      if (parsedDate) {
        dates.push(parsedDate.toISOString());
      }
    }
  }

  if (dates.length === 0) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '少なくとも1つの日程を指定してください。',
        flags: 64
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Create schedule
  const scheduleId = generateId();
  const scheduleDates: ScheduleDate[] = dates.map((date, index) => ({
    id: generateId(),
    datetime: date,
    description: undefined
  }));

  const schedule: Schedule = {
    id: scheduleId,
    title,
    description,
    dates: scheduleDates,
    createdBy: {
      id: interaction.member?.user.id || interaction.user?.id || '',
      username: interaction.member?.user.username || interaction.user?.username || ''
    },
    channelId: interaction.channel_id || '',
    createdAt: new Date(),
    updatedAt: new Date(),
    deadline: deadline ? parseUserInputDate(deadline) || undefined : undefined,
    status: 'open',
    notificationSent: false
  };

  await storage.saveSchedule(schedule);

  // Create response with embed and buttons
  const embed = createScheduleEmbed(schedule);
  const components = createScheduleComponents(schedule);

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [embed],
      components
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleListCommand(
  interaction: CommandInteraction,
  storage: StorageService
): Promise<Response> {
  const channelId = interaction.channel_id;
  if (!channelId) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'このコマンドはチャンネル内でのみ使用できます。',
        flags: 64
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const schedules = await storage.listSchedulesByChannel(channelId);
  
  if (schedules.length === 0) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'このチャンネルには進行中の日程調整がありません。',
        flags: 64
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const embed = {
    title: '📋 日程調整一覧',
    color: EMBED_COLORS.INFO,
    fields: schedules.slice(0, 10).map(schedule => ({
      name: `${schedule.status === 'open' ? '🟢' : '🔴'} ${schedule.title}`,
      value: `ID: ${schedule.id}\n作成者: ${schedule.createdBy.username}\n作成日: ${formatDate(schedule.createdAt.toISOString())}`,
      inline: false
    })),
    footer: {
      text: schedules.length > 10 ? `他 ${schedules.length - 10} 件` : ''
    }
  };

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [embed],
      flags: 64
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleStatusCommand(
  interaction: CommandInteraction,
  storage: StorageService
): Promise<Response> {
  const options = interaction.data.options?.[0]?.options;
  const scheduleId = options?.find(o => o.name === 'id')?.value as string | undefined;

  if (!scheduleId) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程調整IDを指定してください。',
        flags: 64
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const summary = await storage.getScheduleSummary(scheduleId);
  
  if (!summary) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '指定された日程調整が見つかりません。',
        flags: 64
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const embed = createSummaryEmbed(summary);

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [embed],
      flags: 64
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

async function handleCloseCommand(
  interaction: CommandInteraction,
  storage: StorageService
): Promise<Response> {
  const options = interaction.data.options?.[0]?.options;
  const scheduleId = options?.find(o => o.name === 'id')?.value as string | undefined;

  if (!scheduleId) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程調整IDを指定してください。',
        flags: 64
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const schedule = await storage.getSchedule(scheduleId);
  
  if (!schedule) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '指定された日程調整が見つかりません。',
        flags: 64
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Check permission
  const userId = interaction.member?.user.id || interaction.user?.id;
  if (schedule.createdBy.id !== userId) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程調整を締め切ることができるのは作成者のみです。',
        flags: 64
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  schedule.status = 'closed';
  schedule.updatedAt = new Date();
  await storage.saveSchedule(schedule);

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `日程調整「${schedule.title}」を締め切りました。`,
      embeds: [createScheduleEmbed(schedule)]
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

function createScheduleEmbed(schedule: Schedule) {
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
        name: 'ID',
        value: schedule.id,
        inline: true
      },
      ...schedule.dates.map(date => ({
        name: formatDate(date.datetime),
        value: `${STATUS_EMOJI.yes} 0人　${STATUS_EMOJI.maybe} 0人　${STATUS_EMOJI.no} 0人`,
        inline: false
      }))
    ],
    footer: {
      text: schedule.deadline ? `締切: ${formatDate(schedule.deadline.toISOString())}` : ''
    },
    timestamp: schedule.createdAt.toISOString()
  };
}

function createSummaryEmbed(summary: import('../types/schedule').ScheduleSummary) {
  const { schedule, responseCounts, userResponses, bestDateId } = summary;
  
  return {
    title: `📊 ${schedule.title} - 集計結果`,
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
      },
      ...schedule.dates.map(date => {
        const count = responseCounts[date.id];
        const isBest = date.id === bestDateId;
        return {
          name: `${isBest ? '⭐ ' : ''}${formatDate(date.datetime)}`,
          value: `${STATUS_EMOJI.yes} ${count.yes}人　${STATUS_EMOJI.maybe} ${count.maybe}人　${STATUS_EMOJI.no} ${count.no}人`,
          inline: false
        };
      })
    ],
    footer: {
      text: `作成: ${schedule.createdBy.username}`
    },
    timestamp: schedule.updatedAt.toISOString()
  };
}

function createScheduleComponents(schedule: Schedule) {
  if (schedule.status === 'closed') {
    return [];
  }

  const rows = [];
  const dateButtons = schedule.dates.map(date => ({
    type: 2,
    style: 2, // Secondary
    label: formatDate(date.datetime),
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
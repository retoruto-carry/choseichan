import { InteractionResponseType } from 'discord-interactions';
import { CommandInteraction, Env } from '../types/discord';
import { Schedule, ScheduleDate, STATUS_EMOJI, EMBED_COLORS } from '../types/schedule';
import { StorageService } from '../services/storage';
import { generateId, createButtonId } from '../utils/id';
import { parseUserInputDate, formatDate } from '../utils/date';
import { createScheduleEmbed, createScheduleComponents } from '../utils/embeds';

export async function handleChoseisanCommand(
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
      return handleCreateCommandSimple(interaction, storage);
    case 'list':
      return handleListCommand(interaction, storage);
    case 'help':
      const { handleHelpCommand } = await import('./help');
      return handleHelpCommand();
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

async function handleCreateCommandSimple(
  interaction: CommandInteraction,
  storage: StorageService
): Promise<Response> {
  // モーダルを表示して対話的に作成
  return new Response(JSON.stringify({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: 'modal:create_schedule',
      title: '日程調整を作成',
      components: [
        {
          type: 1, // Action Row
          components: [{
            type: 4, // Text Input
            custom_id: 'title',
            label: 'タイトル',
            style: 1, // Short
            placeholder: '例: 忘年会',
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
            label: '説明（任意）',
            style: 2, // Paragraph
            placeholder: '例: 今年の忘年会の日程を決めます',
            required: false,
            max_length: 500
          }]
        },
        {
          type: 1,
          components: [{
            type: 4,
            custom_id: 'dates',
            label: '候補（1行に1つずつ）',
            style: 2, // Paragraph
            placeholder: '12/25 19:00\n12/26(土) 18:00〜20:00\n忘年会予定日',
            required: true,
            min_length: 1,
            max_length: 1000
          }]
        },
        {
          type: 1,
          components: [{
            type: 4,
            custom_id: 'deadline',
            label: '回答締切（任意）',
            style: 1, // Short
            placeholder: '12/20 23:59',
            required: false,
            max_length: 50
          }]
        }
      ]
    }
  }), { headers: { 'Content-Type': 'application/json' } });
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



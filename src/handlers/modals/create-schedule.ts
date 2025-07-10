import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ModalInteraction, Env } from '../../types/discord';
import { Schedule, ScheduleDate } from '../../types/schedule';
import { StorageServiceV2 as StorageService } from '../../services/storage-v2';
import { generateId } from '../../utils/id';
import { parseUserInputDate } from '../../utils/date';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../../utils/embeds';

export async function handleCreateScheduleModal(
  interaction: ModalInteraction,
  storage: StorageService,
  env: Env
): Promise<Response> {
  // Extract form values
  const title = interaction.data.components[0].components[0].value;
  const description = interaction.data.components[1].components[0].value || undefined;
  const datesText = interaction.data.components[2].components[0].value;
  const deadlineStr = interaction.data.components[3]?.components[0].value || undefined;
  const reminderTimingsStr = interaction.data.components[4]?.components[0].value || undefined;
  const reminderMentionsStr = interaction.data.components[5]?.components[0].value || undefined;

  // Parse dates
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

  const scheduleDates: ScheduleDate[] = dates.map((date: string) => ({
    id: generateId(),
    datetime: date.trim()
  }));

  // Parse deadline
  let deadlineDate: Date | undefined = undefined;
  if (deadlineStr && deadlineStr.trim()) {
    deadlineDate = parseUserInputDate(deadlineStr.trim());
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

  // Parse reminder timings
  let reminderTimings: string[] | undefined = undefined;
  if (reminderTimingsStr && reminderTimingsStr.trim() && deadlineDate) {
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
      reminderTimings = validTimings;
    }
  }

  // Parse reminder mentions
  let reminderMentions: string[] | undefined = undefined;
  if (reminderMentionsStr && reminderMentionsStr.trim() && deadlineDate) {
    const mentions = reminderMentionsStr.split(',').map(m => m.trim()).filter(m => m);
    if (mentions.length > 0) {
      reminderMentions = mentions;
    }
  }

  const guildId = interaction.guild_id || 'default';
  
  const authorId = interaction.member?.user.id || interaction.user?.id || '';
  
  const schedule: Schedule = {
    id: generateId(),
    title,
    description,
    dates: scheduleDates,
    deadline: deadlineDate,
    status: 'open',
    createdBy: {
      id: authorId,
      username: interaction.member?.user.username || interaction.user?.username || ''
    },
    authorId,
    channelId: interaction.channel_id || '',
    guildId,
    createdAt: new Date(),
    updatedAt: new Date(),
    notificationSent: false,
    reminderSent: false,
    remindersSent: [],
    reminderTimings: deadlineDate ? reminderTimings : undefined,
    reminderMentions: deadlineDate ? reminderMentions : undefined,
    totalResponses: 0
  };

  if (!schedule.guildId) schedule.guildId = guildId;
  await storage.saveSchedule(schedule);

  // Create response
  const summary = await storage.getScheduleSummary(schedule.id, guildId);
  if (!summary) {
    // Fallback
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程調整を作成しました。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const embed = createScheduleEmbedWithTable(summary, false);
  const components = createSimpleScheduleComponents(schedule, false);

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [embed],
      components
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
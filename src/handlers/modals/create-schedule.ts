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
  const deadlineAndReminders = interaction.data.components[3].components[0].value || undefined;

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

  // Parse deadline and reminder settings
  let deadlineDate: Date | undefined = undefined;
  let reminderTimings: string[] | undefined = undefined;
  let reminderMentions: string[] | undefined = undefined;
  
  if (deadlineAndReminders) {
    const lines = deadlineAndReminders.split('\n').map(l => l.trim()).filter(l => l);
    
    // Check if first line is a deadline or reminder setting
    let deadlineLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith('リマインダー:') && !line.startsWith('reminder:') && 
          !line.startsWith('通知先:') && !line.startsWith('mention:')) {
        // This line might be a deadline
        const parsed = parseUserInputDate(line);
        if (parsed) {
          deadlineDate = parsed;
          deadlineLineIndex = i;
          break;
        }
      }
    }
    
    // Parse reminder settings from all lines
    for (let i = 0; i < lines.length; i++) {
      if (i === deadlineLineIndex) continue; // Skip the deadline line
      
      const line = lines[i];
      if (line.startsWith('リマインダー:') || line.startsWith('reminder:')) {
        const timingsStr = line.replace(/^(リマインダー|reminder):/, '').trim();
        const timings = timingsStr.split(',').map(t => t.trim()).filter(t => t);
        const validTimings = timings.filter(t => /^\d+[dhm]$/.test(t));
        if (validTimings.length > 0) {
          reminderTimings = validTimings;
        }
      } else if (line.startsWith('通知先:') || line.startsWith('mention:')) {
        const mentionsStr = line.replace(/^(通知先|mention):/, '').trim();
        const mentions = mentionsStr.split(',').map(m => m.trim()).filter(m => m);
        if (mentions.length > 0) {
          reminderMentions = mentions;
        }
      }
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
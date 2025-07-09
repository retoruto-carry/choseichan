import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ModalSubmitInteraction, Env } from '../../types/discord';
import { Schedule, ScheduleDate } from '../../types/schedule';
import { StorageService } from '../../services/storage';
import { generateId } from '../../utils/id';
import { parseUserInputDate } from '../../utils/date';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../../utils/embeds';

export async function handleCreateScheduleModal(
  interaction: ModalSubmitInteraction,
  storage: StorageService,
  env: Env
): Promise<Response> {
  // Extract form values
  const title = interaction.data.components[0].components[0].value;
  const description = interaction.data.components[1].components[0].value || undefined;
  const datesText = interaction.data.components[2].components[0].value;
  const deadline = interaction.data.components[3].components[0].value || undefined;

  // Parse dates
  const dates = datesText.split('\n').filter(line => line.trim());
  if (dates.length === 0) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程候補を入力してください。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const scheduleDates: ScheduleDate[] = dates.map((date) => ({
    id: generateId(),
    datetime: date.trim()
  }));

  // Parse deadline if provided
  let deadlineDate: Date | undefined = undefined;
  if (deadline) {
    const parsed = parseUserInputDate(deadline);
    if (!parsed) {
      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '締切日時の形式が正しくありません。',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    deadlineDate = parsed;
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
    updatedAt: new Date(),
    channelId: interaction.channel_id || '',
    notificationSent: false
  };

  await storage.saveSchedule(schedule);

  // Create response
  const summary = await storage.getScheduleSummary(schedule.id);
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
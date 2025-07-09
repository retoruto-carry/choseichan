import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ButtonInteraction } from '../types/discord';
import { STATUS_EMOJI, ResponseStatus } from '../types/schedule';
import { StorageService } from '../services/storage';

export async function handleExportButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const [scheduleId] = params;
  
  const summary = await storage.getScheduleSummary(scheduleId);
  if (!summary) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程調整が見つかりません。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const { schedule, userResponses } = summary;
  
  // Create CSV content
  const headers = ['参加者', ...schedule.dates.map(d => d.datetime)];
  const rows = userResponses.map(ur => {
    const row = [ur.userName];
    for (const date of schedule.dates) {
      const response = ur.responses.find(r => r.dateId === date.id);
      row.push(response ? STATUS_EMOJI[response.status] : '');
    }
    return row;
  });
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `\`\`\`csv\n${csv}\n\`\`\``,
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleShowAllButton(
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

  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userResponse = await storage.getResponse(scheduleId, userId);

  // Open modal for all dates
  const modal = {
    title: schedule.title.length > 40 ? schedule.title.substring(0, 40) + '...' : schedule.title,
    custom_id: `modal:interactive_response:${scheduleId}`,
    components: schedule.dates.slice(0, 5).map((date, idx) => {
      const existingResponse = userResponse?.responses.find(r => r.dateId === date.id);
      const existingStatus = existingResponse?.status;
      const existingComment = existingResponse?.comment || '';
      
      return {
        type: 1,
        components: [{
          type: 4,
          custom_id: `date_${date.id}`,
          label: `${idx + 1}. ${date.datetime}`,
          style: 1,
          placeholder: '○、△、× のいずれかと、必要ならコメント',
          value: existingStatus ? 
            `${STATUS_EMOJI[existingStatus]} ${existingComment}`.trim() : 
            '',
          required: false,
          max_length: 100
        }]
      };
    })
  };

  return new Response(JSON.stringify({
    type: InteractionResponseType.MODAL,
    data: modal
  }), { headers: { 'Content-Type': 'application/json' } });
}
import { InteractionResponseType } from 'discord-interactions';
import { ButtonInteraction, Env } from '../types/discord';
import { StorageService } from '../services/storage';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../utils/embeds';

export async function handleToggleDetailsButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  const [scheduleId] = params;
  
  // Get the current state from the button label
  const currentButton = interaction.message?.components?.[0]?.components?.find(
    c => c.custom_id === interaction.data.custom_id
  );
  const isShowingDetails = currentButton?.label === '簡易表示';
  
  // Get schedule summary
  const summary = await storage.getScheduleSummary(scheduleId);
  if (!summary) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: {
        content: '日程調整が見つかりません。'
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }
  
  // Toggle the details view
  const showDetails = !isShowingDetails;
  
  // Create updated embed and components
  const embed = createScheduleEmbedWithTable(summary, showDetails);
  const components = createSimpleScheduleComponents(summary.schedule, showDetails);
  
  return new Response(JSON.stringify({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      embeds: [embed],
      components
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
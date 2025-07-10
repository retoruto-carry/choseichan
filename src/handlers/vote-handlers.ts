import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ButtonInteraction, Env } from '../types/discord';
import { ResponseStatus } from '../types/schedule';
import { StorageServiceV2 as StorageService } from '../services/storage-v2';
import { 
  createEphemeralResponse, 
  createErrorResponse
} from '../utils/responses';
import { updateScheduleMainMessage, saveScheduleMessageId } from '../utils/schedule-updater';
import { sendFollowupMessage } from '../utils/discord-webhook';

/**
 * 「回答する」ボタンのハンドラー
 * セレクトメニューを使った回答画面を表示
 */
export async function handleRespondButton(
  interaction: ButtonInteraction,
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

  // Save message ID if not already saved (important for select menu updates later)
  if (interaction.message?.id && !schedule.messageId) {
    await saveScheduleMessageId(scheduleId, interaction.message.id, storage, guildId);
  }

  // Get current user's responses
  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userResponse = await storage.getResponse(scheduleId, userId, guildId);
  
  // Create all select menus (divide into groups of 5 for multiple messages if needed)
  const allComponents = schedule.dates.map((date) => {
    const existingResponse = userResponse?.responses.find(r => r.dateId === date.id);
    const existingStatus = existingResponse?.status;
    
    // Set placeholder based on current status
    const statusSymbol = existingStatus === 'yes' ? '✅' : 
                        existingStatus === 'maybe' ? '❔' : 
                        existingStatus === 'no' ? '❌' : '未回答';
    const placeholder = `${statusSymbol} ${date.datetime}`;
    
    return {
      type: 1, // Action Row
      components: [{
        type: 3, // Select Menu
        custom_id: `dateselect:${scheduleId}:${date.id}`,
        placeholder,
        options: [
          {
            label: `未回答 ${date.datetime}`,
            value: 'none',
            default: !existingStatus
          },
          {
            label: `✅ ${date.datetime}`,
            value: 'yes',
            default: existingStatus === 'yes'
          },
          {
            label: `❔ ${date.datetime}`,
            value: 'maybe',
            default: existingStatus === 'maybe'
          },
          {
            label: `❌ ${date.datetime}`,
            value: 'no',
            default: existingStatus === 'no'
          }
        ]
      }]
    };
  });

  // Discord allows max 5 components per message
  const componentGroups: any[][] = [];
  for (let i = 0; i < allComponents.length; i += 5) {
    componentGroups.push(allComponents.slice(i, i + 5));
  }

  // Prepare initial response
  const totalGroups = componentGroups.length;
  const initialMessage = totalGroups === 1 
    ? `**${schedule.title}** の回答を選択してください:`
    : `**${schedule.title}** の回答を選択してください (1/${totalGroups}):\n\n📝 日程が${schedule.dates.length}件あります。`;
  
  // Send followup messages for additional groups
  if (totalGroups > 1 && env.DISCORD_APPLICATION_ID) {
    // Schedule followup messages to be sent after the initial response
    const sendFollowups = async () => {
      for (let i = 1; i < componentGroups.length; i++) {
        await sendFollowupMessage(
          env.DISCORD_APPLICATION_ID,
          interaction.token,
          `続き (${i + 1}/${totalGroups}):`,
          componentGroups[i],
          env
        );
      }
    };
    
    // Use waitUntil if available
    if (env.ctx && typeof env.ctx.waitUntil === 'function') {
      env.ctx.waitUntil(sendFollowups());
    } else {
      // Fallback: try to send immediately
      sendFollowups().catch(err => console.error('Failed to send followup messages:', err));
    }
  }
  
  // Add the delay notice as a small text after components
  const componentsWithNotice = [
    ...componentGroups[0],
    {
      type: 1, // Action Row
      components: [{
        type: 2, // Button
        style: 2, // Secondary
        label: '※反映には最大1分かかります',
        custom_id: 'delay_notice',
        disabled: true
      }]
    }
  ];
  
  // Return the first message with components
  return createEphemeralResponse(
    initialMessage,
    undefined,
    componentsWithNotice
  );
}

/**
 * セレクトメニューの選択ハンドラー
 * ユーザーの回答を保存し、メイン画面を更新
 */
export async function handleDateSelectMenu(
  interaction: ButtonInteraction,
  env: Env
): Promise<Response> {
  const guildId = interaction.guild_id || 'default';
  const parts = interaction.data.custom_id.split(':');
  const [_, scheduleId, dateId] = parts;
  
  try {
    const storage = new StorageService(env);
    
    // Quick operations only - save the vote
    const userId = interaction.member?.user.id || interaction.user?.id || '';
    const userName = interaction.member?.user.username || interaction.user?.username || '';
    const selectedValue = interaction.data.values?.[0] || 'none';
    
    // Get or create user response
    let userResponse = await storage.getResponse(scheduleId, userId, guildId);
    
    if (!userResponse) {
      userResponse = {
        scheduleId,
        userId,
        userName,
        responses: [],
        comment: '',
        updatedAt: new Date()
      };
    }
    
    // Always update userName in case it has changed
    userResponse.userName = userName;
    
    // Update the specific date response
    if (selectedValue === 'none') {
      // Remove the response for this date
      userResponse.responses = userResponse.responses.filter(r => r.dateId !== dateId);
    } else {
      const status = selectedValue as ResponseStatus;
      const existingIndex = userResponse.responses.findIndex(r => r.dateId === dateId);
      
      if (existingIndex >= 0) {
        userResponse.responses[existingIndex].status = status;
      } else {
        userResponse.responses.push({
          dateId,
          status
        });
      }
    }
    
    userResponse.updatedAt = new Date();
    
    // Save response
    await storage.saveResponse(userResponse, guildId);
    
    // Note: We don't update the main message immediately to avoid KV consistency issues
    // The message will be updated on the next interaction
  } catch (error) {
    console.error('Failed to process vote:', error);
  }
  
  // Always return DEFERRED_UPDATE_MESSAGE immediately
  return new Response(JSON.stringify({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE
  }), { headers: { 'Content-Type': 'application/json' } });
}

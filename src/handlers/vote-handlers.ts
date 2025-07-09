import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ButtonInteraction, Env } from '../types/discord';
import { ResponseStatus } from '../types/schedule';
import { StorageService } from '../services/storage';
import { 
  createEphemeralResponse, 
  createErrorResponse
} from '../utils/responses';
import { updateScheduleMainMessage, saveScheduleMessageId } from '../utils/schedule-updater';

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
  const [scheduleId] = params;
  
  const schedule = await storage.getSchedule(scheduleId);
  if (!schedule) {
    return createErrorResponse('日程調整が見つかりません。');
  }

  if (schedule.status === 'closed') {
    return createErrorResponse('この日程調整は締め切られています。');
  }

  // Save message ID if not already saved (important for select menu updates later)
  if (interaction.message?.id && !schedule.messageId) {
    await saveScheduleMessageId(scheduleId, interaction.message.id, storage);
  }

  // Get current user's responses
  const userId = interaction.member?.user.id || interaction.user?.id || '';
  const userResponse = await storage.getResponse(scheduleId, userId);
  
  // Create ephemeral message with select menus for each date (limit to 5 - Discord API limit)
  const components = schedule.dates.slice(0, 5).map((date) => {
    const existingResponse = userResponse?.responses.find(r => r.dateId === date.id);
    const existingStatus = existingResponse?.status;
    
    // Set placeholder based on current status
    const statusSymbol = existingStatus === 'yes' ? '○' : 
                        existingStatus === 'maybe' ? '△' : 
                        existingStatus === 'no' ? '×' : '未回答';
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
            label: `○ ${date.datetime}`,
            value: 'yes',
            default: existingStatus === 'yes'
          },
          {
            label: `△ ${date.datetime}`,
            value: 'maybe',
            default: existingStatus === 'maybe'
          },
          {
            label: `× ${date.datetime}`,
            value: 'no',
            default: existingStatus === 'no'
          }
        ]
      }]
    };
  });

  if (schedule.dates.length > 5) {
    // 5件を超える場合は「一括回答」ボタンで対応することを案内
    const message = `\n\n⚠️ 日程が${schedule.dates.length}件あります。最初の5件のみ表示しています。\nすべての日程に回答するには「一括回答」ボタンをご利用ください。`;
    return createEphemeralResponse(
      `**${schedule.title}** の回答を選択してください:${message}`,
      undefined,
      components
    );
  }

  const message = `**${schedule.title}** の回答を選択してください:\n`;

  return createEphemeralResponse(
    message,
    undefined,
    components
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
  const parts = interaction.data.custom_id.split(':');
  const [_, scheduleId, dateId] = parts;
  
  try {
    const storage = new StorageService(env.SCHEDULES, env.RESPONSES);
    
    // Quick operations only - save the vote
    const userId = interaction.member?.user.id || interaction.user?.id || '';
    const userName = interaction.member?.user.username || interaction.user?.username || '';
    const selectedValue = interaction.data.values?.[0] || 'none';
    
    // Get or create user response
    let userResponse = await storage.getResponse(scheduleId, userId);
    
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
    
    // Save response and get schedule in parallel
    const [schedule] = await Promise.all([
      storage.getSchedule(scheduleId),
      storage.saveResponse(userResponse)
    ]);
    
    // Only proceed with update if we have the necessary data
    if (schedule?.messageId) {
      // Create the update promise
      const updatePromise = updateScheduleMainMessage(
        scheduleId,
        schedule.messageId,
        interaction.token,
        storage,
        env
      ).catch(error => console.error('Failed to update main message:', error));
      
      // Use waitUntil if available to ensure the update completes
      if (env.ctx && typeof env.ctx.waitUntil === 'function') {
        env.ctx.waitUntil(updatePromise);
      }
    }
  } catch (error) {
    console.error('Failed to process vote:', error);
  }
  
  // Always return DEFERRED_UPDATE_MESSAGE immediately
  return new Response(JSON.stringify({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE
  }), { headers: { 'Content-Type': 'application/json' } });
}

/**
 * 古い個別回答ボタンのハンドラー（互換性のため残す）
 */
export async function handleResponseButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[]
): Promise<Response> {
  const [scheduleId] = params;
  
  const schedule = await storage.getSchedule(scheduleId);
  if (!schedule) {
    return createErrorResponse('日程調整が見つかりません。');
  }

  if (schedule.status === 'closed') {
    return createErrorResponse('この日程調整は締め切られています。');
  }

  // 新しい回答方法を使うよう誘導
  return createEphemeralResponse(
    '新しい回答方法をお使いください。メイン画面の「回答する」ボタンをクリックしてください。'
  );
}

/**
 * 古い投票ボタンのハンドラー（互換性のため残す）
 */
export async function handleVoteButton(
  interaction: ButtonInteraction,
  storage: StorageService,
  params: string[],
  env: Env
): Promise<Response> {
  // 新しい回答方法を使うよう誘導
  return createEphemeralResponse(
    '新しい回答方法をお使いください。メイン画面の「回答する」ボタンをクリックしてください。'
  );
}
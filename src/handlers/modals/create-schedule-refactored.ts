import { InteractionResponseType } from 'discord-interactions';
import { ModalInteraction, Env } from '../../types/discord';
import { StorageServiceV2 as StorageService } from '../../services/storage-v2';
import { createSimpleScheduleComponents } from '../../utils/embeds';
import { 
  ScheduleFormValidator, 
  ScheduleCreationService, 
  ScheduleAsyncOperations 
} from '../../services/schedule-creation';
import { ErrorHandler, ResponseUtils } from '../../utils/validation';
import { SUCCESS_MESSAGES } from '../../constants';

/**
 * リファクタリング後のスケジュール作成モーダルハンドラー
 * 責任を明確に分離し、テストしやすい構造に変更
 */
export async function handleCreateScheduleModal(
  interaction: ModalInteraction,
  storage: StorageService,
  env: Env
): Promise<Response> {
  try {
    // 1. フォームデータの抽出と検証
    const validationResult = ScheduleFormValidator.extractAndValidateFormData(interaction);
    if (!validationResult.isValid || !validationResult.formData) {
      return ErrorHandler.createErrorResponse(
        validationResult.error || '入力内容に問題があります。'
      );
    }

    // 2. スケジュールオブジェクトの作成
    const creationResult = ScheduleCreationService.createSchedule(
      validationResult.formData, 
      interaction
    );

    // 3. ストレージに保存
    await storage.saveSchedule(creationResult.schedule);

    // 4. Discord UIコンポーネントの作成
    // Note: createScheduleEmbedWithTable requires ScheduleSummary, but for initial creation we use createScheduleEmbed
    const { createScheduleEmbed } = await import('../../utils/embeds');
    const embed = createScheduleEmbed(creationResult.schedule);
    const components = createSimpleScheduleComponents(creationResult.schedule);

    // 5. レスポンス送信
    const response = ResponseUtils.createMessageResponse(
      undefined, // content
      [embed],
      components,
      false // not ephemeral
    );

    // 6. 非同期操作をバックグラウンドで実行
    if (env.ctx) {
      env.ctx.waitUntil(
        handleAsyncPostCreation(creationResult.schedule, interaction, env)
      );
    }

    return response;

  } catch (error) {
    return ErrorHandler.handleScheduleError(error as Error, 'schedule creation');
  }
}

/**
 * スケジュール作成後の非同期処理
 */
async function handleAsyncPostCreation(
  schedule: any,
  interaction: ModalInteraction,
  env: Env
): Promise<void> {
  try {
    // フォローアップメッセージを送信してメッセージIDを取得
    const messageResponse = await sendFollowUpMessage(interaction, env);
    
    if (messageResponse.ok) {
      const messageData = await messageResponse.json() as { id: string };
      const messageId = messageData.id;

      // メッセージIDの保存とその他の非同期処理
      await ScheduleAsyncOperations.handleAsyncOperations(
        schedule, 
        messageId, 
        env
      );
    }
  } catch (error) {
    console.error('Failed to handle async post-creation tasks:', error);
  }
}

/**
 * フォローアップメッセージを送信
 */
async function sendFollowUpMessage(
  interaction: ModalInteraction,
  env: Env
): Promise<Response> {
  const url = `https://discord.com/api/v10/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}`;
  
  return fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content: SUCCESS_MESSAGES.SCHEDULE_CREATED,
      flags: 64 // Ephemeral
    })
  });
}
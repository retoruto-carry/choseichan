/**
 * Edit Modal Controller
 * 
 * 編集モーダル機能のコントローラー
 * 元: src/handlers/modals/edit.ts の Clean Architecture版
 */

import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ModalInteraction, Env } from '../../types/discord';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { EditModalUIBuilder } from '../builders/EditModalUIBuilder';
import { updateScheduleMainMessage, saveScheduleMessageId } from '../../utils/schedule-updater';
import { NotificationService } from '../../services/notification';

export class EditModalController {
  constructor(
    private readonly dependencyContainer: DependencyContainer,
    private readonly uiBuilder: EditModalUIBuilder
  ) {}

  /**
   * 基本情報編集モーダル処理
   */
  async handleEditInfoModal(
    interaction: ModalInteraction,
    params: string[],
    env: Env,
    storage?: any // For backwards compatibility with tests
  ): Promise<Response> {
    try {
      const [scheduleId, messageId] = params;
      const guildId = interaction.guild_id || 'default';
      const userId = interaction.member?.user.id || interaction.user?.id;

      if (!userId) {
        return this.createErrorResponse('ユーザー情報を取得できませんでした。');
      }

      // 一時的にStorageServiceV2を使用（後でClean Architectureに移行）
      const { StorageServiceV2 } = await import('../../services/storage-v2');
      const storageToUse = storage || new StorageServiceV2(env);

      const schedule = await storageToUse.getSchedule(scheduleId, guildId);
      if (!schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // Update schedule
      schedule.title = interaction.data.components[0].components[0].value;
      schedule.description = interaction.data.components[1].components[0].value || undefined;
      schedule.updatedAt = new Date();
      
      if (!schedule.guildId) schedule.guildId = guildId;
      await storageToUse.saveSchedule(schedule);
      
      // Save message ID if provided
      if (messageId) {
        await saveScheduleMessageId(scheduleId, messageId, storageToUse, guildId);
      }

      // Update main message in background
      await this.handleBackgroundMessageUpdate(scheduleId, messageId, interaction, storageToUse, env, guildId);

      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '✅ タイトルと説明を更新しました。',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
      console.error('Error in handleEditInfoModal:', error);
      return this.createErrorResponse('基本情報の更新中にエラーが発生しました。');
    }
  }

  /**
   * 日程更新モーダル処理
   */
  async handleUpdateDatesModal(
    interaction: ModalInteraction,
    params: string[],
    env: Env,
    storage?: any
  ): Promise<Response> {
    try {
      const [scheduleId, messageId] = params;
      const guildId = interaction.guild_id || 'default';

      const { StorageServiceV2 } = await import('../../services/storage-v2');
      const storageToUse = storage || new StorageServiceV2(env);

      const schedule = await storageToUse.getSchedule(scheduleId, guildId);
      if (!schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // Parse new dates
      const datesInput = interaction.data.components[0].components[0].value;
      const { generateId } = await import('../../utils/id');
      
      const parsedDates = datesInput.split('\n').filter((line: string) => line.trim());
      
      if (parsedDates.length === 0) {
        return this.createErrorResponse('有効な日程が入力されていません。');
      }

      // Remove all existing responses since dates are changing
      const responses = await storageToUse.listResponsesBySchedule(scheduleId);
      for (const response of responses) {
        await storageToUse.saveResponse({ ...response, responses: [] }, guildId);
      }

      // Update schedule with new dates
      schedule.dates = parsedDates.map((datetime: string) => ({
        id: generateId(),
        datetime: datetime.trim()
      }));
      schedule.updatedAt = new Date();
      
      if (!schedule.guildId) schedule.guildId = guildId;
      await storageToUse.saveSchedule(schedule);

      // Update main message in background
      await this.handleBackgroundMessageUpdate(scheduleId, messageId, interaction, storageToUse, env, guildId);

      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `✅ 日程を更新しました。（${parsedDates.length}件）\n既存の回答はリセットされました。`,
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
      console.error('Error in handleUpdateDatesModal:', error);
      return this.createErrorResponse('日程の更新中にエラーが発生しました。');
    }
  }

  /**
   * 日程追加モーダル処理
   */
  async handleAddDatesModal(
    interaction: ModalInteraction,
    params: string[],
    env: Env,
    storage?: any
  ): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';

      const { StorageServiceV2 } = await import('../../services/storage-v2');
      const storageToUse = storage || new StorageServiceV2(env);

      const schedule = await storageToUse.getSchedule(scheduleId, guildId);
      if (!schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // Parse new dates
      const datesInput = interaction.data.components[0].components[0].value;
      const { generateId } = await import('../../utils/id');
      
      const parsedDates = datesInput.split('\n').filter((line: string) => line.trim());
      
      if (parsedDates.length === 0) {
        return this.createErrorResponse('有効な日程が入力されていません。');
      }

      // Add new dates to existing ones
      const newDates = parsedDates.map((datetime: string) => ({
        id: generateId(),
        datetime: datetime.trim()
      }));
      
      schedule.dates = [...schedule.dates, ...newDates];
      schedule.updatedAt = new Date();
      
      if (!schedule.guildId) schedule.guildId = guildId;
      await storageToUse.saveSchedule(schedule);

      // Update main message in background
      await this.handleBackgroundMessageUpdate(scheduleId, schedule.messageId, interaction, storageToUse, env, guildId);

      const { EMBED_COLORS } = await import('../../types/schedule');
      
      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [{
            title: '✅ 日程を追加しました',
            color: EMBED_COLORS.INFO,
            fields: [{
              name: '追加された日程',
              value: newDates.map((d, i) => `• ${d.datetime}`).join('\n')
            }]
          }],
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
      console.error('Error in handleAddDatesModal:', error);
      return this.createErrorResponse('日程の追加中にエラーが発生しました。');
    }
  }

  /**
   * 締切編集モーダル処理
   */
  async handleEditDeadlineModal(
    interaction: ModalInteraction,
    params: string[],
    env: Env,
    storage?: any
  ): Promise<Response> {
    try {
      const [scheduleId, messageId] = params;
      const guildId = interaction.guild_id || 'default';

      const { StorageServiceV2 } = await import('../../services/storage-v2');
      const storageToUse = storage || new StorageServiceV2(env);

      const schedule = await storageToUse.getSchedule(scheduleId, guildId);
      if (!schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // Parse deadline
      const components = interaction.data.components;
      if (!components || components.length < 1) {
        return this.createErrorResponse('フォームデータが不完全です。');
      }

      const deadlineInput = components[0].components[0].value;
      const timingsInput = components[1]?.components[0]?.value || '';
      const mentionsInput = components[2]?.components[0]?.value || '';

      let newDeadline = null;
      if (deadlineInput.trim()) {
        const { parseUserInputDate } = await import('../../utils/date');
        newDeadline = parseUserInputDate(deadlineInput.trim());
        
        if (!newDeadline) {
          return this.createErrorResponse('締切日時の形式が正しくありません。例: 2024-04-01 19:00');
        }
      }

      const oldDeadline = schedule.deadline;
      const oldTimings = schedule.reminderTimings;

      // Update schedule
      schedule.deadline = newDeadline;
      schedule.reminderTimings = timingsInput.trim() ? 
        timingsInput.split(',').map(t => t.trim()).filter(Boolean) : 
        ['3d', '1d', '8h'];
      schedule.reminderMentions = mentionsInput.trim() ? 
        mentionsInput.split(',').map(m => m.trim()).filter(Boolean) : 
        ['@here'];
      schedule.updatedAt = new Date();

      // Reset reminders if deadline or timings changed
      const deadlineChanged = (oldDeadline?.getTime() !== newDeadline?.getTime());
      const timingsChanged = JSON.stringify(oldTimings) !== JSON.stringify(schedule.reminderTimings);
      
      if (deadlineChanged || timingsChanged) {
        schedule.remindersSent = [];
        console.log(`Reset reminders for schedule ${scheduleId}: deadline or timings changed`);
      }
      
      if (!schedule.guildId) schedule.guildId = guildId;
      await storageToUse.saveSchedule(schedule);

      // Save message ID if provided
      if (messageId) {
        await saveScheduleMessageId(scheduleId, messageId, storageToUse, guildId);
      }

      // Update main message in background
      await this.handleBackgroundMessageUpdate(scheduleId, messageId, interaction, storageToUse, env, guildId);

      const message = newDeadline ? 
        `✅ 締切日を ${newDeadline.toLocaleString('ja-JP')} に更新しました。` :
        '✅ 締切日を削除しました（無期限になりました）。';

      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: message,
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
      console.error('Error in handleEditDeadlineModal:', error);
      return this.createErrorResponse('締切の設定中にエラーが発生しました。');
    }
  }

  /**
   * リマインダー編集モーダル処理
   */
  async handleEditReminderModal(
    interaction: ModalInteraction,
    params: string[],
    env: Env,
    storage?: any
  ): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';

      const { StorageServiceV2 } = await import('../../services/storage-v2');
      const storageToUse = storage || new StorageServiceV2(env);

      const schedule = await storageToUse.getSchedule(scheduleId, guildId);
      if (!schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      const timingsInput = interaction.data.components[0].components[0].value;
      const mentionsInput = interaction.data.components[1].components[0].value;

      const oldTimings = schedule.reminderTimings;

      // Update reminder settings
      schedule.reminderTimings = timingsInput.trim() ? 
        timingsInput.split(',').map(t => t.trim()).filter(Boolean) : 
        ['3d', '1d', '8h'];
      schedule.reminderMentions = mentionsInput.trim() ? 
        mentionsInput.split(',').map(m => m.trim()).filter(Boolean) : 
        ['@here'];
      schedule.updatedAt = new Date();

      // Reset reminders if timings changed
      const timingsChanged = JSON.stringify(oldTimings) !== JSON.stringify(schedule.reminderTimings);
      if (timingsChanged) {
        schedule.remindersSent = [];
        console.log(`Reset reminders for schedule ${scheduleId}: timings changed`);
      }
      
      if (!schedule.guildId) schedule.guildId = guildId;
      await storageToUse.saveSchedule(schedule);

      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '✅ リマインダー設定を更新しました。',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
      console.error('Error in handleEditReminderModal:', error);
      return this.createErrorResponse('リマインダー設定の更新中にエラーが発生しました。');
    }
  }

  private async handleBackgroundMessageUpdate(
    scheduleId: string,
    messageId: string | undefined,
    interaction: ModalInteraction,
    storage: any,
    env: Env,
    guildId: string
  ): Promise<void> {
    if (env.ctx) {
      env.ctx.waitUntil(
        updateScheduleMainMessage(
          scheduleId,
          messageId,
          interaction.token,
          storage,
          env,
          guildId
        ).catch(error => console.error('Failed to update main message:', error))
      );
    }
  }

  private createErrorResponse(message: string): Response {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: message,
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }
}

/**
 * Factory function for creating controller with dependencies
 */
export function createEditModalController(env: Env): EditModalController {
  const container = new DependencyContainer(env);
  const uiBuilder = new EditModalUIBuilder();
  
  return new EditModalController(container, uiBuilder);
}
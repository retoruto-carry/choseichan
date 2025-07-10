/**
 * Create Schedule Controller
 * 
 * 日程調整作成機能のコントローラー
 * 元: src/handlers/modals/create-schedule.ts の Clean Architecture版
 */

import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ModalInteraction, Env } from '../../types/discord';
import { Schedule, ScheduleDate } from '../../types/schedule';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { CreateScheduleUIBuilder } from '../builders/CreateScheduleUIBuilder';

export class CreateScheduleController {
  constructor(
    private readonly dependencyContainer: DependencyContainer,
    private readonly uiBuilder: CreateScheduleUIBuilder
  ) {}

  /**
   * スケジュール作成モーダル処理
   */
  async handleCreateScheduleModal(
    interaction: ModalInteraction,
    env: Env,
    storage?: any // For backwards compatibility with tests
  ): Promise<Response> {
    try {
      const guildId = interaction.guild_id || 'default';
      const authorId = interaction.member?.user.id || interaction.user?.id || '';

      if (!authorId) {
        return this.createErrorResponse('ユーザー情報を取得できませんでした。');
      }

      // 一時的にStorageServiceV2を使用（後でClean Architectureに移行）
      const { StorageServiceV2 } = await import('../../services/storage-v2');
      const storageToUse = storage || new StorageServiceV2(env);

      // フォーム値を抽出
      const title = interaction.data.components[0].components[0].value;
      const description = interaction.data.components[1].components[0].value || undefined;
      const datesText = interaction.data.components[2].components[0].value;
      const deadlineStr = interaction.data.components[3]?.components[0].value || undefined;

      // 日程をパース
      const dates = datesText.split('\n').filter((line: string) => line.trim());
      if (dates.length === 0) {
        return this.createErrorResponse('日程候補を入力してください。');
      }

      const { generateId } = await import('../../utils/id');
      const scheduleDates: ScheduleDate[] = dates.map((date: string) => ({
        id: generateId(),
        datetime: date.trim()
      }));

      // 締切をパース
      let deadlineDate: Date | undefined = undefined;
      if (deadlineStr && deadlineStr.trim()) {
        const { parseUserInputDate } = await import('../../utils/date');
        const parsedDate = parseUserInputDate(deadlineStr);
        deadlineDate = parsedDate || undefined;
        if (!deadlineDate) {
          return this.createErrorResponse('締切日時の形式が正しくありません。');
        }
      }

      // デフォルトのリマインダー設定（締切がある場合のみ）
      let reminderTimings: string[] | undefined = undefined;
      let reminderMentions: string[] | undefined = undefined;
      
      if (deadlineDate) {
        reminderTimings = ['3d', '1d', '8h'];
        reminderMentions = ['@here'];
      }

      // スケジュールオブジェクトを作成
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
      await storageToUse.saveSchedule(schedule);

      // レスポンスを作成
      const summary = await storageToUse.getScheduleSummary(schedule.id, guildId);
      if (!summary) {
        return this.createErrorResponse('日程調整を作成しましたが、詳細を取得できませんでした。');
      }

      const { createScheduleEmbedWithTable, createSimpleScheduleComponents } = await import('../../utils/embeds');
      const embed = createScheduleEmbedWithTable(summary, false);
      const components = createSimpleScheduleComponents(schedule, false);

      // メッセージIDを保存とリマインダー編集ボタンをバックグラウンドで処理
      await this.handleBackgroundTasks(schedule, interaction, storageToUse, env, guildId);

      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed],
          components
        }
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
      console.error('Error in handleCreateScheduleModal:', error);
      return this.createErrorResponse('日程調整の作成中にエラーが発生しました。');
    }
  }

  private async handleBackgroundTasks(
    schedule: Schedule,
    interaction: ModalInteraction,
    storage: any,
    env: Env,
    guildId: string
  ): Promise<void> {
    if (env.DISCORD_APPLICATION_ID && env.ctx) {
      env.ctx.waitUntil(
        (async () => {
          try {
            // メッセージIDを保存
            const { getOriginalMessage } = await import('../../utils/discord');
            const message = await getOriginalMessage(env.DISCORD_APPLICATION_ID, interaction.token);
            
            if (message?.id) {
              schedule.messageId = message.id;
              if (!schedule.guildId) schedule.guildId = guildId;
              await storage.saveSchedule(schedule);
            }
            
            // 締切がある場合、リマインダー編集ボタンを送信
            if (schedule.deadline && schedule.reminderTimings) {
              await this.sendReminderEditButton(schedule, interaction, env);
            }
          } catch (error) {
            console.error('Failed to save message ID or send reminder edit button:', error);
          }
        })()
      );
    }
  }

  private async sendReminderEditButton(
    schedule: Schedule,
    interaction: ModalInteraction,
    env: Env
  ): Promise<void> {
    const timingDisplay = schedule.reminderTimings!.map(t => {
      const match = t.match(/^(\d+)([dhm])$/);
      if (!match) return t;
      const value = parseInt(match[1]);
      const unit = match[2];
      if (unit === 'd') return `${value}日前`;
      if (unit === 'h') return `${value}時間前`;
      if (unit === 'm') return `${value}分前`;
      return t;
    }).join(' / ');

    const mentionDisplay = schedule.reminderMentions?.map(m => `\`${m}\``).join(' ') || '`@here`';
    
    const { sendFollowupMessage } = await import('../../utils/discord');
    await sendFollowupMessage(
      env.DISCORD_APPLICATION_ID,
      interaction.token,
      {
        content: `📅 リマインダーが設定されています: ${timingDisplay} | 宛先: ${mentionDisplay}`,
        components: [{
          type: 1,
          components: [{
            type: 2,
            custom_id: `reminder_edit:${schedule.id}`,
            label: 'リマインダーを編集',
            style: 2,
            emoji: { name: '🔔' }
          }]
        }],
        flags: InteractionResponseFlags.EPHEMERAL
      }
    );
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
export function createCreateScheduleController(env: Env): CreateScheduleController {
  const container = new DependencyContainer(env);
  const uiBuilder = new CreateScheduleUIBuilder();
  
  return new CreateScheduleController(container, uiBuilder);
}
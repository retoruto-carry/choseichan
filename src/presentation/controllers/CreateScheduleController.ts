/**
 * Create Schedule Controller
 *
 * 日程調整作成機能のコントローラー
 * 元: src/handlers/modals/create-schedule.ts の Clean Architecture版
 */

import { InteractionResponseFlags, InteractionResponseType } from 'discord-interactions';
import type { ScheduleResponse } from '../../application/dto/ScheduleDto';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { getLogger } from '../../infrastructure/logging/Logger';
import type { Env, ModalInteraction } from '../../infrastructure/types/discord';
import { parseUserInputDate } from '../../utils/date';
import { generateId } from '../../utils/id';
import { getOriginalMessage, sendFollowupMessage } from '../utils/discord';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../utils/embeds';

export class CreateScheduleController {
  private readonly logger = getLogger();

  constructor(private readonly dependencyContainer: DependencyContainer) {}

  /**
   * スケジュール作成モーダル処理
   */
  async handleCreateScheduleModal(interaction: ModalInteraction, env: Env): Promise<Response> {
    try {
      const guildId = interaction.guild_id || 'default';
      const authorId = interaction.member?.user.id || interaction.user?.id || '';
      const username = interaction.member?.user.username || interaction.user?.username || '';

      if (!authorId) {
        return this.createErrorResponse('ユーザー情報を取得できませんでした。');
      }

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

      const scheduleDates = dates.map((date: string) => ({
        id: generateId(),
        datetime: date.trim(),
      }));

      // 締切をパース
      let deadlineDate: string | undefined;
      if (deadlineStr?.trim()) {
        const parsedDate = parseUserInputDate(deadlineStr);
        if (!parsedDate) {
          return this.createErrorResponse('締切日時の形式が正しくありません。');
        }
        deadlineDate = parsedDate.toISOString();
      }

      // デフォルトのリマインダー設定（締切がある場合のみ）
      let reminderTimings: string[] | undefined;
      let reminderMentions: string[] | undefined;

      if (deadlineDate) {
        reminderTimings = ['3d', '1d', '8h'];
        reminderMentions = ['@here'];
      }

      // Create schedule using Clean Architecture
      const createResult = await this.dependencyContainer.createScheduleUseCase.execute({
        guildId,
        channelId: interaction.channel_id || '',
        authorId: authorId,
        authorUsername: username,
        title,
        description,
        dates: scheduleDates,
        deadline: deadlineDate,
        reminderTimings,
        reminderMentions,
      });

      if (!createResult.success || !createResult.schedule) {
        this.logger.error('Failed to create schedule', new Error('Schedule creation failed'), {
          operation: 'create-schedule',
          useCase: 'CreateScheduleController',
          guildId,
          authorId,
          errors: createResult.errors,
        });
        return this.createErrorResponse('スケジュールの作成に失敗しました。');
      }

      const schedule = createResult.schedule;

      // Get summary for display
      const summaryResult = await this.dependencyContainer.getScheduleSummaryUseCase.execute(
        schedule.id,
        guildId
      );
      if (!summaryResult.success || !summaryResult.summary) {
        this.logger.error('Failed to get schedule summary', new Error('Schedule summary retrieval failed'), {
          operation: 'get-schedule-summary',
          useCase: 'CreateScheduleController',
          scheduleId: schedule.id,
          guildId,
          errors: summaryResult.errors,
        });
        return this.createErrorResponse('スケジュール情報の取得に失敗しました。');
      }

      const embed = createScheduleEmbedWithTable(summaryResult.summary, false);
      const components = createSimpleScheduleComponents(schedule, false);

      // バックグラウンドでメッセージIDを保存
      if (env.ctx) {
        env.ctx.waitUntil(
          (async () => {
            try {
              // メッセージIDを保存
              const message = await getOriginalMessage(
                env.DISCORD_APPLICATION_ID,
                interaction.token
              );

              if (message?.id) {
                await this.dependencyContainer.updateScheduleUseCase.execute({
                  scheduleId: schedule.id,
                  guildId,
                  editorUserId: authorId,
                  messageId: message.id,
                });
              }
            } catch (error) {
              this.logger.error('Failed to save message ID', error instanceof Error ? error : new Error(String(error)), {
                operation: 'save-message-id',
                useCase: 'CreateScheduleController',
                scheduleId: schedule.id,
                guildId,
              });
            }
          })()
        );
      }

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed],
            components,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error('Error in handleCreateScheduleModal', error instanceof Error ? error : new Error(String(error)), {
        operation: 'handle-create-schedule-modal',
        useCase: 'CreateScheduleController',
        guildId: interaction.guild_id,
        authorId: interaction.member?.user.id || interaction.user?.id,
      });
      return this.createErrorResponse('スケジュール作成中にエラーが発生しました。');
    }
  }

  /**
   * 締切通知設定のフォローアップメッセージを送信
   */
  async sendReminderFollowup(
    schedule: ScheduleResponse,
    interactionToken: string,
    env: Env
  ): Promise<void> {
    if (!schedule.reminderTimings || !env.DISCORD_APPLICATION_ID) {
      return;
    }

    const timingsDisplay = schedule.reminderTimings.join(', ');
    const mentionDisplay =
      schedule.reminderMentions?.map((m: string) => `\`${m}\``).join(' ') || '`@here`';

    await sendFollowupMessage(env.DISCORD_APPLICATION_ID, interactionToken, {
      content: `⏰ 締切前リマインダーを設定しました！\n締切の ${timingsDisplay} 前に ${mentionDisplay} にリマインダーを送信します。`,
      flags: InteractionResponseFlags.EPHEMERAL,
    });
  }

  private createErrorResponse(message: string): Response {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `❌ ${message}`,
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export function createCreateScheduleController(env: Env): CreateScheduleController {
  const container = new DependencyContainer(env);
  return new CreateScheduleController(container);
}

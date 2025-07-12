/**
 * Create Schedule Controller
 *
 * 日程調整作成機能のコントローラー
 * 元: src/handlers/modals/create-schedule.ts の Clean Architecture版
 */

import { InteractionResponseFlags, InteractionResponseType } from 'discord-interactions';
import type { ScheduleResponse } from '../../application/dto/ScheduleDto';
import { ERROR_MESSAGES } from '../../constants/ApplicationConstants';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { getLogger } from '../../infrastructure/logging/Logger';
import type { Env, ModalInteraction } from '../../infrastructure/types/discord';
import { parseUserInputDate } from '../../utils/date';
import { generateId } from '../../utils/id';
import { ScheduleCreationUIBuilder } from '../builders/ScheduleCreationUIBuilder';
import { ScheduleMainMessageBuilder } from '../builders/ScheduleMainMessageBuilder';
import { createEditReminderButtonId } from '../utils/button-id';
import { getOriginalMessage, sendFollowupMessage } from '../utils/discord';

export class CreateScheduleController {
  private readonly logger = getLogger();

  constructor(
    private readonly dependencyContainer: DependencyContainer,
    private readonly uiBuilder: ScheduleCreationUIBuilder
  ) {}

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
        return this.createErrorResponse(ERROR_MESSAGES.DATES_REQUIRED);
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
          return this.createErrorResponse(ERROR_MESSAGES.INVALID_DEADLINE_FORMAT);
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
        // エラー詳細を含めて返す（デバッグ用）
        const errorMessage = createResult.errors?.join('\n') || ERROR_MESSAGES.INVALID_INPUT;
        return this.createErrorResponse(errorMessage);
      }

      const schedule = createResult.schedule;

      // Get summary for display
      const summaryResult = await this.dependencyContainer.getScheduleSummaryUseCase.execute(
        schedule.id,
        guildId
      );
      if (!summaryResult.success || !summaryResult.summary) {
        this.logger.error(
          'Failed to get schedule summary',
          new Error('Schedule summary retrieval failed'),
          {
            operation: 'get-schedule-summary',
            useCase: 'CreateScheduleController',
            scheduleId: schedule.id,
            guildId,
            errors: summaryResult.errors,
          }
        );
        return this.createErrorResponse('スケジュール情報の取得に失敗しました。');
      }

      // 統一UIBuilderを使用（簡易表示・投票ボタン表示）
      const { embed, components } = ScheduleMainMessageBuilder.createMainMessage(
        summaryResult.summary,
        undefined,
        false, // 簡易表示
        true // 投票ボタン表示
      );

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

              // リマインダー設定のフォローアップメッセージを送信
              if (
                schedule.deadline &&
                schedule.reminderTimings &&
                schedule.reminderTimings.length > 0
              ) {
                await this.sendReminderFollowup(schedule, interaction.token, env);
              }
            } catch (error) {
              this.logger.error(
                'Failed to save message ID',
                error instanceof Error ? error : new Error(String(error)),
                {
                  operation: 'save-message-id',
                  useCase: 'CreateScheduleController',
                  scheduleId: schedule.id,
                  guildId,
                }
              );
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
      this.logger.error(
        'Error in handleCreateScheduleModal',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'handle-create-schedule-modal',
          useCase: 'CreateScheduleController',
          guildId: interaction.guild_id,
          authorId: interaction.member?.user.id || interaction.user?.id,
        }
      );
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

    const timingsDisplay = schedule.reminderTimings
      .map((timing) => this.formatReminderTiming(timing))
      .join('/');
    const mentionDisplay =
      schedule.reminderMentions?.map((m: string) => `\`${m}\``).join(' ') || '`@here`';

    await sendFollowupMessage(env.DISCORD_APPLICATION_ID, interactionToken, {
      content: `**🔔 リマインダーが自動設定されました**\n締切の ${timingsDisplay} に ${mentionDisplay} にリマインダーが送信されます。`,
      components: [
        {
          type: 1, // ACTION_ROW
          components: [
            {
              type: 2, // BUTTON
              style: 2, // SECONDARY (グレー/NEUTRAL)
              label: 'リマインダーを編集',
              custom_id: createEditReminderButtonId(schedule.id),
              emoji: { name: '⏰' },
            },
          ],
        },
      ],
      flags: InteractionResponseFlags.EPHEMERAL,
    });
  }

  /**
   * リマインダータイミングを日本語表示に変換
   */
  private formatReminderTiming(timing: string): string {
    const match = timing.match(/^(\d+)([dhm])$/);
    if (!match) return timing;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'd':
        return `${value}日前`;
      case 'h':
        return `${value}時間前`;
      case 'm':
        return `${value}分前`;
      default:
        return timing;
    }
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
  const uiBuilder = new ScheduleCreationUIBuilder();
  return new CreateScheduleController(container, uiBuilder);
}

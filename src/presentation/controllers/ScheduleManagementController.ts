/**
 * Schedule Management Controller
 *
 * スケジュール管理機能のコントローラー
 * 元: src/handlers/schedule-handlers.ts の Clean Architecture版
 */

import { InteractionResponseFlags, InteractionResponseType } from 'discord-interactions';
import type { ScheduleResponseDto } from '../../application/dto/ScheduleDto';
import { DependencyContainer } from '../../di/DependencyContainer';
import { getLogger } from '../../infrastructure/logging/Logger';
import type { ButtonInteraction, Env } from '../../infrastructure/types/discord';
import { ScheduleMainMessageBuilder } from '../builders/ScheduleMainMessageBuilder';
import { ScheduleManagementUIBuilder } from '../builders/ScheduleManagementUIBuilder';
import { deleteMessage } from '../utils/discord';

export class ScheduleManagementController {
  private readonly logger = getLogger();

  constructor(
    private readonly dependencyContainer: DependencyContainer,
    private readonly uiBuilder: ScheduleManagementUIBuilder
  ) {}

  /**
   * スケジュール状況表示ボタンの処理
   */
  async handleStatusButton(interaction: ButtonInteraction, params: string[]): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';

      // メッセージIDの保存（必要な場合）
      await this.saveMessageIdIfNeeded(scheduleId, guildId, interaction.message?.id);

      // スケジュール概要取得
      const summaryResult = await this.dependencyContainer.getScheduleSummaryUseCase.execute(
        scheduleId,
        guildId
      );

      if (!summaryResult.success || !summaryResult.summary) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // 統一UIBuilderを使用（詳細表示・投票ボタン表示）
      const { embed, components } = ScheduleMainMessageBuilder.createMainMessage({
        summary: summaryResult.summary,
        showDetails: true,
        showVoteButtons: true,
      });

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: {
            embeds: [embed],
            components,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error in handleStatusButton:',
        error instanceof Error ? error : new Error(String(error))
      );
      return this.createErrorResponse('スケジュール表示中にエラーが発生しました。');
    }
  }

  /**
   * 編集ボタンの処理
   */
  async handleEditButton(interaction: ButtonInteraction, params: string[]): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';
      const userId = interaction.member?.user.id || interaction.user?.id;

      if (!userId) {
        return this.createErrorResponse('ユーザー情報を取得できませんでした。');
      }

      // スケジュール取得
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );

      if (!scheduleResult.success || !scheduleResult.schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // メッセージIDの保存（必要な場合）
      await this.saveMessageIdIfNeeded(scheduleId, guildId, interaction.message?.id);

      // 編集権限確認
      if (scheduleResult.schedule.authorId !== userId) {
        return this.createErrorResponse('日程調整を編集できるのは作成者のみです。');
      }

      // 編集メニューUI構築
      const originalMessageId = interaction.message?.id || '';
      const components = this.uiBuilder.createEditMenuComponents(
        scheduleId,
        originalMessageId,
        scheduleResult.schedule
      );

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '編集する項目を選択してください：',
            components,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error in handleEditButton:',
        error instanceof Error ? error : new Error(String(error))
      );
      return this.createErrorResponse('編集メニュー表示中にエラーが発生しました。');
    }
  }

  /**
   * 詳細表示ボタンの処理
   */
  async handleDetailsButton(interaction: ButtonInteraction, params: string[]): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';

      // スケジュール概要取得
      const summaryResult = await this.dependencyContainer.getScheduleSummaryUseCase.execute(
        scheduleId,
        guildId
      );

      if (!summaryResult.success || !summaryResult.summary) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // 統一されたScheduleMainMessageBuilderを使用（詳細表示）
      const { embed, components } = ScheduleMainMessageBuilder.createMainMessage({
        summary: summaryResult.summary,
        showDetails: true,
        showVoteButtons: true,
      });

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: {
            embeds: [embed],
            components,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error in handleDetailsButton:',
        error instanceof Error ? error : new Error(String(error))
      );
      return this.createErrorResponse('詳細表示中にエラーが発生しました。');
    }
  }

  /**
   * スケジュール締切ボタンの処理
   */
  async handleCloseButton(
    interaction: ButtonInteraction,
    params: string[],
    env: Env
  ): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';
      const userId = interaction.member?.user.id || interaction.user?.id;

      if (!userId) {
        return this.createErrorResponse('ユーザー情報を取得できませんでした。');
      }

      // スケジュール締切実行
      const closeResult = await this.dependencyContainer.closeScheduleUseCase.execute({
        scheduleId,
        guildId,
        editorUserId: userId,
      });

      if (!closeResult.success) {
        return this.createErrorResponse(
          closeResult.errors?.[0] || 'スケジュールの締切に失敗しました。'
        );
      }

      // メッセージ更新とnotifications処理
      await this.handlePostCloseActions(scheduleId, guildId, interaction, env);

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '✅ スケジュールを締め切りました。',
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error in handleCloseButton:',
        error instanceof Error ? error : new Error(String(error))
      );
      return this.createErrorResponse('スケジュール締切中にエラーが発生しました。');
    }
  }

  /**
   * スケジュール削除ボタンの処理
   */
  async handleDeleteButton(
    interaction: ButtonInteraction,
    params: string[],
    env?: Env
  ): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';
      const userId = interaction.member?.user.id || interaction.user?.id;

      if (!userId) {
        return this.createErrorResponse('ユーザー情報を取得できませんでした。');
      }

      // スケジュール取得と権限確認
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );

      if (!scheduleResult.success || !scheduleResult.schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      if (scheduleResult.schedule.authorId !== userId) {
        return this.createErrorResponse('日程調整を削除できるのは作成者のみです。');
      }

      // Discord メッセージ削除処理
      await this.handleDiscordMessageDeletion(scheduleResult.schedule, interaction, env);

      // データベースから削除
      const deleteResult = await this.dependencyContainer.deleteScheduleUseCase.execute({
        scheduleId,
        guildId,
        deletedByUserId: userId,
      });

      if (!deleteResult.success) {
        return this.createErrorResponse(deleteResult.errors?.[0] || '削除に失敗しました。');
      }

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: {
            content: `日程調整「${scheduleResult.schedule.title}」を削除しました。`,
            embeds: [],
            components: [],
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error in handleDeleteButton:',
        error instanceof Error ? error : new Error(String(error))
      );
      return this.createErrorResponse('スケジュール削除中にエラーが発生しました。');
    }
  }

  /**
   * 更新ボタンの処理
   */
  async handleRefreshButton(interaction: ButtonInteraction, params: string[]): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';

      // 最新のスケジュール概要取得
      const summaryResult = await this.dependencyContainer.getScheduleSummaryUseCase.execute(
        scheduleId,
        guildId
      );

      if (!summaryResult.success || !summaryResult.summary) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // 統一UIBuilderを使用（簡易表示・投票ボタン表示）
      const { embed, components } = ScheduleMainMessageBuilder.createMainMessage({
        summary: summaryResult.summary,
        showDetails: false,
        showVoteButtons: true,
      });

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: {
            embeds: [embed],
            components,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error in handleRefreshButton:',
        error instanceof Error ? error : new Error(String(error))
      );
      return this.createErrorResponse('メッセージの更新に失敗しました。');
    }
  }

  /**
   * 詳細非表示ボタンの処理
   */
  async handleHideDetailsButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';

      // スケジュール概要取得
      const summaryResult = await this.dependencyContainer.getScheduleSummaryUseCase.execute(
        scheduleId,
        guildId
      );

      if (!summaryResult.success || !summaryResult.summary) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // 統一UIBuilderを使用（簡易表示・投票ボタン表示）
      const { embed, components } = ScheduleMainMessageBuilder.createMainMessage({
        summary: summaryResult.summary,
        showDetails: false,
        showVoteButtons: true,
      });

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: {
            embeds: [embed],
            components,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error in handleHideDetailsButton:',
        error instanceof Error ? error : new Error(String(error))
      );
      return this.createErrorResponse('表示切替中にエラーが発生しました。');
    }
  }

  private async saveMessageIdIfNeeded(
    scheduleId: string,
    guildId: string,
    messageId?: string
  ): Promise<void> {
    if (!messageId) return;

    try {
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );

      if (scheduleResult.success && scheduleResult.schedule && !scheduleResult.schedule.messageId) {
        // MessageIDの更新
        await this.dependencyContainer.updateScheduleUseCase.execute({
          scheduleId,
          guildId,
          editorUserId: 'system',
          messageId,
        });
      }
    } catch (error) {
      this.logger.error(
        'Failed to save message ID:',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async handlePostCloseActions(
    scheduleId: string,
    guildId: string,
    _interaction: ButtonInteraction,
    env: Env
  ): Promise<void> {
    try {
      // メインメッセージの更新と通知送信（NotificationServiceを使用）
      const notificationService = this.dependencyContainer.applicationServices.notificationService;
      if (notificationService) {
        // メインメッセージ更新
        const updatePromise = notificationService
          .updateMainMessage(scheduleId, guildId)
          .catch((error) =>
            this.logger.error(
              'Failed to update main message after closing',
              error instanceof Error ? error : new Error(String(error))
            )
          );

        if (env.ctx && typeof env.ctx.waitUntil === 'function') {
          env.ctx.waitUntil(updatePromise);
        }

        // 通知送信
        try {
          await notificationService.sendSummaryMessage(scheduleId, guildId);

          // PRメッセージ送信のためにスケジュール情報を取得
          // 一時的にPR通知機能をオフ
          /*
          const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
            scheduleId,
            guildId
          );
          if (scheduleResult.success && scheduleResult.schedule) {
            notificationService.sendPRMessage(scheduleResult.schedule);
          }
          */
        } catch (error) {
          this.logger.error(
            'Failed to send closure notifications:',
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Failed to handle post close actions:',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async handleDiscordMessageDeletion(
    schedule: ScheduleResponseDto,
    interaction: ButtonInteraction,
    env?: Env
  ): Promise<void> {
    if (schedule.messageId && env?.DISCORD_APPLICATION_ID && env?.ctx) {
      env.ctx.waitUntil(
        (async () => {
          try {
            // Check if required values are available
            const applicationId = env.DISCORD_APPLICATION_ID;
            const messageId = schedule.messageId;

            if (!applicationId || !messageId) {
              this.logger.warn(
                'Missing Discord credentials or message ID, skipping message deletion'
              );
              return;
            }

            await deleteMessage(applicationId, interaction.token, messageId);
          } catch (error) {
            this.logger.error(
              'Failed to delete main Discord message:',
              error instanceof Error ? error : new Error(String(error))
            );
          }
        })()
      );
    }
  }

  private createErrorResponse(message: string): Response {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: message,
          flags: InteractionResponseFlags.EPHEMERAL,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Factory function for creating controller with dependencies
 */
export function createScheduleManagementController(env: Env): ScheduleManagementController {
  const container = new DependencyContainer(env);
  const uiBuilder = new ScheduleManagementUIBuilder();

  return new ScheduleManagementController(container, uiBuilder);
}

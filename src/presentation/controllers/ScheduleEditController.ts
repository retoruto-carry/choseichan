/**
 * Schedule Edit Controller
 *
 * スケジュール編集機能のコントローラー
 * 元: src/handlers/edit-handlers.ts の Clean Architecture版
 */

import { InteractionResponseFlags, InteractionResponseType } from 'discord-interactions';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { getLogger } from '../../infrastructure/logging/Logger';
import type { ButtonInteraction, Env } from '../../infrastructure/types/discord';
import { ScheduleEditUIBuilder } from '../builders/ScheduleEditUIBuilder';

export class ScheduleEditController {
  private readonly logger = getLogger();

  constructor(
    private readonly dependencyContainer: DependencyContainer,
    private readonly uiBuilder: ScheduleEditUIBuilder
  ) {}

  /**
   * 基本情報編集ボタン処理
   */
  async handleEditInfoButton(interaction: ButtonInteraction, params: string[]): Promise<Response> {
    try {
      const [scheduleId, originalMessageId] = params;
      const guildId = interaction.guild_id || 'default';

      // スケジュール取得
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );

      if (!scheduleResult.success || !scheduleResult.schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // モーダル構築
      const modal = this.uiBuilder.createEditInfoModal(
        scheduleResult.schedule,
        originalMessageId || interaction.message?.id || ''
      );

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.MODAL,
          data: modal,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error in handleEditInfoButton',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'handle-edit-info-button',
          useCase: 'ScheduleEditController',
          scheduleId: params[0],
          guildId: interaction.guild_id,
        }
      );
      return this.createErrorResponse('基本情報編集の表示中にエラーが発生しました。');
    }
  }

  /**
   * 日程更新ボタン処理
   */
  async handleUpdateDatesButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    try {
      const [scheduleId, originalMessageId] = params;
      const guildId = interaction.guild_id || 'default';

      // スケジュール取得
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );

      if (!scheduleResult.success || !scheduleResult.schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // モーダル構築
      const modal = this.uiBuilder.createUpdateDatesModal(
        scheduleResult.schedule,
        originalMessageId || interaction.message?.id || ''
      );

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.MODAL,
          data: modal,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error in handleUpdateDatesButton:',
        error instanceof Error ? error : new Error(String(error))
      );
      return this.createErrorResponse('日程更新の表示中にエラーが発生しました。');
    }
  }

  /**
   * 日程追加ボタン処理
   */
  async handleAddDatesButton(interaction: ButtonInteraction, params: string[]): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';

      // スケジュール存在確認
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );

      if (!scheduleResult.success || !scheduleResult.schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // モーダル構築
      const modal = this.uiBuilder.createAddDatesModal(scheduleId);

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.MODAL,
          data: modal,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error in handleAddDatesButton:',
        error instanceof Error ? error : new Error(String(error))
      );
      return this.createErrorResponse('日程追加の表示中にエラーが発生しました。');
    }
  }

  /**
   * 日程削除ボタン処理
   */
  async handleRemoveDatesButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';

      // スケジュール取得
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );

      if (!scheduleResult.success || !scheduleResult.schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // 削除選択UI構築
      const components = this.uiBuilder.createRemoveDatesComponents(scheduleResult.schedule);

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '削除する日程を選択してください：',
            components: components.slice(0, 5), // Max 5 rows
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error in handleRemoveDatesButton:',
        error instanceof Error ? error : new Error(String(error))
      );
      return this.createErrorResponse('日程削除の表示中にエラーが発生しました。');
    }
  }

  /**
   * 日程削除確認ボタン処理
   */
  async handleConfirmRemoveDateButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    try {
      const [scheduleId, dateId] = params;
      const guildId = interaction.guild_id || 'default';
      const userId = interaction.member?.user.id || interaction.user?.id;

      if (!userId) {
        return this.createErrorResponse('ユーザー情報を取得できませんでした。');
      }

      // まずスケジュール取得して権限確認
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );

      if (!scheduleResult.success || !scheduleResult.schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // 権限確認
      if (scheduleResult.schedule.authorId !== userId) {
        return this.createErrorResponse('日程調整を編集できるのは作成者のみです。');
      }

      // 削除する日程を特定
      const targetDate = scheduleResult.schedule.dates.find((d) => d.id === dateId);
      if (!targetDate) {
        return this.createErrorResponse('削除対象の日程が見つかりません。');
      }

      // 日程削除処理
      const remainingDates = scheduleResult.schedule.dates
        .filter((d) => d.id !== dateId)
        .map((d) => ({ id: d.id, datetime: d.datetime }));

      const updateResult = await this.dependencyContainer.updateScheduleUseCase.execute({
        scheduleId,
        guildId,
        editorUserId: userId,
        dates: remainingDates,
      });

      if (!updateResult.success) {
        return this.createErrorResponse('日程の削除に失敗しました。');
      }

      // Note: Response data with removed date IDs will be handled by the repository layer

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: {
            content: `✅ 日程「${targetDate.datetime}」を削除しました。`,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error in handleConfirmRemoveDateButton:',
        error instanceof Error ? error : new Error(String(error))
      );
      return this.createErrorResponse('日程削除中にエラーが発生しました。');
    }
  }

  /**
   * 締切編集ボタン処理
   */
  async handleEditDeadlineButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    try {
      const [scheduleId, originalMessageId] = params;
      const guildId = interaction.guild_id || 'default';

      // スケジュール取得
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );

      if (!scheduleResult.success || !scheduleResult.schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // モーダル構築
      const modal = this.uiBuilder.createEditDeadlineModal(
        scheduleResult.schedule,
        originalMessageId || interaction.message?.id || ''
      );

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.MODAL,
          data: modal,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error in handleEditDeadlineButton:',
        error instanceof Error ? error : new Error(String(error))
      );
      return this.createErrorResponse('締切編集の表示中にエラーが発生しました。');
    }
  }

  /**
   * リマインダー編集ボタン処理
   */
  async handleReminderEditButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';

      // スケジュール取得
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );

      if (!scheduleResult.success || !scheduleResult.schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // モーダル構築
      const modal = this.uiBuilder.createEditReminderModal(scheduleResult.schedule);

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.MODAL,
          data: modal,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error in handleReminderEditButton:',
        error instanceof Error ? error : new Error(String(error))
      );
      return this.createErrorResponse('リマインダー編集の表示中にエラーが発生しました。');
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
export function createScheduleEditController(env: Env): ScheduleEditController {
  const container = new DependencyContainer(env);
  const uiBuilder = new ScheduleEditUIBuilder();

  return new ScheduleEditController(container, uiBuilder);
}

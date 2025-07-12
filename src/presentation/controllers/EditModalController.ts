/**
 * Edit Modal Controller
 *
 * 編集モーダル機能のコントローラー
 * 元: src/handlers/modals/edit.ts の Clean Architecture版
 */

import { InteractionResponseFlags, InteractionResponseType } from 'discord-interactions';
import type { UpdateScheduleRequest } from '../../application/dto/ScheduleDto';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { getLogger } from '../../infrastructure/logging/Logger';
import type { Env, ModalInteraction } from '../../infrastructure/types/discord';
import { parseUserInputDate } from '../../utils/date';
import { generateId } from '../../utils/id';
import { EMBED_COLORS } from '../constants/ui';
import { updateOriginalMessage } from '../utils/discord';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../utils/embeds';

export class EditModalController {
  private readonly logger = getLogger();

  constructor(private readonly dependencyContainer: DependencyContainer) {}

  /**
   * 基本情報編集モーダル処理
   */
  async handleEditInfoModal(
    interaction: ModalInteraction,
    params: string[],
    env: Env
  ): Promise<Response> {
    try {
      const [scheduleId, messageId] = params;
      const guildId = interaction.guild_id || 'default';
      const userId = interaction.member?.user.id || interaction.user?.id;

      if (!userId) {
        return this.createErrorResponse('ユーザー情報を取得できませんでした。');
      }

      // Clean Architecture を使用してスケジュールを取得
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );
      if (!scheduleResult.success || !scheduleResult.schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }
      const schedule = scheduleResult.schedule;

      // Update schedule using Clean Architecture
      const updateResult = await this.dependencyContainer.updateScheduleUseCase.execute({
        scheduleId,
        guildId,
        editorUserId: userId,
        title: interaction.data.components[0].components[0].value,
        description: interaction.data.components[1].components[0].value || undefined,
        messageId: messageId || schedule.messageId,
      });

      if (!updateResult.success) {
        return this.createErrorResponse('スケジュールの更新に失敗しました。');
      }

      // Update main message in background
      if (env.ctx && (messageId || schedule.messageId)) {
        env.ctx.waitUntil(
          this.updateMainMessage(
            scheduleId,
            messageId || schedule.messageId,
            interaction.token,
            env,
            guildId
          )
        );
      }

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '✅ タイトルと説明を更新しました。',
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error('Error in handleEditInfoModal', error instanceof Error ? error : new Error(String(error)), {
        operation: 'handle-edit-info-modal',
        useCase: 'EditModalController',
        scheduleId: params[0],
        guildId: interaction.guild_id,
      });
      return this.createErrorResponse('基本情報の更新中にエラーが発生しました。');
    }
  }

  /**
   * 日程更新モーダル処理
   */
  async handleUpdateDatesModal(
    interaction: ModalInteraction,
    params: string[],
    env: Env
  ): Promise<Response> {
    try {
      const [scheduleId, messageId] = params;
      const guildId = interaction.guild_id || 'default';
      const userId = interaction.member?.user.id || interaction.user?.id;

      if (!userId) {
        return this.createErrorResponse('ユーザー情報を取得できませんでした。');
      }

      // Get schedule using Clean Architecture
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );
      if (!scheduleResult.success || !scheduleResult.schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // Parse new dates
      const datesInput = interaction.data.components[0].components[0].value;
      const parsedDates = datesInput.split('\n').filter((line: string) => line.trim());

      if (parsedDates.length === 0) {
        return this.createErrorResponse('有効な日程が入力されていません。');
      }

      // Create new dates
      const newDates = parsedDates.map((datetime: string) => ({
        id: generateId(),
        datetime: datetime.trim(),
      }));

      // Update schedule with new dates - this will reset all responses
      const updateResult = await this.dependencyContainer.updateScheduleUseCase.execute({
        scheduleId,
        guildId,
        editorUserId: userId,
        dates: newDates,
        messageId: messageId || scheduleResult.schedule.messageId,
      });

      if (!updateResult.success) {
        return this.createErrorResponse('日程の更新に失敗しました。');
      }

      // Update main message in background
      if (env.ctx && (messageId || scheduleResult.schedule.messageId)) {
        env.ctx.waitUntil(
          this.updateMainMessage(
            scheduleId,
            messageId || scheduleResult.schedule.messageId,
            interaction.token,
            env,
            guildId
          )
        );
      }

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `✅ 日程を更新しました。（${parsedDates.length}件）\n既存の回答はリセットされました。`,
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error('Error in handleUpdateDatesModal:', error instanceof Error ? error : new Error(String(error)));
      return this.createErrorResponse('日程の更新中にエラーが発生しました。');
    }
  }

  /**
   * 日程追加モーダル処理
   */
  async handleAddDatesModal(
    interaction: ModalInteraction,
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

      // Get schedule using Clean Architecture
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );
      if (!scheduleResult.success || !scheduleResult.schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }
      const schedule = scheduleResult.schedule;

      // Parse new dates
      const datesInput = interaction.data.components[0].components[0].value;
      const parsedDates = datesInput.split('\n').filter((line: string) => line.trim());

      if (parsedDates.length === 0) {
        return this.createErrorResponse('有効な日程が入力されていません。');
      }

      // Add new dates to existing ones
      const newDates = parsedDates.map((datetime: string) => ({
        id: generateId(),
        datetime: datetime.trim(),
      }));

      const combinedDates = [...schedule.dates, ...newDates];

      // Update schedule with combined dates
      const updateResult = await this.dependencyContainer.updateScheduleUseCase.execute({
        scheduleId,
        guildId,
        editorUserId: userId,
        dates: combinedDates,
      });

      if (!updateResult.success) {
        return this.createErrorResponse('日程の追加に失敗しました。');
      }

      // Update main message in background
      if (env.ctx && schedule.messageId) {
        env.ctx.waitUntil(
          this.updateMainMessage(scheduleId, schedule.messageId, interaction.token, env, guildId)
        );
      }

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `✅ ${parsedDates.length}件の日程を追加しました。`,
            embeds: [
              {
                title: '追加された日程',
                description: parsedDates.join('\n'),
                color: EMBED_COLORS.OPEN,
              },
            ],
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error('Error in handleAddDatesModal:', error instanceof Error ? error : new Error(String(error)));
      return this.createErrorResponse('日程の追加中にエラーが発生しました。');
    }
  }

  /**
   * 締切編集モーダル処理
   */
  async handleEditDeadlineModal(
    interaction: ModalInteraction,
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

      // Get schedule using Clean Architecture
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );
      if (!scheduleResult.success || !scheduleResult.schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }
      const schedule = scheduleResult.schedule;

      // Parse deadline input
      const deadlineInput = interaction.data.components[0].components[0].value;
      let newDeadline = null;
      if (deadlineInput.trim()) {
        newDeadline = parseUserInputDate(deadlineInput.trim());

        if (!newDeadline) {
          return this.createErrorResponse('締切日の形式が正しくありません。例: 2023/12/31 23:59');
        }

        if (newDeadline.getTime() <= Date.now()) {
          return this.createErrorResponse('締切日は現在より未来の日付を指定してください。');
        }
      }

      // Update schedule with new deadline (and reset reminders if deadline changed)
      const updateData: UpdateScheduleRequest = {
        scheduleId,
        guildId,
        editorUserId: userId,
        deadline: newDeadline ? newDeadline.toISOString() : null,
      };

      // Reset reminders if deadline is being changed
      if (
        (schedule.deadline && !newDeadline) ||
        (!schedule.deadline && newDeadline) ||
        (schedule.deadline &&
          newDeadline &&
          new Date(schedule.deadline).getTime() !== newDeadline.getTime())
      ) {
        updateData.reminderStates = {};
      }

      const updateResult = await this.dependencyContainer.updateScheduleUseCase.execute(updateData);

      if (!updateResult.success) {
        this.logger.error('UpdateScheduleUseCase failed', new Error(`UpdateScheduleUseCase failed: ${updateResult.errors?.join(', ')}`));
        return this.createErrorResponse('締切日の更新に失敗しました。');
      }

      // Update reminders
      const timingsInput = interaction.data.components[1]?.components[0]?.value || '';
      const mentionsInput = interaction.data.components[2]?.components[0]?.value || '';

      const timings = timingsInput.trim()
        ? timingsInput
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean)
        : [];
      const mentions = mentionsInput.trim()
        ? mentionsInput
            .split(',')
            .map((m: string) => m.trim())
            .filter(Boolean)
        : [];

      if (timings.length > 0 || mentions.length > 0) {
        await this.dependencyContainer.updateScheduleUseCase.execute({
          scheduleId,
          guildId,
          editorUserId: userId,
          reminderTimings: timings,
          reminderMentions: mentions,
        });
      }

      // Update main message in background
      if (env.ctx && schedule.messageId) {
        env.ctx.waitUntil(
          this.updateMainMessage(scheduleId, schedule.messageId, interaction.token, env, guildId)
        );
      }

      const message = newDeadline
        ? `✅ 締切日を ${newDeadline.toLocaleString('ja-JP')} に更新しました。`
        : '✅ 締切日を削除しました（無期限になりました）。';

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
    } catch (error) {
      this.logger.error('Error in handleEditDeadlineModal:', error instanceof Error ? error : new Error(String(error)));
      return this.createErrorResponse('締切日の更新中にエラーが発生しました。');
    }
  }

  /**
   * リマインダー編集モーダル処理
   */
  async handleEditReminderModal(
    interaction: ModalInteraction,
    params: string[],
    _env: Env
  ): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';
      const userId = interaction.member?.user.id || interaction.user?.id;

      if (!userId) {
        return this.createErrorResponse('ユーザー情報を取得できませんでした。');
      }

      // Get schedule using Clean Architecture
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );
      if (!scheduleResult.success || !scheduleResult.schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      // Update reminder settings
      const timingsInput = interaction.data.components[0].components[0].value;
      const mentionsInput = interaction.data.components[1].components[0].value;

      const timings = timingsInput.trim()
        ? timingsInput
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean)
        : [];
      const mentions = mentionsInput.trim()
        ? mentionsInput
            .split(',')
            .map((m: string) => m.trim())
            .filter(Boolean)
        : [];

      const updateResult = await this.dependencyContainer.updateScheduleUseCase.execute({
        scheduleId,
        guildId,
        editorUserId: userId,
        reminderTimings: timings,
        reminderMentions: mentions,
      });

      if (!updateResult.success) {
        return this.createErrorResponse('リマインダー設定の更新に失敗しました。');
      }

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '✅ リマインダー設定を更新しました。',
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error('Error in handleEditReminderModal:', error instanceof Error ? error : new Error(String(error)));
      return this.createErrorResponse('リマインダー設定の更新中にエラーが発生しました。');
    }
  }

  /**
   * バックグラウンドでメインメッセージを更新
   */
  private async updateMainMessage(
    scheduleId: string,
    messageId: string | undefined,
    interactionToken: string,
    env: Env,
    guildId: string
  ): Promise<void> {
    try {
      if (!messageId || !env.DISCORD_APPLICATION_ID) {
        return;
      }

      // Get latest schedule and summary
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );
      if (!scheduleResult.success || !scheduleResult.schedule) {
        return;
      }

      const summaryResult = await this.dependencyContainer.getScheduleSummaryUseCase.execute(
        scheduleId,
        guildId
      );
      if (!summaryResult.success || !summaryResult.summary) {
        return;
      }

      // Update the message using Discord API
      const embed = createScheduleEmbedWithTable(summaryResult.summary, false);
      const components = createSimpleScheduleComponents(scheduleResult.schedule, false);

      await updateOriginalMessage(
        env.DISCORD_APPLICATION_ID,
        interactionToken,
        {
          embeds: [embed],
          components,
        },
        messageId
      );
    } catch (error) {
      this.logger.error('Error updating main message:', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * エラーレスポンスを作成
   */
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

export function createEditModalController(env: Env): EditModalController {
  const container = new DependencyContainer(env);
  return new EditModalController(container);
}

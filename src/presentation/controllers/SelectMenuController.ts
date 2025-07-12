/**
 * Select Menu Controller
 *
 * セレクトメニューインタラクションのコントローラー
 */

import { InteractionResponseType } from 'discord-interactions';
import { MessageUpdateType } from '../../domain/services/MessageUpdateService';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { getLogger } from '../../infrastructure/logging/Logger';
import type { ButtonInteraction, Env } from '../../infrastructure/types/discord';
import { createErrorResponse } from '../utils/responses';

export class SelectMenuController {
  private readonly logger = getLogger();

  constructor(private readonly dependencyContainer: DependencyContainer) {}

  /**
   * セレクトメニューインタラクション処理
   */
  async handleSelectMenuInteraction(interaction: ButtonInteraction, _env: Env): Promise<Response> {
    try {
      const customId = interaction.data.custom_id;
      const [action, scheduleId, dateId] = customId.split(':');

      if (action !== 'dateselect') {
        return createErrorResponse('不明なセレクトメニューです。');
      }

      // @ts-ignore - SelectMenuInteractionにはvaluesプロパティがある
      const selectedValue = interaction.data.values?.[0] || 'none';
      const guildId = interaction.guild_id || 'default';
      const userId = interaction.member?.user.id || interaction.user?.id || '';
      const username = interaction.member?.user.username || interaction.user?.username || 'Unknown';

      // スケジュール取得
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );
      if (!scheduleResult.success || !scheduleResult.schedule) {
        return createErrorResponse('日程調整が見つかりません。');
      }
      const schedule = scheduleResult.schedule;

      if (schedule.status === 'closed') {
        return createErrorResponse('この日程調整は締め切られています。');
      }

      // 現在の回答を取得
      const responseResult = await this.dependencyContainer.getResponseUseCase.execute({
        scheduleId,
        userId,
        guildId,
      });

      // 既存の回答を保持
      const currentResponses: Array<{ dateId: string; status: 'ok' | 'maybe' | 'ng' }> = [];
      if (responseResult.success && responseResult.response) {
        for (const [id, status] of Object.entries(responseResult.response.dateStatuses)) {
          if (id !== dateId) {
            currentResponses.push({ dateId: id, status: status as 'ok' | 'maybe' | 'ng' });
          }
        }
      }

      // 新しい回答を追加（noneでなければ）
      if (selectedValue !== 'none') {
        const status = selectedValue === 'yes' ? 'ok' : selectedValue === 'maybe' ? 'maybe' : 'ng';
        currentResponses.push({ dateId, status });
      }

      // 回答を保存
      const submitResult = await this.dependencyContainer.submitResponseUseCase.execute({
        scheduleId,
        userId,
        username,
        responses: currentResponses,
        guildId,
      });

      if (!submitResult.success) {
        return createErrorResponse('回答の保存に失敗しました。');
      }

      // メッセージ更新をスケジュール
      if (schedule.messageId && schedule.channelId) {
        const messageUpdateService = this.dependencyContainer.messageUpdateService;
        if (messageUpdateService) {
          await messageUpdateService.scheduleUpdate({
            scheduleId,
            messageId: schedule.messageId,
            channelId: schedule.channelId,
            guildId,
            updateType: MessageUpdateType.VOTE_UPDATE,
          });
        }
      }

      // 選択を受け付けたことを示すためだけにDeferredUpdateを返す
      // UIは変更せず、バックグラウンドで処理
      return new Response(
        JSON.stringify({
          type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error handling select menu interaction',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'handle-select-menu',
          useCase: 'SelectMenuController',
          customId: interaction.data.custom_id,
          guildId: interaction.guild_id,
        }
      );
      return createErrorResponse('回答の処理中にエラーが発生しました。');
    }
  }
}

export function createSelectMenuController(env: Env): SelectMenuController {
  const container = new DependencyContainer(env);
  return new SelectMenuController(container);
}

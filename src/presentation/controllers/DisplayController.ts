/**
 * Display Controller
 *
 * 表示機能のコントローラー
 * 元: src/handlers/display-handlers.ts の Clean Architecture版
 */

import { InteractionResponseType } from 'discord-interactions';
import { DependencyContainer } from '../../di/DependencyContainer';
import { getLogger } from '../../infrastructure/logging/Logger';
import type { ButtonInteraction, Env } from '../../infrastructure/types/discord';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../utils/embeds';

export class DisplayController {
  private readonly logger = getLogger();

  constructor(private readonly dependencyContainer: DependencyContainer) {}

  /**
   * 詳細表示切り替えボタン処理
   */
  async handleToggleDetailsButton(
    interaction: ButtonInteraction,
    params: string[],
    _env: Env
  ): Promise<Response> {
    try {
      const guildId = interaction.guild_id || 'default';
      const [scheduleId] = params;

      // ボタンラベルから現在の状態を取得
      const currentButton = interaction.message?.components?.[0]?.components?.find(
        (c) => c.custom_id === interaction.data.custom_id
      );
      const isShowingDetails = currentButton?.label === '簡易表示';

      // スケジュール概要を取得 (Clean Architecture)
      const summaryResult = await this.dependencyContainer.getScheduleSummaryUseCase.execute(
        scheduleId,
        guildId
      );
      if (!summaryResult.success || !summaryResult.summary) {
        return this.createNotFoundResponse();
      }

      // 詳細表示を切り替え
      const showDetails = !isShowingDetails;

      // 更新されたembedとコンポーネントを作成
      const embed = createScheduleEmbedWithTable({ summary: summaryResult.summary, showDetails });
      const components = createSimpleScheduleComponents({
        schedule: summaryResult.summary.schedule,
        showDetails,
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
        'Error in handleToggleDetailsButton',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'handle-toggle-details-button',
          useCase: 'DisplayController',
          scheduleId: params[0],
          guildId: interaction.guild_id,
        }
      );
      return this.createErrorResponse();
    }
  }

  private createNotFoundResponse(): Response {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          content: '日程調整が見つかりません。',
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  private createErrorResponse(): Response {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          content: '表示の切り替え中にエラーが発生しました。',
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Factory function for creating controller with dependencies
 */
export function createDisplayController(env: Env): DisplayController {
  const container = new DependencyContainer(env);
  return new DisplayController(container);
}

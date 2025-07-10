/**
 * Schedule Status Controller
 * 
 * Clean Architecture实装例 - 既存ハンドラーのリファクタリング例
 * src/handlers/schedule-handlers.tsの段階的移行のためのサンプル実装
 */

import { InteractionResponseType } from 'discord-interactions';
import { ButtonInteraction, Env } from '../../types/discord';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { ScheduleStatusUIBuilder } from '../builders/ScheduleStatusUIBuilder';

export class ScheduleStatusController {
  constructor(
    private readonly dependencyContainer: DependencyContainer,
    private readonly uiBuilder: ScheduleStatusUIBuilder
  ) {}

  /**
   * スケジュール状況表示ボタンの処理
   * 既存のhandleStatusButtonの Clean Architecture版
   */
  async handleStatusButton(
    interaction: ButtonInteraction,
    params: string[]
  ): Promise<Response> {
    try {
      // 1. パラメータ検証
      if (params.length < 2) {
        return this.createErrorResponse('Invalid parameters');
      }

      const [scheduleId, guildId] = params;

      // 2. ユースケース実行
      const getScheduleSummaryUseCase = this.dependencyContainer.getScheduleSummaryUseCase;
      const summaryResult = await getScheduleSummaryUseCase.execute(scheduleId, guildId);

      if (!summaryResult.success || !summaryResult.summary) {
        return this.createErrorResponse('スケジュールが見つかりません');
      }

      // 3. UI構築
      const embed = this.uiBuilder.createStatusEmbed(summaryResult.summary);
      const components = this.uiBuilder.createStatusComponents(scheduleId, guildId);

      // 4. Discord レスポンス作成
      return new Response(JSON.stringify({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          embeds: [embed],
          components
        }
      }), { 
        headers: { 'Content-Type': 'application/json' } 
      });

    } catch (error) {
      console.error('Error in handleStatusButton:', error);
      return this.createErrorResponse('スケジュール表示中にエラーが発生しました');
    }
  }

  private createErrorResponse(message: string): Response {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: message,
        flags: 64 // EPHEMERAL
      }
    }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}

/**
 * Factory function for creating controller with dependencies
 */
export function createScheduleStatusController(env: Env): ScheduleStatusController {
  const container = new DependencyContainer(env);
  const uiBuilder = new ScheduleStatusUIBuilder();
  
  return new ScheduleStatusController(container, uiBuilder);
}
/**
 * Discord用メッセージフォーマッター実装
 *
 * プレゼンテーション層のユーティリティをラップし、
 * アプリケーション層のインターフェースを実装
 */

import type { ScheduleSummaryResponse } from '../../application/dto/ScheduleDto';
import type {
  IMessageFormatter,
  MessageComponent,
  MessageEmbed,
} from '../../application/ports/MessageFormatterPort';
import { ScheduleManagementUIBuilder } from '../../presentation/builders/ScheduleManagementUIBuilder';

export class DiscordMessageFormatter implements IMessageFormatter {
  private readonly uiBuilder = new ScheduleManagementUIBuilder();
  /**
   * スケジュールメッセージ（EmbedとComponents）を作成
   */
  formatScheduleMessage(
    summary: ScheduleSummaryResponse,
    showDetails: boolean
  ): { embed: object; components: object[] } {
    const embed = this.createScheduleEmbed(summary, showDetails);
    const components = this.createScheduleComponents(summary, showDetails);
    return { embed, components };
  }
  /**
   * スケジュールサマリーからEmbedを作成
   */
  createScheduleEmbed(summary: ScheduleSummaryResponse, isDetailed: boolean): MessageEmbed {
    // ScheduleManagementUIBuilderを使用して統一性を確保
    const embed = this.uiBuilder.createDetailedScheduleEmbed(summary, isDetailed);

    // Discord APIのEmbed形式をアプリケーション層の形式にマッピング
    return {
      title: embed.title,
      description: embed.description,
      color: embed.color,
      fields: embed.fields,
      footer: embed.footer,
      timestamp: summary.schedule.updatedAt,
    };
  }

  /**
   * スケジュールサマリーからComponentsを作成
   */
  createScheduleComponents(
    summary: ScheduleSummaryResponse,
    showDetails: boolean
  ): MessageComponent[] {
    // ScheduleManagementUIBuilderを使用して統一性を確保
    const components = this.uiBuilder.createScheduleComponents(summary.schedule, showDetails);

    // そのまま返す（型は互換性がある）
    return components as MessageComponent[];
  }
}

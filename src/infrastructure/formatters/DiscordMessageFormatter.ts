/**
 * Discord用メッセージフォーマッター実装
 * 
 * プレゼンテーション層のユーティリティをラップし、
 * アプリケーション層のインターフェースを実装
 */

import type { IMessageFormatter, MessageEmbed, MessageComponent } from '../../application/ports/MessageFormatterPort';
import type { ScheduleSummaryResponse } from '../../application/dto/ScheduleDto';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../../presentation/utils/embeds';

export class DiscordMessageFormatter implements IMessageFormatter {
  /**
   * スケジュールサマリーからEmbedを作成
   */
  createScheduleEmbed(summary: ScheduleSummaryResponse, isDetailed: boolean): MessageEmbed {
    // プレゼンテーション層のユーティリティを呼び出し
    const embed = createScheduleEmbedWithTable(summary, isDetailed);
    
    // Discord APIのEmbed形式をアプリケーション層の形式にマッピング
    return {
      title: embed.title,
      description: embed.description,
      color: embed.color,
      fields: embed.fields,
      footer: embed.footer,
      timestamp: embed.timestamp,
    };
  }

  /**
   * スケジュールサマリーからComponentsを作成
   */
  createScheduleComponents(summary: ScheduleSummaryResponse, showDetails: boolean): MessageComponent[] {
    // プレゼンテーション層のユーティリティを呼び出し
    const components = createSimpleScheduleComponents(summary.schedule, showDetails);
    
    // そのまま返す（型は互換性がある）
    return components as MessageComponent[];
  }
}
/**
 * Message Formatter Adapter
 *
 * IMessageFormatter の Infrastructure 実装
 * Presentation層のUIBuilderを使用
 */

import type { ScheduleSummaryResponse } from '../../application/dto/ScheduleDto';
import type { IMessageFormatterPort } from '../../application/ports/MessageFormatterPort';
import { ScheduleMainMessageBuilder } from '../../presentation/builders/ScheduleMainMessageBuilder';

export class MessageFormatterAdapter implements IMessageFormatterPort {
  formatScheduleMessage(
    summary: ScheduleSummaryResponse,
    showVoteButton: boolean
  ): { embed: object; components: object[] } {
    // 統一UIBuilderを使用（簡易表示・投票ボタン表示）
    return ScheduleMainMessageBuilder.createMainMessage(
      summary,
      undefined,
      false, // 簡易表示
      showVoteButton
    );
  }
}

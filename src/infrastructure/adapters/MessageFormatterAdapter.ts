/**
 * Message Formatter Adapter
 *
 * IMessageFormatter の Infrastructure 実装
 * ScheduleMainMessageBuilderを使用してUI構築を統一
 */

import type { ScheduleSummaryResponseDto } from '../../application/dto/ScheduleDto';
import type { IMessageFormatterPort } from '../../application/ports/MessageFormatterPort';
import { ScheduleMainMessageBuilder } from '../../presentation/builders/ScheduleMainMessageBuilder';

export class MessageFormatterAdapter implements IMessageFormatterPort {
  formatScheduleMessage(
    summary: ScheduleSummaryResponseDto,
    showVoteButton: boolean
  ): { embed: object; components: object[] } {
    // 統一されたScheduleMainMessageBuilderを使用
    const { embed, components } = ScheduleMainMessageBuilder.createMainMessage({
      summary,
      showDetails: false, // 投票後更新は簡易表示（詳細表示はボタンで切り替え）
      showVoteButtons: showVoteButton,
    });

    return { embed, components };
  }
}

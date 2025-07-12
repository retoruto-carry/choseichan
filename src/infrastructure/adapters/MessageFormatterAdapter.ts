/**
 * Message Formatter Adapter
 *
 * IMessageFormatter の Infrastructure 実装
 * Presentation層のUIBuilderを使用
 */

import type { ScheduleSummaryResponse } from '../../application/dto/ScheduleDto';
import type { IMessageFormatterPort } from '../../application/ports/MessageFormatterPort';
import { ScheduleUIBuilder } from '../../presentation/builders/ScheduleUIBuilder';

export class MessageFormatterAdapter implements IMessageFormatterPort {
  formatScheduleMessage(
    summary: ScheduleSummaryResponse,
    showVoteButton: boolean
  ): { embed: object; components: object[] } {
    const embed = ScheduleUIBuilder.buildScheduleEmbed(summary.schedule, summary.responseCounts, {
      showVoteButtons: showVoteButton,
    });
    const components = ScheduleUIBuilder.buildActionButtons(summary.schedule, {
      showVoteButtons: showVoteButton,
    });

    return { embed, components };
  }
}

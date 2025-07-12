/**
 * Message Formatter Adapter
 *
 * IMessageFormatter の Infrastructure 実装
 * Presentation層のUIBuilderを使用
 */

import type { ScheduleSummaryResponse } from '../../application/dto/ScheduleDto';
import type { IMessageFormatter } from '../../application/ports/MessageFormatterPort';
import { ScheduleUIBuilder } from '../../presentation/builders/ScheduleUIBuilder';

export class MessageFormatterAdapter implements IMessageFormatter {
  private uiBuilder = new ScheduleUIBuilder();

  createScheduleEmbed(summary: ScheduleSummaryResponse, showVoteButton: boolean): object {
    return this.uiBuilder.createEmbed(summary, showVoteButton);
  }

  createScheduleComponents(summary: ScheduleSummaryResponse, showVoteButton: boolean): object[] {
    return this.uiBuilder.createComponents(summary, showVoteButton);
  }
}

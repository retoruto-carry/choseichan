/**
 * Message Formatter Adapter
 *
 * IMessageFormatter の Infrastructure 実装
 * Presentation層への依存を排除し、直接フォーマットを実装
 */

import type { ScheduleResponse, ScheduleSummaryResponse } from '../../application/dto/ScheduleDto';
import type { IMessageFormatterPort } from '../../application/ports/MessageFormatterPort';
import { formatDate } from '../../utils/date';
import { createButtonId } from '../../utils/id';

// UI定数
const EMBED_COLORS = {
  open: 0x00ff00,
  closed: 0xff0000,
  info: 0x0099ff,
};

const STATUS_EMOJI = {
  yes: '✅',
  maybe: '❓',
  no: '❌',
};

export class MessageFormatterAdapter implements IMessageFormatterPort {
  formatScheduleMessage(
    summary: ScheduleSummaryResponse,
    showVoteButton: boolean
  ): { embed: object; components: object[] } {
    const embed = this.createScheduleEmbed(summary);
    const components = this.createScheduleComponents(summary.schedule, showVoteButton);

    return { embed, components };
  }

  private createScheduleEmbed(summary: ScheduleSummaryResponse) {
    const schedule = summary.schedule;
    const bestDateId = summary.bestDateId;
    const hasResponses = summary.responses && summary.responses.length > 0;

    // 日程フィールドを作成
    const dateFields = schedule.dates.map((date, idx) => {
      const isBest = date.id === bestDateId && hasResponses;
      const prefix = isBest ? '⭐ ' : '';
      const dateStr = date.datetime;

      let fieldValue = '';
      if (summary.responseCounts) {
        const count = summary.responseCounts[date.id] || { yes: 0, maybe: 0, no: 0 };
        fieldValue = `**集計：** ${STATUS_EMOJI.yes} ${count.yes}人 ${STATUS_EMOJI.maybe} ${count.maybe}人 ${STATUS_EMOJI.no} ${count.no}人`;
      } else {
        fieldValue = '集計なし';
      }

      return {
        name: `${prefix}${idx + 1}. **${dateStr}**`,
        value: fieldValue,
        inline: false,
      };
    });

    const descriptionParts = [schedule.description || '', ''];

    if (schedule.deadline) {
      descriptionParts.push(`⏰ **締切：** ${formatDate(schedule.deadline)}`);
    }

    if (summary.responses) {
      descriptionParts.push(`**回答者：** ${summary.responses.length}人`);
    }

    return {
      title: `📅 ${schedule.title}`,
      description: descriptionParts.filter(Boolean).join('\n'),
      color: schedule.status === 'open' ? EMBED_COLORS.open : EMBED_COLORS.closed,
      fields: dateFields,
      footer: {
        text: `作成者: ${schedule.createdBy.displayName || schedule.createdBy.username} | ID: ${schedule.id}`,
      },
      timestamp: new Date().toISOString(),
    };
  }

  private createScheduleComponents(schedule: ScheduleResponse, showVoteButton: boolean = true) {
    const components = [];
    const firstRowButtons = [];

    // 回答ボタン（スケジュールが開いている且つ表示フラグがtrueの場合のみ）
    if (schedule.status === 'open' && showVoteButton) {
      firstRowButtons.push({
        type: 2, // BUTTON
        style: 1, // PRIMARY (青)
        label: '回答する',
        custom_id: createButtonId('respond', schedule.id),
        emoji: { name: '✏️' },
      });
    }

    // 詳細ボタン（簡易表示時のみ表示）
    firstRowButtons.push({
      type: 2, // BUTTON
      style: 2, // SECONDARY
      label: '詳細',
      custom_id: createButtonId('status', schedule.id),
      emoji: { name: '👥' },
    });

    // 編集ボタン
    firstRowButtons.push({
      type: 2, // BUTTON
      style: 2, // SECONDARY
      label: '編集',
      custom_id: createButtonId('edit', schedule.id),
      emoji: { name: '⚙️' },
    });

    if (firstRowButtons.length > 0) {
      components.push({
        type: 1, // ACTION_ROW
        components: firstRowButtons,
      });
    }

    return components;
  }
}

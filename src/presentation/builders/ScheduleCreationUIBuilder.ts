/**
 * Schedule Creation UI Builder
 *
 * スケジュール作成用のUI構築クラス
 */

import type { APIEmbed } from 'discord-api-types/v10';
import type { ScheduleResponse, ScheduleSummaryResponse } from '../../application/dto/ScheduleDto';
import { EMBED_COLORS, STATUS_EMOJI } from '../constants/ui';
import { createButtonId } from '../utils/button-helpers';
import { formatDate } from '../utils/date-formatter';

export class ScheduleCreationUIBuilder {
  /**
   * スケジュール作成後の表示用Embedを作成
   */
  createScheduleEmbed(summary: ScheduleSummaryResponse, showDetails: boolean = false) {
    const { schedule, responses, responseCounts } = summary;
    const fields: APIEmbed['fields'] = [];

    // 締切と回答者数を最初に表示
    let headerText = '';
    if (schedule.deadline) {
      headerText += `⏰ 締切: ${formatDate(schedule.deadline)}\n`;
    }
    if (responses.length > 0) {
      headerText += `回答者: ${responses.length}人`;
    }

    // 日程候補と集計
    schedule.dates.forEach((date, index) => {
      const dateStr = date.datetime;
      let fieldValue = '';

      if (responseCounts?.[date.id]) {
        const counts = responseCounts[date.id];
        fieldValue = `集計: ✅ ${counts.yes}人 ❔ ${counts.maybe}人 ❌ ${counts.no}人`;

        // 詳細表示の場合は各ユーザーの回答も含める
        if (showDetails && responses.length > 0) {
          const userResponses = responses
            .map((ur) => {
              const status = ur.dateStatuses[date.id];
              if (!status) return null;
              const statusEmoji =
                status === 'ok'
                  ? STATUS_EMOJI.yes
                  : status === 'maybe'
                    ? STATUS_EMOJI.maybe
                    : STATUS_EMOJI.no;
              return `${statusEmoji} ${ur.username}`;
            })
            .filter((r): r is string => r !== null);

          if (userResponses.length > 0) {
            fieldValue += `\n${userResponses.join(', ')}`;
          }
        }
      } else {
        fieldValue = '集計: まだ回答がありません';
      }

      fields.push({
        name: `${index + 1}. ${dateStr}`,
        value: fieldValue,
        inline: false,
      });
    });

    return {
      title: `📅 ${schedule.title}`,
      description: headerText || schedule.description || undefined,
      color: schedule.status === 'open' ? EMBED_COLORS.OPEN : EMBED_COLORS.CLOSED,
      fields,
      footer: {
        text: `ID: ${schedule.id}`,
      },
    };
  }

  /**
   * スケジュール作成後のコンポーネントを作成
   */
  createScheduleComponents(schedule: ScheduleResponse, showDetails: boolean = false) {
    const components = [];

    // 回答するボタン（開いている時のみ）
    if (schedule.status === 'open') {
      components.push({
        type: 2,
        style: 1, // Primary
        label: '回答する',
        custom_id: createButtonId('respond', schedule.id),
        emoji: { name: '✏️' },
      });
    }

    // 詳細/簡易表示ボタン
    if (showDetails) {
      // 詳細表示中は簡易表示ボタンを表示
      components.push({
        type: 2,
        style: 2, // Secondary
        label: '簡易表示',
        custom_id: createButtonId('hide_details', schedule.id),
        emoji: { name: '📊' },
      });
    } else {
      // 簡易表示中は詳細ボタンを表示
      components.push({
        type: 2,
        style: 2, // Secondary
        label: '詳細',
        custom_id: createButtonId('status', schedule.id),
        emoji: { name: '👥' },
      });
    }

    // 更新ボタン
    components.push({
      type: 2,
      style: 2, // Secondary
      label: '更新',
      custom_id: createButtonId('refresh', schedule.id),
      emoji: { name: '🔄' },
    });

    // 編集ボタン（常に表示）
    components.push({
      type: 2,
      style: 2, // Secondary
      label: '編集',
      custom_id: createButtonId('edit', schedule.id),
      emoji: { name: '⚙️' },
    });

    return [
      {
        type: 1,
        components,
      },
    ];
  }
}

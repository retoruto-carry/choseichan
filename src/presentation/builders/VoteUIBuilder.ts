/**
 * Vote UI Builder
 *
 * 投票UIの構築専用クラス
 */

import type { ResponseDto } from '../../application/dto/ResponseDto';
import type { ScheduleResponse } from '../../application/dto/ScheduleDto';

export class VoteUIBuilder {
  /**
   * 投票セレクトメニューを作成
   */
  createVoteSelectMenus(schedule: ScheduleResponse, userResponse: ResponseDto | null) {
    return schedule.dates.map((date) => {
      const existingStatus = userResponse?.dateStatuses?.[date.id];

      // Set placeholder based on current status
      const statusSymbol =
        existingStatus === 'ok'
          ? '✅'
          : existingStatus === 'maybe'
            ? '❔'
            : existingStatus === 'ng'
              ? '❌'
              : '未回答';
      const placeholder = `${statusSymbol} ${date.datetime}`;

      return {
        type: 1, // Action Row
        components: [
          {
            type: 3, // Select Menu
            custom_id: `dateselect:${schedule.id}:${date.id}`,
            placeholder,
            options: [
              {
                label: `未回答 ${date.datetime}`,
                value: 'none',
                default: !existingStatus,
              },
              {
                label: `✅ ${date.datetime}`,
                value: 'yes',
                default: existingStatus === 'ok',
              },
              {
                label: `❔ ${date.datetime}`,
                value: 'maybe',
                default: existingStatus === 'maybe',
              },
              {
                label: `❌ ${date.datetime}`,
                value: 'no',
                default: existingStatus === 'ng',
              },
            ],
          },
        ],
      };
    });
  }
}

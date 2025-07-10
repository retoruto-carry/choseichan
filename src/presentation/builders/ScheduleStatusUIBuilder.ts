/**
 * Schedule Status UI Builder
 * 
 * UI構築専用クラス - Discord特有のUI構築ロジックを分離
 */

import { ScheduleSummaryResponse } from '../../application/dto/ScheduleDto';
import { STATUS_EMOJI, EMBED_COLORS } from '../../types/schedule';
import { createButtonId } from '../../utils/id';

export class ScheduleStatusUIBuilder {
  /**
   * スケジュール状況表示用のEmbedを作成
   */
  createStatusEmbed(summary: ScheduleSummaryResponse) {
    const { schedule, responses, responseCounts, bestDateId } = summary;
    
    return {
      title: `📊 ${schedule.title}`,
      color: EMBED_COLORS.INFO,
      fields: schedule.dates.slice(0, 10).map((date, idx) => {
        const count = responseCounts[date.id];
        const isBest = date.id === bestDateId && responses.length > 0;
        
        // Get responses for this date
        const dateResponses = responses
          .map(response => {
            const status = response.dateStatuses[date.id];
            if (!status) return null;
            const comment = response.comment ? ` (${response.comment})` : '';
            const emoji = status === 'ok' ? STATUS_EMOJI.yes : 
                         status === 'maybe' ? STATUS_EMOJI.maybe : 
                         STATUS_EMOJI.no;
            return `${emoji} ${response.username}${comment}`;
          })
          .filter(Boolean);
        
        return {
          name: `${isBest ? '⭐ ' : ''}${idx + 1}. ${date.datetime}`,
          value: [
            `集計: ${STATUS_EMOJI.yes} ${count.yes}人 ${STATUS_EMOJI.maybe} ${count.maybe}人 ${STATUS_EMOJI.no} ${count.no}人`,
            dateResponses.length > 0 ? dateResponses.join(', ') : '回答なし'
          ].join('\n'),
          inline: false
        };
      }),
      footer: {
        text: `回答者: ${responses.length}人`
      }
    };
  }

  /**
   * スケジュール状況表示用のコンポーネントを作成
   */
  createStatusComponents(scheduleId: string, guildId: string) {
    return [
      {
        type: 1, // ACTION_ROW
        components: [
          {
            type: 2, // BUTTON
            style: 2, // SECONDARY
            label: '回答する',
            custom_id: createButtonId('vote', scheduleId, guildId)
          },
          {
            type: 2, // BUTTON
            style: 2, // SECONDARY
            label: '詳細表示',
            custom_id: createButtonId('detail', scheduleId, guildId)
          },
          {
            type: 2, // BUTTON
            style: 1, // PRIMARY
            label: '更新',
            custom_id: createButtonId('status', scheduleId, guildId)
          }
        ]
      }
    ];
  }

  /**
   * エラー用のEmbedを作成
   */
  createErrorEmbed(message: string) {
    return {
      title: '❌ エラー',
      description: message,
      color: EMBED_COLORS.CLOSED // Using red color for errors
    };
  }
}
/**
 * Schedule Management UI Builder
 *
 * スケジュール管理のUI構築専用クラス
 */

import type { ScheduleResponse, ScheduleSummaryResponse } from '../../application/dto/ScheduleDto';
import { createButtonId } from '../../utils/id';
import { EMBED_COLORS, STATUS_EMOJI } from '../constants/ui';

export class ScheduleManagementUIBuilder {
  /**
   * 詳細なスケジュール表示用のEmbedを作成
   */
  createDetailedScheduleEmbed(summary: ScheduleSummaryResponse) {
    const { schedule, responses } = summary;

    return {
      title: `📅 ${schedule.title}`,
      description: schedule.description || '説明なし',
      color: schedule.status === 'open' ? EMBED_COLORS.OPEN : EMBED_COLORS.CLOSED,
      fields: [
        {
          name: '📊 回答状況',
          value: `回答者: ${responses.length}人`,
          inline: true,
        },
        {
          name: '📅 候補日程',
          value: `${schedule.dates.length}個の候補`,
          inline: true,
        },
        {
          name: '⏰ 締切',
          value: schedule.deadline
            ? new Date(schedule.deadline).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
            : '未設定',
          inline: true,
        },
      ],
      footer: {
        text: `ID: ${schedule.id} | ステータス: ${schedule.status === 'open' ? '受付中' : '締切済み'}`,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 詳細情報表示用のEmbedを作成（レガシー互換）
   */
  createDetailedInfoEmbed(summary: ScheduleSummaryResponse) {
    const { schedule, responses, responseCounts, bestDateId } = summary;

    return {
      title: `📊 ${schedule.title} - 詳細`,
      color: EMBED_COLORS.INFO,
      fields: [
        {
          name: '基本情報',
          value: [
            `作成者: ${schedule.createdBy.username}`,
            `作成日: ${new Date(schedule.createdAt).toISOString()}`,
            `状態: ${schedule.status === 'open' ? '🟢 受付中' : '🔴 締切'}`,
            schedule.deadline ? `締切: ${new Date(schedule.deadline).toISOString()}` : '',
            `回答者数: ${responses.length}人`,
          ]
            .filter(Boolean)
            .join('\n'),
          inline: false,
        },
        ...schedule.dates.map((date) => {
          const count = responseCounts[date.id];
          const isBest = date.id === bestDateId;
          const respondents = responses
            .map((ur) => {
              const response = ur.dateStatuses[date.id];
              if (!response) return null;
              return `${STATUS_EMOJI[response === 'ok' ? 'yes' : response === 'maybe' ? 'maybe' : 'no']} ${ur.username}`;
            })
            .filter(Boolean);

          return {
            name: `${isBest ? '⭐ ' : ''}${date.datetime}`,
            value: [
              `${STATUS_EMOJI.yes} ${count.yes}人　${STATUS_EMOJI.maybe} ${count.maybe}人　${STATUS_EMOJI.no} ${count.no}人`,
              respondents.length > 0 ? respondents.join(', ') : '回答なし',
            ].join('\n'),
            inline: false,
          };
        }),
      ],
      footer: {
        text: `ID: ${schedule.id}`,
      },
      timestamp: new Date(schedule.updatedAt).toISOString(),
    };
  }

  /**
   * 回答状況テーブル用のEmbedを作成
   */
  createResponseTableEmbed(summary: ScheduleSummaryResponse) {
    const { schedule, responses, responseCounts, bestDateId } = summary;

    return {
      title: `📊 ${schedule.title}`,
      color: EMBED_COLORS.INFO,
      fields: schedule.dates.slice(0, 10).map((date, idx) => {
        const count = responseCounts[date.id];
        const isBest = date.id === bestDateId && responses.length > 0;

        // Get responses for this date
        const dateResponses = responses
          .map((response) => {
            const status = response.dateStatuses[date.id];
            if (!status) return null;
            const comment = response.comment ? ` (${response.comment})` : '';
            const emoji =
              status === 'ok'
                ? STATUS_EMOJI.yes
                : status === 'maybe'
                  ? STATUS_EMOJI.maybe
                  : STATUS_EMOJI.no;
            return `${emoji} ${response.username}${comment}`;
          })
          .filter(Boolean);

        return {
          name: `${isBest ? '⭐ ' : ''}${idx + 1}. ${date.datetime}`,
          value: [
            `集計: ${STATUS_EMOJI.yes} ${count.yes}人 ${STATUS_EMOJI.maybe} ${count.maybe}人 ${STATUS_EMOJI.no} ${count.no}人`,
            dateResponses.length > 0 ? dateResponses.join(', ') : '回答なし',
          ].join('\n'),
          inline: false,
        };
      }),
      footer: {
        text: `回答者: ${responses.length}人`,
      },
    };
  }

  /**
   * スケジュール用のコンポーネントを作成
   */
  createScheduleComponents(schedule: ScheduleResponse, showDetails: boolean = false) {
    return [
      {
        type: 1, // ACTION_ROW
        components: [
          {
            type: 2, // BUTTON
            style: 1, // PRIMARY
            label: '回答する',
            custom_id: createButtonId('vote', schedule.id, schedule.guildId),
            emoji: { name: '📝' },
          },
          {
            type: 2, // BUTTON
            style: 2, // SECONDARY
            label: showDetails ? '詳細非表示' : '詳細表示',
            custom_id: createButtonId(
              showDetails ? 'status' : 'details',
              schedule.id,
              schedule.guildId
            ),
          },
          {
            type: 2, // BUTTON
            style: 2, // SECONDARY
            label: '編集',
            custom_id: createButtonId('edit', schedule.id, schedule.guildId),
            emoji: { name: '✏️' },
          },
        ],
      },
    ];
  }

  /**
   * 編集メニューのコンポーネントを作成
   */
  createEditMenuComponents(
    scheduleId: string,
    originalMessageId: string,
    schedule: ScheduleResponse
  ) {
    return [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: 'タイトル・説明を編集',
            custom_id: createButtonId('edit_info', scheduleId, originalMessageId),
            emoji: { name: '📝' },
          },
          {
            type: 2,
            style: 2,
            label: '日程を編集',
            custom_id: createButtonId('update_dates', scheduleId, originalMessageId),
            emoji: { name: '📅' },
          },
          {
            type: 2,
            style: 2,
            label: '締切日を編集',
            custom_id: createButtonId('edit_deadline', scheduleId, originalMessageId),
            emoji: { name: '⏰' },
          },
        ],
      },
      {
        type: 1,
        components: [
          ...(schedule.status === 'open'
            ? [
                {
                  type: 2,
                  style: 4, // DANGER
                  label: '締め切る',
                  custom_id: createButtonId('close', scheduleId),
                  emoji: { name: '🔒' },
                },
              ]
            : []),
          {
            type: 2,
            style: 4, // DANGER
            label: '削除する',
            custom_id: createButtonId('delete', scheduleId),
            emoji: { name: '🗑️' },
          },
        ],
      },
    ];
  }

  /**
   * 一覧表示用のEmbedを作成
   */
  createScheduleListEmbed(schedules: ScheduleResponse[], _guildId: string) {
    if (schedules.length === 0) {
      return {
        title: '📅 日程調整一覧',
        description: 'このチャンネルには日程調整がありません。',
        color: EMBED_COLORS.INFO,
      };
    }

    const scheduleList = schedules
      .slice(0, 10)
      .map((schedule, idx) => {
        const status = schedule.status === 'open' ? '🟢 受付中' : '🔴 締切済み';
        const deadline = schedule.deadline
          ? `締切: ${new Date(schedule.deadline).toLocaleDateString('ja-JP')}`
          : '締切なし';

        return `${idx + 1}. **${schedule.title}** ${status}\n   ${deadline} | 回答: ${schedule.totalResponses}人`;
      })
      .join('\n\n');

    return {
      title: '📅 日程調整一覧',
      description: scheduleList,
      color: EMBED_COLORS.INFO,
      footer: {
        text:
          schedules.length > 10
            ? `他に${schedules.length - 10}件あります`
            : `合計 ${schedules.length}件`,
      },
    };
  }
}

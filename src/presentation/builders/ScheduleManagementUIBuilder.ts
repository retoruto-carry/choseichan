/**
 * Schedule Management UI Builder
 *
 * スケジュール管理のUI構築専用クラス
 */

import type { APIEmbed } from 'discord-api-types/v10';
import type { ScheduleResponse, ScheduleSummaryResponse } from '../../application/dto/ScheduleDto';
import { createButtonId } from '../../utils/id';
import { EMBED_COLORS, STATUS_EMOJI } from '../constants/ui';
import { formatDateTime } from '../utils/date-formatter';

export class ScheduleManagementUIBuilder {
  /**
   * 詳細なスケジュール表示用のEmbedを作成（旧形式）
   */
  createDetailedScheduleEmbed(summary: ScheduleSummaryResponse, showDetails: boolean = false) {
    const { schedule, responses, responseCounts } = summary;
    const fields: APIEmbed['fields'] = [];

    // 締切と回答者数を最初に表示
    let headerText = '';
    if (schedule.deadline) {
      headerText += `⏰ 締切: ${formatDateTime(schedule.deadline)}\n`;
    }
    if (responses.length > 0) {
      headerText += `回答者: ${responses.length}人`;
    }

    // 日程候補と集計
    schedule.dates.forEach((date, index) => {
      const dateStr = formatDateTime(date.datetime);
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
            const comment = '';
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
   * スケジュール用のコンポーネントを作成（旧形式）
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

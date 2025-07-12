/**
 * Schedule Edit UI Builder
 *
 * スケジュール編集のUI構築専用クラス
 */

import type { ScheduleResponse } from '../../application/dto/ScheduleDto';
import { createButtonId } from '../../utils/id';

export class ScheduleEditUIBuilder {
  /**
   * 基本情報編集モーダルを作成
   */
  createEditInfoModal(schedule: ScheduleResponse, messageId: string) {
    return {
      custom_id: `modal:edit_info:${schedule.id}:${messageId}`,
      title: '日程調整の編集',
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: 'title',
              label: 'タイトル',
              style: 1,
              value: schedule.title,
              required: true,
              min_length: 1,
              max_length: 100,
            },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: 'description',
              label: '説明',
              style: 2,
              value: schedule.description || '',
              required: false,
              max_length: 500,
            },
          ],
        },
      ],
    };
  }

  /**
   * 日程更新モーダルを作成
   */
  createUpdateDatesModal(schedule: ScheduleResponse, messageId: string) {
    // 現在の日程を整形して表示
    const currentDates = schedule.dates.map((date) => date.datetime).join('\n');

    return {
      custom_id: `modal:update_dates:${schedule.id}:${messageId}`,
      title: '日程を編集',
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: 'dates',
              label: '候補（1行に1つずつ）',
              style: 2,
              value: currentDates,
              placeholder: '例:\n4/1 (月) 19:00\n4/2 (火) 20:00\n4/3 (水) 19:00',
              required: true,
              min_length: 1,
              max_length: 1000,
            },
          ],
        },
      ],
    };
  }

  /**
   * 日程追加モーダルを作成
   */
  createAddDatesModal(scheduleId: string) {
    return {
      custom_id: `modal:add_dates:${scheduleId}`,
      title: '日程を追加',
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: 'dates',
              label: '追加する日程候補（1行に1つずつ）',
              style: 2,
              placeholder: '例:\n4/4 (木) 19:00\n4/5 (金) 20:00',
              required: true,
              min_length: 1,
              max_length: 1000,
            },
          ],
        },
      ],
    };
  }

  /**
   * 日程削除選択コンポーネントを作成
   */
  createRemoveDatesComponents(schedule: ScheduleResponse) {
    return schedule.dates.map((date, idx) => ({
      type: 1,
      components: [
        {
          type: 2,
          style: 4, // Danger
          label: `${idx + 1}. ${date.datetime}`,
          custom_id: createButtonId('confirm_remove_date', schedule.id, date.id),
          emoji: { name: '🗑️' },
        },
      ],
    }));
  }

  /**
   * 締切編集モーダルを作成
   */
  createEditDeadlineModal(schedule: ScheduleResponse, messageId: string) {
    // Format current deadline for display
    const currentDeadline = schedule.deadline
      ? new Date(schedule.deadline)
          .toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
          .replace(/\//g, '-')
      : '';

    // Current reminder settings
    const currentTimings = schedule.reminderTimings?.join(', ') || '3d, 1d, 8h';
    const currentMentions = schedule.reminderMentions?.join(', ') || '@here';

    return {
      custom_id: `modal:edit_deadline:${schedule.id}:${messageId}`,
      title: '締切日を編集',
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: 'deadline',
              label: '締切日時（空白で無期限）',
              style: 1,
              value: currentDeadline,
              placeholder: '例: 2025/12/24 19:00',
              required: false,
              max_length: 50,
            },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: 'reminder_timings',
              label: 'リマインダー（カンマ区切り）',
              style: 1,
              value: currentTimings,
              placeholder: '例: 3d, 1d, 8h',
              required: false,
              max_length: 100,
            },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: 'reminder_mentions',
              label: '通知先（カンマ区切りで複数指定可）',
              style: 1,
              value: currentMentions,
              placeholder: '例: @everyone, @here, @Alice, @Bob',
              required: false,
              max_length: 200,
            },
          ],
        },
      ],
    };
  }

  /**
   * リマインダー編集モーダルを作成
   */
  createEditReminderModal(schedule: ScheduleResponse) {
    // Current reminder settings
    const currentTimings = schedule.reminderTimings?.join(', ') || '3d, 1d, 8h';
    const currentMentions = schedule.reminderMentions?.join(', ') || '@here';

    return {
      custom_id: `modal:edit_reminder:${schedule.id}`,
      title: 'リマインダーの編集',
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: 'reminder_timings',
              label: 'リマインダー（カンマ区切り）',
              style: 1,
              value: currentTimings,
              placeholder: '例: 3d, 1d, 8h',
              required: false,
              max_length: 100,
            },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: 'reminder_mentions',
              label: '通知先（カンマ区切りで複数指定可）',
              style: 1,
              value: currentMentions,
              placeholder: '例: @everyone, @here, @Alice, @Bob',
              required: false,
              max_length: 200,
            },
          ],
        },
      ],
    };
  }
}

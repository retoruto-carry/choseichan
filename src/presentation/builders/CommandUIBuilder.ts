/**
 * Command UI Builder
 *
 * コマンド関連のUI構築専用クラス
 */

import type { ScheduleResponse } from '../../application/dto/ScheduleDto';
import { formatDate } from '../../utils/date';
import { EMBED_COLORS } from '../constants/ui';

export class CommandUIBuilder {
  /**
   * スケジュール作成モーダルを作成
   */
  createScheduleCreationModal() {
    return {
      custom_id: 'modal:create_schedule',
      title: '日程調整を作成',
      components: [
        {
          type: 1, // Action Row
          components: [
            {
              type: 4, // Text Input
              custom_id: 'title',
              label: 'タイトル',
              style: 1, // Short
              placeholder: '例: 忘年会',
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
              label: '説明（任意）',
              style: 2, // Paragraph
              placeholder: '例: 今年の忘年会の日程を決めます',
              required: false,
              max_length: 500,
            },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: 'dates',
              label: '候補（1行に1つずつ）',
              style: 2, // Paragraph
              placeholder: '12/25 19:00\n12/26(土) 18:00〜20:00',
              required: true,
              min_length: 1,
              max_length: 1000,
            },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: 'deadline',
              label: '締切（任意）',
              style: 1, // Short
              placeholder: '例: 2025/12/20 23:59',
              required: false,
              max_length: 50,
            },
          ],
        },
      ],
    };
  }

  /**
   * スケジュール一覧エンベッドを作成
   */
  createScheduleListEmbed(schedules: ScheduleResponse[]) {
    return {
      title: '📋 日程調整一覧',
      color: EMBED_COLORS.INFO,
      fields: schedules.slice(0, 10).map((schedule) => ({
        name: `${schedule.status === 'open' ? '🟢' : '🔴'} ${schedule.title}`,
        value: `ID: ${schedule.id}\n作成者: ${schedule.createdBy?.username || 'Unknown'}\n作成日: ${formatDate(schedule.createdAt)}`,
        inline: false,
      })),
      footer: {
        text: schedules.length > 10 ? `他 ${schedules.length - 10} 件` : '',
      },
    };
  }
}

/**
 * スケジュールUIビルダー
 *
 * スケジュール表示用のDiscord UIを構築
 * ビジネスロジックから分離されたプレゼンテーション層
 */

import type {
  APIActionRowComponent,
  APIButtonComponent,
  APIEmbed,
  APISelectMenuComponent,
} from 'discord-api-types/v10';
import type { ResponseDto } from '../../application/dto/ResponseDto';
import type { ScheduleResponse } from '../../application/dto/ScheduleDto';

export interface ScheduleDisplayOptions {
  showVoteButtons?: boolean;
  showEditButtons?: boolean;
  showCloseButton?: boolean;
  showDeleteButton?: boolean;
  isOwnerView?: boolean;
  currentUserId?: string;
}

export class ScheduleUIBuilder {
  /**
   * スケジュール表示用のメインEmbed構築
   */
  static buildScheduleEmbed(
    schedule: ScheduleResponse,
    responseCounts?: Record<string, { yes: number; maybe: number; no: number }>,
    _options: ScheduleDisplayOptions = {}
  ): APIEmbed {
    const fields: APIEmbed['fields'] = [];

    // 締切と回答者数を最初に表示
    let headerText = '';
    if (schedule.deadline) {
      const deadline = new Date(schedule.deadline);
      headerText += `⏰ 締切: ${ScheduleUIBuilder.formatDateTime(deadline)}\n`;
    }
    if (schedule.totalResponses > 0) {
      headerText += `回答者: ${schedule.totalResponses}人`;
    }

    // 日程候補と集計
    schedule.dates.forEach((date, index) => {
      const dateStr = date.datetime;
      let fieldValue = '';

      if (responseCounts?.[date.id]) {
        const counts = responseCounts[date.id];
        fieldValue = `集計: ✅ ${counts.yes}人 ❔ ${counts.maybe}人 ❌ ${counts.no}人`;
      } else {
        fieldValue = '集計: まだ回答がありません';
      }

      fields.push({
        name: `${index + 1}. ${dateStr}`,
        value: fieldValue,
        inline: false,
      });
    });

    // ステータスによる色
    const isOpen = schedule.status === 'open';
    const color = isOpen ? 0x00ff00 : 0xff0000; // 緑 or 赤

    return {
      title: `📅 ${schedule.title}`,
      description: headerText || schedule.description || undefined,
      color,
      fields,
      footer: {
        text: `ID: ${schedule.id}`,
      },
    };
  }

  /**
   * 日程選択用のSelectMenu構築
   */
  static buildDateSelectMenu(schedule: ScheduleResponse, customId: string): APISelectMenuComponent {
    const options = schedule.dates.map((date, index) => {
      return {
        label: `${index + 1}. ${date.datetime}`,
        value: date.id,
        description: date.datetime,
      };
    });

    return {
      type: 3, // SELECT_MENU
      custom_id: customId,
      placeholder: '参加可能な日程を選択してください',
      min_values: 0,
      max_values: options.length,
      options,
    };
  }

  /**
   * アクションボタン群構築
   */
  static buildActionButtons(
    schedule: ScheduleResponse,
    options: ScheduleDisplayOptions = {}
  ): APIActionRowComponent<APIButtonComponent>[] {
    const rows: APIActionRowComponent<APIButtonComponent>[] = [];

    // 投票ボタン行
    if (options.showVoteButtons && schedule.status === 'open') {
      const buttons = [
        {
          type: 2, // BUTTON
          style: 3, // SUCCESS (緑)
          label: '回答する',
          custom_id: `respond:${schedule.id}`,
          emoji: { name: '🗳️' },
        },
      ];

      // 詳細/簡易表示切り替えボタン
      const showDetails = options.currentUserId !== undefined;
      buttons.push({
        type: 2, // BUTTON
        style: 2, // SECONDARY
        label: showDetails ? '簡易表示' : '詳細',
        custom_id: showDetails ? `hide_details:${schedule.id}` : `status:${schedule.id}`,
        emoji: { name: showDetails ? '📊' : '📋' },
      });

      // 更新ボタン
      buttons.push({
        type: 2, // BUTTON
        style: 2, // SECONDARY
        label: '更新',
        custom_id: `refresh:${schedule.id}`,
        emoji: { name: '🔄' },
      });

      rows.push({
        type: 1, // ACTION_ROW
        components: buttons,
      });
    }

    // 管理ボタン行
    if (options.isOwnerView || options.showEditButtons) {
      const adminButtons: APIButtonComponent[] = [];

      if (options.showEditButtons) {
        adminButtons.push({
          type: 2, // BUTTON
          style: 2, // SECONDARY
          label: '編集',
          custom_id: `edit:${schedule.id}`,
          emoji: { name: '✏️' },
        });
      }

      if (options.showCloseButton && schedule.status === 'open') {
        adminButtons.push({
          type: 2, // BUTTON
          style: 1, // PRIMARY (青)
          label: '締切',
          custom_id: `close:${schedule.id}`,
          emoji: { name: '🔒' },
        });
      }

      if (options.showDeleteButton) {
        adminButtons.push({
          type: 2, // BUTTON
          style: 4, // DANGER (赤)
          label: '削除',
          custom_id: `delete:${schedule.id}`,
          emoji: { name: '🗑️' },
        });
      }

      if (adminButtons.length > 0) {
        rows.push({
          type: 1, // ACTION_ROW
          components: adminButtons,
        });
      }
    }

    return rows;
  }

  /**
   * 回答一覧Embed構築
   */
  static buildResponseListEmbed(schedule: ScheduleResponse, responses: ResponseDto[]): APIEmbed {
    if (responses.length === 0) {
      return {
        title: '📊 回答一覧',
        description: 'まだ回答がありません',
        color: 0x808080, // グレー
      };
    }

    const fields: APIEmbed['fields'] = [];

    // 各ユーザーの回答
    responses.forEach((response) => {
      const userName = response.displayName || response.username;
      let responseText = '';

      schedule.dates.forEach((date, index) => {
        const status = response.dateStatuses[date.id];
        const statusEmoji = ScheduleUIBuilder.getStatusEmoji(status);
        responseText += `${index + 1}. ${statusEmoji}\n`;
      });

      fields.push({
        name: `👤 ${userName}`,
        value: responseText || '回答なし',
        inline: true,
      });
    });

    return {
      title: '📊 回答一覧',
      description: `${responses.length} 人が回答しています`,
      color: 0x0099ff, // 青
      fields,
    };
  }

  /**
   * 日時フォーマット（詳細）
   */
  private static formatDateTime(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const dayOfWeek = days[dateObj.getDay()];
    return `${dateObj.getMonth() + 1}/${dateObj.getDate()}(${dayOfWeek}) ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
  }

  /**
   * 日時フォーマット（短縮）
   */
  private static formatDateTimeShort(date: Date): string {
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  /**
   * ステータス絵文字取得
   */
  private static getStatusEmoji(status: 'ok' | 'maybe' | 'ng' | undefined): string {
    switch (status) {
      case 'ok':
        return '✅';
      case 'maybe':
        return '❔';
      case 'ng':
        return '❌';
      default:
        return '➖';
    }
  }
}

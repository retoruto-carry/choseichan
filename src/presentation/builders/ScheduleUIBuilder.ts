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

    // 日程候補フィールド
    if (schedule.dates.length > 0) {
      let datesValue = '';

      schedule.dates.forEach((date, index) => {
        const dateTime = new Date(date.datetime);
        const dateStr = ScheduleUIBuilder.formatDateTime(dateTime);

        if (responseCounts?.[date.id]) {
          const counts = responseCounts[date.id];
          const total = counts.yes + counts.maybe + counts.no;
          const yesPercent = total > 0 ? Math.round((counts.yes / total) * 100) : 0;
          datesValue += `**${index + 1}.** ${dateStr}\n`;
          datesValue += `　✅ ${counts.yes} 票 (${yesPercent}%) ❔ ${counts.maybe} 票 ❌ ${counts.no} 票\n\n`;
        } else {
          datesValue += `**${index + 1}.** ${dateStr}\n\n`;
        }
      });

      fields.push({
        name: '📅 日程候補',
        value: datesValue || '日程が設定されていません',
        inline: false,
      });
    }

    // 締切日時
    if (schedule.deadline) {
      const deadline = new Date(schedule.deadline);
      fields.push({
        name: '⏰ 回答期限',
        value: ScheduleUIBuilder.formatDateTime(deadline),
        inline: true,
      });
    }

    // 作成者
    const authorName = schedule.createdBy.displayName || schedule.createdBy.username;
    fields.push({
      name: '👤 作成者',
      value: authorName,
      inline: true,
    });

    // 回答状況
    if (schedule.totalResponses > 0) {
      fields.push({
        name: '📊 回答数',
        value: `${schedule.totalResponses} 人が回答済み`,
        inline: true,
      });
    }

    // 説明（存在する場合）
    if (schedule.description) {
      fields.push({
        name: '📝 説明',
        value: schedule.description,
        inline: false,
      });
    }

    // ステータスによる色とフッター
    const isOpen = schedule.status === 'open';
    const color = isOpen ? 0x00ff00 : 0xff0000; // 緑 or 赤
    const statusText = isOpen ? '募集中' : '締切済み';

    return {
      title: `📋 ${schedule.title}`,
      description: `ステータス: **${statusText}**`,
      color,
      fields,
      footer: {
        text: `作成日: ${ScheduleUIBuilder.formatDateTime(new Date(schedule.createdAt))}`,
      },
      timestamp: new Date(schedule.updatedAt).toISOString(),
    };
  }

  /**
   * 日程選択用のSelectMenu構築
   */
  static buildDateSelectMenu(schedule: ScheduleResponse, customId: string): APISelectMenuComponent {
    const options = schedule.dates.map((date, index) => {
      const dateTime = new Date(date.datetime);
      return {
        label: `${index + 1}. ${ScheduleUIBuilder.formatDateTimeShort(dateTime)}`,
        value: date.id,
        description: ScheduleUIBuilder.formatDateTime(dateTime),
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
      rows.push({
        type: 1, // ACTION_ROW
        components: [
          {
            type: 2, // BUTTON
            style: 3, // SUCCESS (緑)
            label: '投票する',
            custom_id: `vote:${schedule.id}`,
            emoji: { name: '🗳️' },
          },
        ],
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
  private static formatDateTime(date: Date): string {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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

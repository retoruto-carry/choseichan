/**
 * Response UI Builder
 *
 * レスポンス表示用のDiscord UIを構築
 * 投票UI、回答確認UI、統計表示UIなど
 */

import type {
  APIActionRowComponent,
  APIButtonComponent,
  APIEmbed,
  APIModalInteractionResponseCallbackData,
} from 'discord-api-types/v10';
import type { ResponseDto, ResponseStatistics } from '../../application/dto/ResponseDto';
import type { ScheduleResponse } from '../../application/dto/ScheduleDto';

export class ResponseUIBuilder {
  /**
   * 投票確認Embed構築
   */
  static buildVoteConfirmationEmbed(
    schedule: ScheduleResponse,
    userResponse?: ResponseDto
  ): APIEmbed {
    const fields: APIEmbed['fields'] = [];

    // 現在の回答状況
    if (userResponse) {
      let currentVote = '';
      schedule.dates.forEach((date, index) => {
        const status = userResponse.dateStatuses[date.id];
        const statusEmoji = ResponseUIBuilder.getStatusEmoji(status);
        currentVote += `${index + 1}. ${date.datetime} ${statusEmoji}\n`;
      });

      fields.push({
        name: '📋 現在の回答',
        value: currentVote,
        inline: false,
      });
    }

    // 投票方法の説明
    fields.push({
      name: '📝 投票方法',
      value: '下記のメニューから参加可能な日程を選択してください。\n複数選択可能です。',
      inline: false,
    });

    return {
      title: `🗳️ ${schedule.title} への投票`,
      color: 0x00ff00,
      fields,
      footer: {
        text: '投票は何度でも変更できます',
      },
    };
  }

  /**
   * 投票結果Embed構築
   */
  static buildVoteResultEmbed(
    schedule: ScheduleResponse,
    submittedResponse: ResponseDto,
    isNewResponse: boolean
  ): APIEmbed {
    const userName = submittedResponse.displayName || submittedResponse.username;
    const actionText = isNewResponse ? '投票しました' : '投票を更新しました';

    let responseText = '';
    schedule.dates.forEach((date, index) => {
      const status = submittedResponse.dateStatuses[date.id];
      const statusEmoji = ResponseUIBuilder.getStatusEmoji(status);
      responseText += `${index + 1}. ${date.datetime} ${statusEmoji}\n`;
    });

    const fields: APIEmbed['fields'] = [
      {
        name: '📋 投票内容',
        value: responseText,
        inline: false,
      },
    ];

    return {
      title: `✅ ${actionText}`,
      description: `**${userName}** さんの投票を受け付けました`,
      color: 0x00ff00,
      fields,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 投票統計Embed構築
   */
  static buildVoteStatisticsEmbed(
    schedule: ScheduleResponse,
    statistics: ResponseStatistics
  ): APIEmbed {
    const fields: APIEmbed['fields'] = [];

    // 各日程の統計
    schedule.dates.forEach((date, index) => {
      const stats = statistics.responsesByDate[date.id];
      if (stats) {
        const total = stats.total;

        let statText = '';
        if (total > 0) {
          statText += `✅ ${stats.yes} 票 (${stats.percentage.yes}%)\n`;
          statText += `❔ ${stats.maybe} 票 (${stats.percentage.maybe}%)\n`;
          statText += `❌ ${stats.no} 票 (${stats.percentage.no}%)\n`;
          statText += `合計: ${total} 票`;
        } else {
          statText = '投票なし';
        }

        fields.push({
          name: `${index + 1}. ${date.datetime}`,
          value: statText,
          inline: true,
        });
      }
    });

    // 全体の参加状況
    const overall = statistics.overallParticipation;
    const overallText = `
🎯 全日程参加可能: ${overall.fullyAvailable} 人
🔶 部分的に参加可能: ${overall.partiallyAvailable} 人
❌ 参加不可: ${overall.unavailable} 人
📊 回答者数: ${statistics.totalUsers} 人
    `.trim();

    fields.push({
      name: '📈 全体の参加状況',
      value: overallText,
      inline: false,
    });

    // 最適な日程
    if (statistics.optimalDates.optimalDateId) {
      const optimalDate = schedule.dates.find(
        (d) => d.id === statistics.optimalDates.optimalDateId
      );
      if (optimalDate) {
        const optimalScore = statistics.optimalDates.scores[statistics.optimalDates.optimalDateId];
        fields.push({
          name: '🏆 最適な日程',
          value: `${optimalDate.datetime}\nスコア: ${optimalScore} ポイント`,
          inline: false,
        });
      }
    }

    return {
      title: `📊 ${schedule.title} - 投票統計`,
      color: 0x0099ff,
      fields,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 投票用アクションボタン構築
   */
  static buildVoteActionButtons(scheduleId: string): APIActionRowComponent<APIButtonComponent>[] {
    return [
      {
        type: 1, // ACTION_ROW
        components: [
          {
            type: 2, // BUTTON
            style: 3, // SUCCESS
            label: '投票を確定',
            custom_id: `vote_submit:${scheduleId}`,
            emoji: { name: '✅' },
          },
          {
            type: 2, // BUTTON
            style: 4, // DANGER
            label: 'キャンセル',
            custom_id: `vote_cancel:${scheduleId}`,
            emoji: { name: '❌' },
          },
        ],
      },
    ];
  }

  /**
   * コメント入力モーダル構築
   */
  static buildCommentModal(
    scheduleId: string,
    currentComment?: string
  ): APIModalInteractionResponseCallbackData {
    return {
      title: 'コメント入力',
      custom_id: `comment_modal:${scheduleId}`,
      components: [
        {
          type: 1, // ACTION_ROW
          components: [
            {
              type: 4, // TEXT_INPUT
              custom_id: 'comment_text',
              label: 'コメント（任意）',
              style: 2, // PARAGRAPH
              required: false,
              max_length: 500,
              placeholder: '自由にコメントを入力してください...',
              value: currentComment,
            },
          ],
        },
      ],
    };
  }

  /**
   * エラーEmbed構築
   */
  static buildErrorEmbed(title: string, errors: string[], _isEphemeral: boolean = true): APIEmbed {
    return {
      title: `❌ ${title}`,
      description: errors.join('\n'),
      color: 0xff0000,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 成功Embed構築
   */
  static buildSuccessEmbed(title: string, description: string): APIEmbed {
    return {
      title: `✅ ${title}`,
      description,
      color: 0x00ff00,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 日時フォーマット
   */
  private static formatDateTime(date: Date): string {
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

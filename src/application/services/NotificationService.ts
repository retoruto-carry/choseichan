/**
 * Notification Service - Clean Architecture Version
 *
 * 通知サービスのClean Architecture実装
 * 締切リマインダーと自動締切通知を管理します
 */

import type { Schedule } from '../../domain/entities/Schedule';
import type {
  IResponseRepository,
  IScheduleRepository,
} from '../../domain/repositories/interfaces';
import { formatDate } from '../../utils/date';
import type { ScheduleResponse, ScheduleSummaryResponse } from '../dto/ScheduleDto';
import type { BackgroundExecutorPort } from '../ports/BackgroundExecutorPort';
import type { IDiscordApiPort } from '../ports/DiscordApiPort';
import type { ILogger } from '../ports/LoggerPort';
import type { GetScheduleSummaryUseCase } from '../usecases/schedule/GetScheduleSummaryUseCase';

interface DiscordMessage {
  content: string;
  embeds?: object[];
  message_reference?: {
    message_id: string;
  };
}

const _STATUS_EMOJI = {
  open: '🟢',
  closed: '🔴',
};

export class NotificationService {
  private memberCache: Map<string, Map<string, { id: string; username: string }>> = new Map();

  constructor(
    private logger: ILogger,
    private discordApi: IDiscordApiPort,
    private scheduleRepository: IScheduleRepository,
    private responseRepository: IResponseRepository,
    private getScheduleSummaryUseCase: GetScheduleSummaryUseCase,
    private discordToken: string,
    private applicationId: string,
    private backgroundExecutor: BackgroundExecutorPort
  ) {}

  async checkAndSendNotifications(): Promise<void> {
    // このメソッドは現在使用されていません
    // 通知はGitHub Actionsから呼び出されるdeadline-reminder.tsモジュールで処理されます
    const schedules = await this.getSchedulesNearingDeadline();

    for (const schedule of schedules) {
      if (!schedule.notificationSent && schedule.deadline) {
        await this.sendDeadlineReminder(schedule);
      }
    }
  }

  private async getSchedulesNearingDeadline(): Promise<Schedule[]> {
    // このメソッドは現在使用されていません
    // 締切チェックはdeadline-reminder.tsで処理されます
    return [];
  }

  async sendDeadlineReminder(
    schedule: Schedule | ScheduleResponse,
    customMessage: string = '締切が1時間以内'
  ): Promise<void> {
    if (!schedule.deadline) return;

    const deadlineDate =
      schedule.deadline instanceof Date ? schedule.deadline : new Date(schedule.deadline);

    // メンション文字列を構築
    let mentions = '';
    if (schedule.reminderMentions && schedule.reminderMentions.length > 0 && schedule.guildId) {
      // ユーザーメンションを適切なDiscord形式に解決
      const resolvedMentions = await this.resolveUserMentions(
        schedule.reminderMentions,
        schedule.guildId
      );
      mentions = `${resolvedMentions.join(' ')} `;
    }

    // チャンネルにリマインダーを送信
    const message = {
      content: `${mentions}⏰ **締切リマインダー**: 「${schedule.title}」の${customMessage}です！`,
      embeds: [
        {
          color: 0xffcc00,
          fields: [
            {
              name: '締切時刻',
              value: deadlineDate.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
              inline: true,
            },
            {
              name: '現在の回答者数',
              value: `${schedule.totalResponses || 0}人`,
              inline: true,
            },
          ],
          footer: {
            text: 'まだ回答していない方は早めに回答をお願いします！',
          },
        },
      ],
      message_reference: {
        message_id: schedule.messageId,
      },
    };

    await this.sendChannelMessage(schedule.channelId, message);
  }

  private async getNonRespondents(_summary: ScheduleSummaryResponse): Promise<string[]> {
    // 実際の実装では、チャンネルメンバーを取得し
    // 回答者と比較します
    return [];
  }

  private createReminderMessage(
    schedule: Schedule | ScheduleResponse,
    nonRespondents: string[]
  ): object {
    // 締切が設定されていない場合は早期リターン
    if (!schedule.deadline) {
      return {
        content: `⏰ **リマインダー**: 日程調整「${schedule.title}」の締切が近づいています！`,
        embeds: [
          {
            title: '📅 未回答の方はご回答をお願いします',
            color: 0xf39c12,
            fields: [
              {
                name: '日程調整',
                value: schedule.title,
                inline: true,
              },
              {
                name: '締切',
                value: '未設定',
                inline: true,
              },
              {
                name: '未回答者',
                value: nonRespondents.join(', ') || 'なし',
                inline: false,
              },
            ],
            footer: {
              text: `ID: ${schedule.id}`,
            },
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }

    const deadline =
      schedule.deadline instanceof Date ? schedule.deadline : new Date(schedule.deadline);
    return {
      content: `⏰ **リマインダー**: 日程調整「${schedule.title}」の締切が近づいています！`,
      embeds: [
        {
          title: '📅 未回答の方はご回答をお願いします',
          color: 0xf39c12, // 警告色
          fields: [
            {
              name: '日程調整',
              value: schedule.title,
              inline: true,
            },
            {
              name: '締切',
              value: schedule.deadline ? formatDate(deadline.toISOString()) : '未設定',
              inline: true,
            },
            {
              name: '未回答者',
              value: nonRespondents.join(', ') || 'なし',
              inline: false,
            },
          ],
          footer: {
            text: `ID: ${schedule.id}`,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  private async sendChannelMessage(channelId: string, message: object): Promise<void> {
    await this.discordApi.sendMessage(channelId, message, this.discordToken);
  }

  private async fetchGuildMembers(
    guildId: string
  ): Promise<Map<string, { id: string; username: string }>> {
    const cachedMembers = this.memberCache.get(guildId);
    if (cachedMembers) {
      return cachedMembers;
    }

    const members = new Map<string, { id: string; username: string }>();

    try {
      const memberList = await this.discordApi.fetchGuildMembers(guildId, this.discordToken);

      for (const member of memberList) {
        members.set(member.user.username.toLowerCase(), {
          id: member.user.id,
          username: member.user.username,
        });
      }

      // 5分間キャッシュ（Workers環境ではTTLベースキャッシュを推奨）
      this.memberCache.set(guildId, members);
      // setTimeout は Cloudflare Workers で使用不可のため、
      // TTLベースのキャッシュまたは Durable Objects を使用することを推奨

      return members;
    } catch (error) {
      this.logger.error(
        'Error fetching guild members',
        error instanceof Error ? error : new Error(String(error))
      );
      return members;
    }
  }

  private async resolveUserMentions(mentions: string[], guildId: string): Promise<string[]> {
    const resolved: string[] = [];

    // メンバーを取得する必要があるかチェック
    const needsResolution = mentions.some(
      (m) => m !== '@everyone' && m !== '@here' && !(m.startsWith('<@') && m.endsWith('>'))
    );

    if (!needsResolution) {
      return mentions;
    }

    const members = await this.fetchGuildMembers(guildId);

    for (const mention of mentions) {
      if (mention === '@everyone' || mention === '@here') {
        resolved.push(mention);
      } else if (mention.startsWith('<@') && mention.endsWith('>')) {
        resolved.push(mention); // すでに正しい形式
      } else if (mention.startsWith('@')) {
        // @プレフィックスを削除してユーザー名を検索
        const username = mention.substring(1).toLowerCase();
        const member = members.get(username);

        if (member) {
          resolved.push(`<@${member.id}>`);
        } else {
          this.logger.warn(`Could not resolve user mention: ${mention}`);
          // フォールバックとして元のメンションを保持
          resolved.push(mention);
        }
      } else {
        // @プレフィックスなしで試す
        const member = members.get(mention.toLowerCase());
        if (member) {
          resolved.push(`<@${member.id}>`);
        } else {
          resolved.push(mention);
        }
      }
    }

    return resolved;
  }

  async sendSummaryMessage(scheduleId: string, guildId: string = 'default'): Promise<void> {
    const summaryResult = await this.getScheduleSummaryUseCase.execute(scheduleId, guildId);
    if (!summaryResult.success || !summaryResult.summary) return;

    const summary = summaryResult.summary;
    const { schedule, responses, responseCounts, bestDateId } = summary;

    // リマインダー設定からメンションを追加（利用可能な場合）
    let mentionText = '';
    if (schedule.reminderMentions && schedule.reminderMentions.length > 0 && schedule.guildId) {
      const resolvedMentions = await this.resolveUserMentions(
        schedule.reminderMentions,
        schedule.guildId
      );
      mentionText = `${resolvedMentions.join(' ')} `;
    }

    const message = {
      content: `${mentionText}**📅 日程調整「${schedule.title}」が締め切られました！**`,
      embeds: [
        {
          title: '📊 集計結果',
          color: 0x2ecc71,
          description: schedule.description || undefined,
          fields: [
            {
              name: '基本情報',
              value: [
                `参加者数: ${responses.length}人`,
                `作成者: ${schedule.createdBy.username}`,
                `作成日: ${new Date(schedule.createdAt).toLocaleDateString('ja-JP')}`,
              ].join('\n'),
              inline: false,
            },
            ...schedule.dates.map((date) => {
              const count = responseCounts[date.id];
              const isBest = date.id === bestDateId && responses.length > 0;

              // この日付のユーザー名付き回答を取得
              const dateResponses = responses
                .map((response) => {
                  const status = response.dateStatuses[date.id];
                  if (!status) return null;
                  const statusEmoji = status === 'ok' ? '○' : status === 'maybe' ? '△' : '×';
                  return `${statusEmoji} ${response.username}`;
                })
                .filter(Boolean);

              return {
                name: `${isBest ? '⭐ ' : ''}${date.datetime}`,
                value: [
                  `集計: ○ ${count.yes}人 △ ${count.maybe}人 × ${count.no}人`,
                  dateResponses.length > 0 ? dateResponses.join(', ') : '回答なし',
                ].join('\n'),
                inline: false,
              };
            }),
          ],
          footer: {
            text: bestDateId ? '⭐ は最有力候補です' : `回答者: ${responses.length}人`,
          },
        },
      ],
    };

    await this.sendChannelMessage(schedule.channelId, message);
  }

  sendPRMessage(schedule: Schedule | ScheduleResponse): void {
    const message: DiscordMessage = {
      content: `[PR] 画像を貼るだけでリンク集/個人HPを作ろう！[ピクページ](https://piku.page/)\n\n> 調整ちゃんは無料で運営されています`,
    };

    // messageIdが存在する場合はメッセージ参照を追加
    if (schedule.messageId) {
      message.message_reference = {
        message_id: schedule.messageId,
      };
    }

    // バックグラウンドで送信
    this.backgroundExecutor.execute(async () => {
      await this.sendChannelMessage(schedule.channelId, message);
    });
  }
}

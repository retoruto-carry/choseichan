/**
 * Notification Service - Clean Architecture Version
 *
 * 通知サービスのClean Architecture実装
 * 締切リマインダーと自動締切通知を管理します
 */

import { NOTIFICATION_CONSTANTS } from '../../constants/ApplicationConstants';
import type { Schedule } from '../../domain/entities/Schedule';
import type {
  IResponseRepository,
  IScheduleRepository,
} from '../../domain/repositories/interfaces';
import { getLogger } from '../../infrastructure/logging/Logger';
import type { DiscordMessage } from '../../infrastructure/types/discord-api';
import { formatDate } from '../../utils/date';
import type { ScheduleResponse, ScheduleSummaryResponse } from '../dto/ScheduleDto';
import type { GetScheduleSummaryUseCase } from '../usecases/schedule/GetScheduleSummaryUseCase';

const _STATUS_EMOJI = {
  open: '🟢',
  closed: '🔴',
};

export class NotificationService {
  private readonly logger = getLogger();
  private memberCache: Map<string, Map<string, { id: string; username: string }>> = new Map();

  constructor(
    private scheduleRepository: IScheduleRepository,
    private responseRepository: IResponseRepository,
    private getScheduleSummaryUseCase: GetScheduleSummaryUseCase,
    private discordToken: string,
    private applicationId: string
  ) {}

  async checkAndSendNotifications(): Promise<void> {
    // This method is currently not used, as notifications are handled
    // by the deadline-reminder.ts module called from GitHub Actions
    const schedules = await this.getSchedulesNearingDeadline();

    for (const schedule of schedules) {
      if (!schedule.notificationSent && schedule.deadline) {
        await this.sendDeadlineReminder(schedule);
      }
    }
  }

  private async getSchedulesNearingDeadline(): Promise<Schedule[]> {
    // This method is not currently used
    // Deadline checking is handled by deadline-reminder.ts
    return [];
  }

  async sendDeadlineReminder(
    schedule: Schedule | ScheduleResponse,
    customMessage: string = '締切が1時間以内'
  ): Promise<void> {
    if (!schedule.deadline) return;

    const deadlineDate =
      schedule.deadline instanceof Date ? schedule.deadline : new Date(schedule.deadline);

    // Build mentions string
    let mentions = '';
    if (schedule.reminderMentions && schedule.reminderMentions.length > 0 && schedule.guildId) {
      // Resolve user mentions to proper Discord format
      const resolvedMentions = await this.resolveUserMentions(
        schedule.reminderMentions,
        schedule.guildId
      );
      mentions = `${resolvedMentions.join(' ')} `;
    }

    // Send reminder to channel
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
    // In a real implementation, this would get channel members
    // and compare with respondents
    return [];
  }

  private createReminderMessage(
    schedule: Schedule | ScheduleResponse,
    nonRespondents: string[]
  ): object {
    const deadline =
      schedule.deadline instanceof Date ? schedule.deadline : new Date(schedule.deadline!);
    return {
      content: `⏰ **リマインダー**: 日程調整「${schedule.title}」の締切が近づいています！`,
      embeds: [
        {
          title: '📅 未回答の方はご回答をお願いします',
          color: 0xf39c12, // Warning color
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
    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${this.discordToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`);
    }
  }

  private async fetchGuildMembers(
    guildId: string
  ): Promise<Map<string, { id: string; username: string }>> {
    if (this.memberCache.has(guildId)) {
      return this.memberCache.get(guildId)!;
    }

    const members = new Map<string, { id: string; username: string }>();
    let after: string | undefined;

    try {
      // Discord API allows fetching up to 1000 members at a time
      while (true) {
        const url = `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000${after ? `&after=${after}` : ''}`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Bot ${this.discordToken}`,
          },
        });

        if (!response.ok) {
          this.logger.error(`Failed to fetch guild members: ${response.status}`, new Error(`HTTP ${response.status}: Failed to fetch guild members`));
          break;
        }

        const memberList = (await response.json()) as Array<{
          user: { id: string; username: string; discriminator: string };
        }>;

        if (memberList.length === 0) break;

        for (const member of memberList) {
          members.set(member.user.username.toLowerCase(), {
            id: member.user.id,
            username: member.user.username,
          });
        }

        if (memberList.length < 1000) break;
        after = memberList[memberList.length - 1].user.id;
      }

      // Cache for 5 minutes
      this.memberCache.set(guildId, members);
      setTimeout(() => this.memberCache.delete(guildId), 5 * 60 * 1000);

      return members;
    } catch (error) {
      this.logger.error('Error fetching guild members', error instanceof Error ? error : new Error(String(error)));
      return members;
    }
  }

  private async resolveUserMentions(mentions: string[], guildId: string): Promise<string[]> {
    const resolved: string[] = [];

    // Check if we need to fetch members
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
        resolved.push(mention); // Already in correct format
      } else if (mention.startsWith('@')) {
        // Remove @ prefix and search for username
        const username = mention.substring(1).toLowerCase();
        const member = members.get(username);

        if (member) {
          resolved.push(`<@${member.id}>`);
        } else {
          this.logger.warn(`Could not resolve user mention: ${mention}`);
          // Keep original mention as fallback
          resolved.push(mention);
        }
      } else {
        // Try without @ prefix
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

    // Add mentions from reminder settings if available
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

              // Get responses for this date with user names
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

  async sendPRMessage(schedule: Schedule | ScheduleResponse): Promise<void> {
    const message: DiscordMessage = {
      content: `[PR] 画像を貼るだけでリンク集/個人HPを作ろう！[ピクページ](https://piku.page/)\n\n> 調整ちゃんは無料で運営されています`,
    };

    // Add message reference if messageId exists
    if (schedule.messageId) {
      message.message_reference = {
        message_id: schedule.messageId,
      };
    }

    // Send PR message with delay after summary using Promise-based delay
    await new Promise((resolve) => setTimeout(resolve, NOTIFICATION_CONSTANTS.PR_MESSAGE_DELAY_MS));
    await this.sendChannelMessage(schedule.channelId, message);
  }
}

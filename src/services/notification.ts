import { Schedule, ScheduleSummary } from '../types/schedule';
import { StorageServiceV2 as StorageService } from './storage-v2';
import { formatDate } from '../utils/date';
import { STATUS_EMOJI } from '../types/schedule';

/**
 * 通知サービス
 * 
 * 締切リマインダーと自動締切通知を管理します。
 * GitHub Actionsのcronジョブから呼び出されます。
 */
export class NotificationService {
  private memberCache: Map<string, Map<string, { id: string; username: string }>> = new Map();

  constructor(
    private storage: StorageService,
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

  async sendDeadlineReminder(schedule: Schedule, customMessage: string = '締切が1時間以内'): Promise<void> {
    if (!schedule.deadline) return;
    
    const deadlineDate = new Date(schedule.deadline);
    const messageLink = `https://discord.com/channels/${schedule.guildId}/${schedule.channelId}/${schedule.messageId}`;
    
    // Send DM to schedule author
    try {
      await this.sendDirectMessage(
        schedule.authorId,
        `⏰ **リマインダー**: 「${schedule.title}」の${customMessage}です！\n\n` +
        `締切: ${deadlineDate.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}\n` +
        `現在の回答者数: ${schedule.totalResponses || 0}人\n\n` +
        `[スケジュールを確認](${messageLink})`
      );
    } catch (error) {
      console.error(`Failed to send DM to author ${schedule.authorId}:`, error);
    }
    
    // Build mentions string
    let mentions = '';
    if (schedule.reminderMentions && schedule.reminderMentions.length > 0 && schedule.guildId) {
      // Resolve user mentions to proper Discord format
      const resolvedMentions = await this.resolveUserMentions(schedule.reminderMentions, schedule.guildId);
      mentions = resolvedMentions.join(' ') + ' ';
    }
    
    // Send reminder to channel
    const message = {
      content: `${mentions}⏰ **締切リマインダー**: 「${schedule.title}」の${customMessage}です！`,
      embeds: [{
        color: 0xffcc00,
        fields: [
          {
            name: '締切時刻',
            value: deadlineDate.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
            inline: true
          },
          {
            name: '現在の回答者数',
            value: `${schedule.totalResponses || 0}人`,
            inline: true
          }
        ],
        footer: {
          text: 'まだ回答していない方は早めに回答をお願いします！'
        }
      }],
      message_reference: {
        message_id: schedule.messageId
      }
    };
    
    await this.sendChannelMessage(schedule.channelId, message);
  }

  private async getNonRespondents(summary: ScheduleSummary): Promise<string[]> {
    // In a real implementation, this would get channel members
    // and compare with respondents
    return [];
  }

  private createReminderMessage(schedule: Schedule, nonRespondents: string[]): any {
    return {
      content: `⏰ **リマインダー**: 日程調整「${schedule.title}」の締切が近づいています！`,
      embeds: [{
        title: '📅 未回答の方はご回答をお願いします',
        color: 0xf39c12, // Warning color
        fields: [
          {
            name: '日程調整',
            value: schedule.title,
            inline: true
          },
          {
            name: '締切',
            value: schedule.deadline ? formatDate(schedule.deadline.toISOString()) : '未設定',
            inline: true
          },
          {
            name: '未回答者',
            value: nonRespondents.join(', ') || 'なし',
            inline: false
          }
        ],
        footer: {
          text: `ID: ${schedule.id}`
        },
        timestamp: new Date().toISOString()
      }]
    };
  }

  private async sendChannelMessage(channelId: string, message: any): Promise<void> {
    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${this.discordToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`);
    }
  }

  private async fetchGuildMembers(guildId: string): Promise<Map<string, { id: string; username: string }>> {
    if (this.memberCache.has(guildId)) {
      return this.memberCache.get(guildId)!;
    }

    const members = new Map<string, { id: string; username: string }>();
    let after: string | undefined = undefined;
    
    try {
      // Discord API allows fetching up to 1000 members at a time
      while (true) {
        const url = `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000${after ? `&after=${after}` : ''}`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bot ${this.discordToken}`,
          }
        });
        
        if (!response.ok) {
          console.error(`Failed to fetch guild members: ${response.status}`);
          break;
        }
        
        const memberList = await response.json() as Array<{
          user: { id: string; username: string; discriminator: string };
        }>;
        
        if (memberList.length === 0) break;
        
        for (const member of memberList) {
          members.set(member.user.username.toLowerCase(), {
            id: member.user.id,
            username: member.user.username
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
      console.error('Error fetching guild members:', error);
      return members;
    }
  }

  private async resolveUserMentions(mentions: string[], guildId: string): Promise<string[]> {
    const resolved: string[] = [];
    
    // Check if we need to fetch members
    const needsResolution = mentions.some(m => 
      m !== '@everyone' && 
      m !== '@here' && 
      !(m.startsWith('<@') && m.endsWith('>'))
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
          console.warn(`Could not resolve user mention: ${mention}`);
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

  async sendDirectMessage(userId: string, content: string): Promise<void> {
    // First, create or get DM channel
    const dmChannelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${this.discordToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipient_id: userId })
    });

    if (!dmChannelResponse.ok) {
      throw new Error(`Failed to create DM channel: ${dmChannelResponse.status}`);
    }

    const dmChannel = await dmChannelResponse.json() as { id: string };
    
    // Send message to DM channel
    await this.sendChannelMessage(dmChannel.id, { content });
  }

  async sendSummaryMessage(scheduleId: string, guildId: string = 'default'): Promise<void> {
    const summary = await this.storage.getScheduleSummary(scheduleId, guildId);
    if (!summary) return;

    const { schedule, responseCounts, userResponses, bestDateId } = summary;
    
    const message = {
      content: `📊 日程調整「${schedule.title}」が締め切られました！`,
      embeds: [{
        title: '集計結果',
        color: 0x2ecc71,
        fields: [
          {
            name: '参加者数',
            value: `${userResponses.length}人`,
            inline: true
          },
          ...schedule.dates.map(date => {
            const count = responseCounts[date.id];
            const isBest = date.id === bestDateId;
            return {
              name: `${isBest ? '⭐ ' : ''}${date.datetime}`,
              value: `${STATUS_EMOJI.yes} ${count.yes}人　${STATUS_EMOJI.maybe} ${count.maybe}人　${STATUS_EMOJI.no} ${count.no}人`,
              inline: false
            };
          })
        ],
        footer: {
          text: bestDateId ? '⭐ は最有力候補です' : ''
        }
      }]
    };

    await this.sendChannelMessage(schedule.channelId, message);
  }

  async sendPRMessage(schedule: Schedule): Promise<void> {
    const prMessages = [
      '🎉 Discord調整ちゃんは無料でご利用いただけます！もっと多くの機能が必要な場合は、プレミアムプランをご検討ください。',
      '📅 チーム運営を効率化！Discord調整ちゃんで簡単日程調整。詳しくは https://discord-choseisan.com をチェック！',
      '✨ より高度な集計機能やカスタマイズが必要ですか？エンタープライズプランもご用意しています！',
      '🚀 Discord調整ちゃんをご利用いただきありがとうございます！フィードバックは GitHub Issues までお寄せください。'
    ];

    const randomMessage = prMessages[Math.floor(Math.random() * prMessages.length)];

    const message: any = {
      content: `[PR] ${randomMessage}`,
      embeds: [{
        color: 0x7289da,
        footer: {
          text: 'この広告は無料版をご利用の場合に表示されます'
        }
      }]
    };

    // Add message reference if messageId exists
    if (schedule.messageId) {
      message.message_reference = {
        message_id: schedule.messageId
      };
    }

    // Send PR message 5 seconds after summary
    setTimeout(async () => {
      try {
        await this.sendChannelMessage(schedule.channelId, message);
      } catch (error) {
        console.error('Failed to send PR message:', error);
      }
    }, 5000);
  }
}
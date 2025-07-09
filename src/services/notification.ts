import { Schedule, ScheduleSummary } from '../types/schedule';
import { StorageService } from './storage';
import { formatDate } from '../utils/date';
import { STATUS_EMOJI } from '../types/schedule';

/**
 * 通知サービス
 * 
 * NOTE: 自動締切リマインダーと自動締切機能は未実装です
 * Cloudflare Workers の無料プランでは cron triggers が3つまでしか設定できないため、
 * 以下の機能は実装していません：
 * - 締切前の自動リマインダー通知
 * - 締切時刻での自動締切処理
 * 
 * 必要に応じて有料プランにアップグレードするか、
 * 外部のcronサービス（GitHub Actions等）を利用してください
 */
export class NotificationService {
  constructor(
    private storage: StorageService,
    private discordToken: string,
    private applicationId: string
  ) {}

  async checkAndSendNotifications(): Promise<void> {
    // NOTE: この機能は未実装です
    // Cloudflare Workers の無料プランでは cron triggers が3つまでしか設定できないため、
    // 現在は自動的な締切リマインダーや自動締切機能は実装していません
    // 必要に応じて有料プランにアップグレードするか、外部のcronサービスを利用してください
    
    // This would be called by a cron job or scheduled worker
    const schedules = await this.getSchedulesNearingDeadline();
    
    for (const schedule of schedules) {
      if (!schedule.notificationSent && schedule.deadline) {
        await this.sendDeadlineReminder(schedule);
      }
    }
  }

  private async getSchedulesNearingDeadline(): Promise<Schedule[]> {
    // NOTE: この機能は未実装です
    // 実際の実装では、締切が近い（例：24時間以内）すべてのスケジュールを取得します
    // Cloudflare Workers の無料プランでは cron triggers が制限されているため未実装
    return [];
  }

  async sendDeadlineReminder(schedule: Schedule): Promise<void> {
    // NOTE: この機能は未実装です
    // Cloudflare Workers の無料プランでは cron triggers が3つまでしか設定できないため、
    // 現在は自動的な締切リマインダー機能は実装していません
    
    const summary = await this.storage.getScheduleSummary(schedule.id);
    if (!summary) return;

    const nonRespondents = await this.getNonRespondents(summary);
    if (nonRespondents.length === 0) return;

    const message = this.createReminderMessage(schedule, nonRespondents);
    
    // Send message to channel
    await this.sendChannelMessage(schedule.channelId, message);
    
    // Mark notification as sent
    schedule.notificationSent = true;
    schedule.updatedAt = new Date();
    await this.storage.saveSchedule(schedule);
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

  async sendSummaryMessage(scheduleId: string): Promise<void> {
    const summary = await this.storage.getScheduleSummary(scheduleId);
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
}
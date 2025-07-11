/**
 * Domain Type Interfaces for Infrastructure Layer
 * 
 * これらのインターフェースはインフラストラクチャー層での型変換に使用される
 * ドメインエンティティのシンプルなデータ表現
 */

export interface DomainUser {
  id: string;
  username: string;
  displayName?: string;
}

export interface DomainScheduleDate {
  id: string;
  datetime: string;
  description?: string;
}

export type DomainResponseStatus = 'ok' | 'maybe' | 'ng';

export interface DomainSchedule {
  id: string;
  guildId: string;
  channelId: string;
  messageId?: string;
  title: string;
  description?: string;
  dates: DomainScheduleDate[];
  createdBy: DomainUser;
  authorId: string;
  deadline?: Date;
  reminderTimings?: string[];
  reminderMentions?: string[];
  remindersSent?: string[];
  status: 'open' | 'closed';
  notificationSent: boolean;
  totalResponses: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DomainResponse {
  scheduleId: string;
  userId: string;
  username: string;
  displayName?: string;
  dateStatuses: Record<string, DomainResponseStatus>;
  comment?: string;
  updatedAt: Date;
}

export interface DomainScheduleSummary {
  schedule: DomainSchedule;
  responses: DomainResponse[];
  responseCounts: Record<string, Record<string, number>>;
  totalResponseUsers: number;
  bestDateId?: string;
  statistics: {
    overallParticipation: {
      fullyAvailable: number;
      partiallyAvailable: number;
      unavailable: number;
    };
    optimalDates: {
      optimalDateId?: string;
      alternativeDateIds: string[];
      scores: Record<string, number>;
    };
  };
}
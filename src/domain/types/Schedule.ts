/**
 * Domain Types for Schedule
 * 
 * ドメイン層の純粋な型定義
 * 外部依存を持たない純粋なドメインオブジェクト
 */

export interface DomainUser {
  id: string;
  username: string;
}

export interface DomainScheduleDate {
  id: string;
  datetime: string;
}

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

export type DomainResponseStatus = 'ok' | 'maybe' | 'ng';

export interface DomainScheduleSummary {
  schedule: DomainSchedule;
  responses: DomainResponse[];
  responseCounts: Record<string, Record<DomainResponseStatus, number>>;
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
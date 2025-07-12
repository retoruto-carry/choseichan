/**
 * Schedule Data Transfer Objects
 *
 * アプリケーション層とプレゼンテーション層間のデータ転送用オブジェクト
 */

export interface CreateScheduleRequest {
  guildId: string;
  channelId: string;
  authorId: string;
  authorUsername: string;
  title: string;
  description?: string;
  dates: Array<{
    id: string;
    datetime: string;
  }>;
  deadline?: string; // ISO string
  reminderTimings?: string[];
  reminderMentions?: string[];
}

export interface UpdateScheduleRequest {
  scheduleId: string;
  guildId: string;
  editorUserId: string;
  title?: string;
  description?: string;
  deadline?: string | null; // ISO string or null to remove
  messageId?: string;
  dates?: Array<{
    id: string;
    datetime: string;
  }>;
  reminderTimings?: string[];
  reminderMentions?: string[];
  reminderStates?: Record<string, never>; // Empty object to reset reminder states when deadline changes
}

export interface AddDatesRequest {
  scheduleId: string;
  guildId: string;
  editorUserId: string;
  dates: Array<{
    id: string;
    datetime: string;
  }>;
}

export interface CloseScheduleRequest {
  scheduleId: string;
  guildId: string;
  editorUserId: string;
}

export interface ScheduleResponse {
  id: string;
  guildId: string;
  channelId: string;
  messageId?: string;
  title: string;
  description?: string;
  dates: Array<{
    id: string;
    datetime: string;
  }>;
  createdBy: {
    id: string;
    username: string;
    displayName?: string;
  };
  authorId: string;
  deadline?: string; // ISO string
  reminderTimings?: string[];
  reminderMentions?: string[];
  remindersSent?: string[];
  status: 'open' | 'closed';
  notificationSent: boolean;
  totalResponses: number;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface ScheduleSummaryResponse {
  schedule: ScheduleResponse;
  responses: ResponseDto[];
  responseCounts: Record<string, { yes: number; maybe: number; no: number }>;
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

export interface ResponseDto {
  scheduleId: string;
  userId: string;
  username: string;
  displayName?: string;
  dateStatuses: Record<string, 'ok' | 'maybe' | 'ng'>;
  comment?: string;
  updatedAt: string; // ISO string
}

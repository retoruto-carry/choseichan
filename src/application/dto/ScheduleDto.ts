/**
 * スケジュールデータ転送オブジェクト
 *
 * アプリケーション層とプレゼンテーション層間のデータ転送用オブジェクト
 */

import type { ResponseDto } from './ResponseDto';

export interface CreateScheduleRequestDto {
  guildId: string;
  channelId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName?: string;
  title: string;
  description?: string;
  dates: Array<{
    id: string;
    datetime: string;
  }>;
  deadline?: string; // ISO文字列
  reminderTimings?: string[];
  reminderMentions?: string[];
}

export interface UpdateScheduleRequestDto {
  scheduleId: string;
  guildId: string;
  editorUserId: string;
  title?: string;
  description?: string;
  deadline?: string | null; // ISO文字列またはnullで削除
  messageId?: string;
  dates?: Array<{
    id: string;
    datetime: string;
  }>;
  reminderTimings?: string[];
  reminderMentions?: string[];
  reminderStates?: Record<string, never>; // 締切変更時にリマインダー状態をリセットするための空オブジェクト
}

export interface AddDatesRequestDto {
  scheduleId: string;
  guildId: string;
  editorUserId: string;
  dates: Array<{
    id: string;
    datetime: string;
  }>;
}

export interface CloseScheduleRequestDto {
  scheduleId: string;
  guildId: string;
  editorUserId: string;
}

export interface ScheduleResponseDto {
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
  deadline?: string; // ISO文字列
  reminderTimings?: string[];
  reminderMentions?: string[];
  remindersSent?: string[];
  status: 'open' | 'closed';
  notificationSent: boolean;
  totalResponses: number;
  createdAt: string; // ISO文字列
  updatedAt: string; // ISO文字列
}

export interface ScheduleSummaryResponseDto {
  schedule: ScheduleResponseDto;
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

// ResponseDto is defined in ResponseDto.ts - import from there if needed

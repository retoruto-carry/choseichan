/**
 * レスポンスデータ転送オブジェクト
 *
 * 回答関連のデータ転送用オブジェクト
 */

export interface SubmitResponseRequestDto {
  scheduleId: string;
  guildId: string;
  userId: string;
  username: string;
  displayName?: string;
  responses: Array<{
    dateId: string;
    status: 'ok' | 'maybe' | 'ng';
  }>;
}

export interface UpdateResponseRequestDto {
  scheduleId: string;
  guildId: string;
  userId: string;
  responses?: Array<{
    dateId: string;
    status: 'ok' | 'maybe' | 'ng';
  }>;
}

export interface GetResponseRequestDto {
  scheduleId: string;
  guildId: string;
  userId?: string; // 指定しない場合は全ユーザーの回答を取得
}

export interface ResponseSubmissionResultDto {
  success: boolean;
  response: ResponseDto;
  isNewResponse: boolean;
  errors?: string[];
}

export interface ResponseDto {
  scheduleId: string;
  userId: string;
  username: string;
  displayName?: string;
  dateStatuses: Record<string, 'ok' | 'maybe' | 'ng'>;
  updatedAt: string; // ISO string
}

export interface ResponseStatisticsDto {
  totalUsers: number;
  responsesByDate: Record<
    string,
    {
      yes: number;
      maybe: number;
      no: number;
      total: number;
      percentage: {
        yes: number;
        maybe: number;
        no: number;
      };
    }
  >;
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
}

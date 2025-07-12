/**
 * Response Data Transfer Objects
 *
 * 回答関連のデータ転送用オブジェクト
 */

export interface SubmitResponseRequest {
  scheduleId: string;
  guildId: string;
  userId: string;
  username: string;
  displayName?: string;
  responses: Array<{
    dateId: string;
    status: 'ok' | 'maybe' | 'ng';
  }>;
  comment?: string; // 後方互換性のため残す（将来削除予定）
}

export interface UpdateResponseRequest {
  scheduleId: string;
  guildId: string;
  userId: string;
  responses?: Array<{
    dateId: string;
    status: 'ok' | 'maybe' | 'ng';
  }>;
  comment?: string; // 後方互換性のため残す（将来削除予定）
}

export interface GetResponseRequest {
  scheduleId: string;
  guildId: string;
  userId?: string; // 指定しない場合は全ユーザーの回答を取得
}

export interface ResponseSubmissionResult {
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
  comment?: string; // 後方互換性のため残す（将来削除予定）
  updatedAt: string; // ISO string
}

export interface ResponseStatistics {
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

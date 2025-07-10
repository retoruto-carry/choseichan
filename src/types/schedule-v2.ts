/**
 * Updated schedule types to match the repository pattern implementation
 */

export interface User {
  id: string;
  username: string;
}

export interface ScheduleDate {
  id: string;
  datetime: string;
}

export interface Schedule {
  id: string;
  guildId: string;
  channelId: string;
  messageId?: string;
  title: string;
  description?: string;
  dates: ScheduleDate[];
  createdBy: User;
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

// Updated Response interface to match KV storage structure
export interface Response {
  scheduleId: string;
  userId: string;
  username: string;  // Changed from userName
  displayName?: string;  // Added for Discord display names
  dateStatuses: Record<string, ResponseStatus>;  // Changed from responses array
  comment?: string;
  updatedAt: Date;
}

// Updated ResponseStatus to match KV storage
export type ResponseStatus = 'ok' | 'maybe' | 'ng';

// Legacy Response type for backward compatibility
export interface LegacyResponse {
  scheduleId: string;
  userId: string;
  userName: string;
  responses: Array<{
    dateId: string;
    status: 'yes' | 'maybe' | 'no';
  }>;
  comment?: string;
  updatedAt: Date | string;
}

export interface ScheduleSummary {
  schedule: Schedule;
  responseCounts: Record<string, Record<ResponseStatus, number>>;
  userResponses: Record<string, Record<string, ResponseStatus>>;
  totalResponses: number;
}

// Legacy ScheduleSummary type for compatibility
export interface LegacyScheduleSummary {
  schedule: Schedule;
  responseCounts: {
    [dateId: string]: {
      yes: number;
      maybe: number;
      no: number;
      total: number;
    };
  };
  userResponses: LegacyResponse[];  // Legacy Response[]
  bestDateId?: string;
}

export function convertToLegacyScheduleSummary(summary: ScheduleSummary, responses: Response[]): LegacyScheduleSummary {
  const legacyResponseCounts: Record<string, {
    yes: number;
    maybe: number;
    no: number;
    total: number;
  }> = {};
  
  for (const [dateId, counts] of Object.entries(summary.responseCounts)) {
    legacyResponseCounts[dateId] = {
      yes: counts.ok || 0,
      maybe: counts.maybe || 0,
      no: counts.ng || 0,
      total: (counts.ok || 0) + (counts.maybe || 0) + (counts.ng || 0)
    };
  }
  
  // Convert responses to legacy format
  const legacyResponses = responses.map(r => convertResponseToLegacy(r));
  
  // Calculate best date ID (date with most 'yes' votes)
  let bestDateId: string | undefined;
  let maxYesVotes = 0;
  
  for (const [dateId, counts] of Object.entries(legacyResponseCounts)) {
    if (counts.yes > maxYesVotes) {
      maxYesVotes = counts.yes;
      bestDateId = dateId;
    }
  }
  
  return {
    schedule: summary.schedule,
    responseCounts: legacyResponseCounts,
    userResponses: legacyResponses,
    bestDateId
  };
}

export const STATUS_EMOJI: Record<ResponseStatus, string> = {
  ok: '⭕',
  maybe: '🔺', 
  ng: '❌'
};

export const EMBED_COLORS = {
  PRIMARY: 0x5865f2,
  SUCCESS: 0x2ecc71,
  WARNING: 0xf39c12,
  ERROR: 0xe74c3c,
  INFO: 0x3498db,
  REMINDER: 0xffcc00
};

// Helper functions for type conversion
export function convertLegacyResponse(legacy: LegacyResponse): Response {
  const dateStatuses: Record<string, ResponseStatus> = {};
  
  if (legacy.responses && Array.isArray(legacy.responses)) {
    for (const resp of legacy.responses) {
      const status = resp.status === 'yes' ? 'ok' : resp.status === 'no' ? 'ng' : 'maybe';
      dateStatuses[resp.dateId] = status;
    }
  }
  
  return {
    scheduleId: legacy.scheduleId,
    userId: legacy.userId,
    username: legacy.userName || legacy.username,
    displayName: legacy.displayName,
    dateStatuses,
    comment: legacy.comment,
    updatedAt: legacy.updatedAt instanceof Date ? legacy.updatedAt : new Date(legacy.updatedAt)
  };
}

export function convertResponseToLegacy(response: Response): LegacyResponse {
  const responses = Object.entries(response.dateStatuses).map(([dateId, status]) => ({
    dateId,
    status: status === 'ok' ? 'yes' : status === 'ng' ? 'no' : 'maybe'
  }));
  
  return {
    scheduleId: response.scheduleId,
    userId: response.userId,
    userName: response.username,
    responses,
    comment: response.comment,
    updatedAt: response.updatedAt
  };
}
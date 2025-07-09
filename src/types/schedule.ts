export interface Schedule {
  id: string;
  title: string;
  description?: string;
  dates: ScheduleDate[];
  createdBy: {
    id: string;
    username: string;
  };
  authorId: string; // For notification service compatibility
  channelId: string;
  guildId?: string; // Guild ID for multi-tenant support
  messageId?: string;
  createdAt: Date;
  updatedAt: Date;
  deadline?: Date;
  status: 'open' | 'closed';
  notificationSent: boolean;
  reminderSent?: boolean; // Track if reminder was sent
  totalResponses?: number; // Total number of responses
}

export interface ScheduleDate {
  id: string;
  datetime: string; // ISO 8601 format
  description?: string;
}

export interface Response {
  scheduleId: string;
  userId: string;
  userName: string;
  responses: DateResponse[];
  comment?: string;
  updatedAt: Date;
}

export interface DateResponse {
  dateId: string;
  status: ResponseStatus;
  comment?: string;
}

export type ResponseStatus = 'yes' | 'maybe' | 'no';

export interface ScheduleSummary {
  schedule: Schedule;
  responseCounts: {
    [dateId: string]: {
      yes: number;
      maybe: number;
      no: number;
      total: number;
    };
  };
  userResponses: Response[];
  bestDateId?: string;
}

// Button custom_id formats
export const BUTTON_ID_FORMATS = {
  RESPONSE: 'response:{scheduleId}:{dateId}:{status}',
  SHOW_DETAILS: 'details:{scheduleId}',
  CLOSE_SCHEDULE: 'close:{scheduleId}',
  DELETE_SCHEDULE: 'delete:{scheduleId}',
  EXPORT_CSV: 'export:{scheduleId}'
};

// Emoji mappings
export const STATUS_EMOJI = {
  yes: '✅',
  maybe: '❔',
  no: '❌'
} as const;

// Color mappings for embeds
export const EMBED_COLORS = {
  OPEN: 0x2ecc71, // Green
  CLOSED: 0xe74c3c, // Red
  INFO: 0x3498db, // Blue
  WARNING: 0xf39c12 // Orange
} as const;
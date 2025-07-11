/**
 * Application Layer Interfaces
 * 
 * アプリケーション層で使用されるインターフェース
 */

import { User, Schedule, Response, Result } from './core';

// DTOs (Data Transfer Objects)
export interface ScheduleDto {
  readonly id: string;
  readonly guildId: string;
  readonly channelId: string;
  readonly messageId?: string;
  readonly title: string;
  readonly description?: string;
  readonly dates: readonly {
    readonly id: string;
    readonly datetime: string;
    readonly description?: string;
  }[];
  readonly createdBy: User;
  readonly authorId: string;
  readonly deadline?: string; // ISO string
  readonly reminderTimings?: readonly string[];
  readonly reminderMentions?: readonly string[];
  readonly remindersSent?: readonly string[];
  readonly status: 'open' | 'closed';
  readonly notificationSent: boolean;
  readonly totalResponses: number;
  readonly createdAt: string; // ISO string
  readonly updatedAt: string; // ISO string
}

export interface ResponseDto {
  readonly scheduleId: string;
  readonly userId: string;
  readonly username: string;
  readonly displayName?: string;
  readonly dateStatuses: Record<string, 'ok' | 'maybe' | 'ng'>;
  readonly comment?: string;
  readonly updatedAt: string; // ISO string
}

export interface ScheduleSummaryDto {
  readonly schedule: ScheduleDto;
  readonly responses: readonly ResponseDto[];
  readonly responseCounts: Record<string, Record<string, number>>;
  readonly totalResponseUsers: number;
  readonly bestDateId?: string;
  readonly statistics: {
    readonly overallParticipation: {
      readonly fullyAvailable: number;
      readonly partiallyAvailable: number;
      readonly unavailable: number;
    };
    readonly optimalDates: {
      readonly optimalDateId?: string;
      readonly alternativeDateIds: readonly string[];
      readonly scores: Record<string, number>;
    };
  };
}

// Use Case Request/Response Types
export interface CreateScheduleRequest {
  readonly title: string;
  readonly description?: string;
  readonly dates: readonly string[]; // ISO datetime strings
  readonly deadline?: string; // ISO datetime string
  readonly reminderTimings?: readonly string[];
  readonly reminderMentions?: readonly string[];
  readonly guildId: string;
  readonly channelId: string;
  readonly createdBy: User;
}

export interface UpdateScheduleRequest {
  readonly scheduleId: string;
  readonly guildId: string;
  readonly title?: string;
  readonly description?: string;
  readonly dates?: readonly string[];
  readonly deadline?: string;
  readonly reminderTimings?: readonly string[];
  readonly reminderMentions?: readonly string[];
  readonly updatedBy: User;
}

export interface SubmitResponseRequest {
  readonly scheduleId: string;
  readonly guildId: string;
  readonly user: User;
  readonly dateStatuses: Record<string, 'ok' | 'maybe' | 'ng'>;
  readonly comment?: string;
}

export interface FindSchedulesRequest {
  readonly guildId: string;
  readonly channelId?: string;
  readonly status?: 'open' | 'closed';
  readonly limit?: number;
  readonly authorId?: string;
}

export interface GetScheduleRequest {
  readonly scheduleId: string;
  readonly guildId: string;
}

export interface CloseScheduleRequest {
  readonly scheduleId: string;
  readonly guildId: string;
  readonly closedBy: User;
}

export interface DeleteScheduleRequest {
  readonly scheduleId: string;
  readonly guildId: string;
  readonly deletedBy: User;
}

// Response Types
export interface ScheduleResponse {
  readonly schedule: ScheduleDto;
}

export interface SchedulesResponse {
  readonly schedules: readonly ScheduleDto[];
  readonly total: number;
}

export interface ScheduleSummaryResponse {
  readonly summary: ScheduleSummaryDto;
}

export interface ResponseSubmissionResponse {
  readonly response: ResponseDto;
  readonly schedule: ScheduleDto;
}

// Service Interfaces
export interface NotificationService {
  sendDeadlineReminder(schedule: ScheduleDto, message: string): Promise<void>;
  sendClosureNotification(schedule: ScheduleDto): Promise<void>;
  resolveUserMentions(mentions: readonly string[], guildId: string): Promise<readonly string[]>;
}

export interface ScheduleService {
  createSchedule(request: CreateScheduleRequest): Promise<Result<ScheduleResponse>>;
  updateSchedule(request: UpdateScheduleRequest): Promise<Result<ScheduleResponse>>;
  closeSchedule(request: CloseScheduleRequest): Promise<Result<ScheduleResponse>>;
  reopenSchedule(request: GetScheduleRequest): Promise<Result<ScheduleResponse>>;
  deleteSchedule(request: DeleteScheduleRequest): Promise<Result<void>>;
  getSchedule(request: GetScheduleRequest): Promise<Result<ScheduleResponse>>;
  findSchedules(request: FindSchedulesRequest): Promise<Result<SchedulesResponse>>;
  getScheduleSummary(request: GetScheduleRequest): Promise<Result<ScheduleSummaryResponse>>;
}

export interface ResponseService {
  submitResponse(request: SubmitResponseRequest): Promise<Result<ResponseSubmissionResponse>>;
  updateResponse(request: SubmitResponseRequest): Promise<Result<ResponseSubmissionResponse>>;
  getResponse(scheduleId: string, userId: string, guildId: string): Promise<Result<ResponseDto>>;
  getScheduleResponses(scheduleId: string, guildId: string): Promise<Result<readonly ResponseDto[]>>;
}

// Reminder Types
export interface ReminderInfo {
  readonly scheduleId: string;
  readonly guildId: string;
  readonly reminderType: string;
  readonly message: string;
  readonly scheduleTitle: string;
  readonly deadline: Date;
}

export interface DeadlineCheckResult {
  readonly upcomingReminders: readonly ReminderInfo[];
  readonly justClosed: readonly {
    readonly scheduleId: string;
    readonly guildId: string;
  }[];
}

// Event Types
export interface DomainEvent {
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly occurredOn: Date;
  readonly eventVersion: number;
}

export interface ScheduleCreatedEvent extends DomainEvent {
  readonly eventType: 'ScheduleCreated';
  readonly aggregateType: 'Schedule';
  readonly data: {
    readonly schedule: ScheduleDto;
    readonly createdBy: User;
  };
}

export interface ScheduleClosedEvent extends DomainEvent {
  readonly eventType: 'ScheduleClosed';
  readonly aggregateType: 'Schedule';
  readonly data: {
    readonly scheduleId: string;
    readonly guildId: string;
    readonly closedBy: User;
    readonly totalResponses: number;
  };
}

export interface ResponseSubmittedEvent extends DomainEvent {
  readonly eventType: 'ResponseSubmitted';
  readonly aggregateType: 'Response';
  readonly data: {
    readonly response: ResponseDto;
    readonly scheduleId: string;
    readonly isNewResponse: boolean;
  };
}

// Validation Types
export interface ValidationRule<T> {
  validate(value: T): Result<T, ValidationError>;
}

export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly value: unknown;
}

export interface Validator<T> {
  validate(value: T): Result<T, ValidationError[]>;
}

// Mappers
export interface Mapper<TSource, TTarget> {
  map(source: TSource): TTarget;
  mapArray(sources: readonly TSource[]): readonly TTarget[];
}

export interface ScheduleMapper extends Mapper<Schedule, ScheduleDto> {
  toDomain(dto: ScheduleDto): Schedule;
  toDto(entity: Schedule): ScheduleDto;
}

export interface ResponseMapper extends Mapper<Response, ResponseDto> {
  toDomain(dto: ResponseDto): Response;
  toDto(entity: Response): ResponseDto;
}
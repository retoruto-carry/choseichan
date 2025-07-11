/**
 * Core Interfaces
 * 
 * アプリケーション全体で使用される基本インターフェース
 */

// Base Entity Interfaces
export interface Entity {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AggregateRoot extends Entity {
  // Marker interface for aggregate roots
}

// Common Value Objects
export interface User {
  readonly id: string;
  readonly username: string;
  readonly displayName?: string;
}

export interface ScheduleDate {
  readonly id: string;
  readonly datetime: string;
  readonly description?: string;
}

// Domain Enums
export type ScheduleStatus = 'open' | 'closed';
export type ResponseStatus = 'ok' | 'maybe' | 'ng';

// Business Objects
export interface Schedule extends AggregateRoot {
  readonly guildId: string;
  readonly channelId: string;
  readonly messageId?: string;
  readonly title: string;
  readonly description?: string;
  readonly dates: readonly ScheduleDate[];
  readonly createdBy: User;
  readonly authorId: string;
  readonly deadline?: Date;
  readonly reminderTimings?: readonly string[];
  readonly reminderMentions?: readonly string[];
  readonly remindersSent?: readonly string[];
  readonly status: ScheduleStatus;
  readonly notificationSent: boolean;
  readonly totalResponses: number;
}

export interface Response extends Entity {
  readonly scheduleId: string;
  readonly user: User;
  readonly dateStatuses: Record<string, ResponseStatus>;
  readonly comment?: string;
}

// Repository Interfaces
export interface Repository<TEntity extends Entity, TId = string> {
  save(entity: TEntity): Promise<void>;
  findById(id: TId): Promise<TEntity | null>;
  delete(id: TId): Promise<void>;
}

export interface ScheduleRepository extends Repository<Schedule> {
  findByChannel(channelId: string, guildId: string, limit?: number): Promise<Schedule[]>;
  findByDeadlineRange(startTime: Date, endTime: Date, guildId?: string): Promise<Schedule[]>;
  findByMessageId(messageId: string, guildId: string): Promise<Schedule | null>;
  countByGuild(guildId: string): Promise<number>;
  updateReminders(params: {
    scheduleId: string;
    guildId: string;
    remindersSent: string[];
    reminderSent?: boolean;
  }): Promise<void>;
}

export interface ResponseRepository extends Repository<Response> {
  findByUser(scheduleId: string, userId: string, guildId: string): Promise<Response | null>;
  findByScheduleId(scheduleId: string, guildId: string): Promise<Response[]>;
  deleteBySchedule(scheduleId: string, guildId: string): Promise<void>;
}

// Use Case Interfaces
export interface UseCase<TRequest, TResponse> {
  execute(request: TRequest): Promise<TResponse>;
}

export interface Command<TRequest, TResponse = void> extends UseCase<TRequest, TResponse> {}
export interface Query<TRequest, TResponse> extends UseCase<TRequest, TResponse> {}

// Result Pattern
export interface Result<T, E = Error> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: E;
  readonly errors?: E[];
}

export interface SuccessResult<T> extends Result<T> {
  readonly success: true;
  readonly data: T;
  readonly error?: never;
  readonly errors?: never;
}

export interface FailureResult<E = Error> extends Result<never, E> {
  readonly success: false;
  readonly data?: never;
  readonly error?: E;
  readonly errors?: E[];
}

// Factory functions for Result
export const Result = {
  success<T>(data: T): SuccessResult<T> {
    return { success: true, data };
  },
  
  failure<E = Error>(error: E): FailureResult<E> {
    return { success: false, error };
  },
  
  failures<E = Error>(errors: E[]): FailureResult<E> {
    return { success: false, errors };
  }
} as const;

// Common Error Types
export interface DomainError extends Error {
  readonly code: string;
  readonly statusCode?: number;
  readonly details?: Record<string, unknown>;
}

export interface ValidationError extends DomainError {
  readonly field: string;
  readonly value: unknown;
}

// Configuration Interfaces
export interface DatabaseConfig {
  readonly type: 'd1';
  readonly database: D1Database;
}

export interface DiscordConfig {
  readonly applicationId: string;
  readonly publicKey: string;
  readonly token?: string;
  readonly clientId?: string;
  readonly clientSecret?: string;
}

export interface ApplicationConfig {
  readonly environment: 'development' | 'testing' | 'production';
  readonly database: DatabaseConfig;
  readonly discord: DiscordConfig;
  readonly logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enabled: boolean;
  };
  readonly features?: {
    notifications: boolean;
    reminders: boolean;
    analytics: boolean;
  };
}
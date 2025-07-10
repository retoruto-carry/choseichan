/**
 * Response Domain Entity
 * 
 * ユーザーの回答のドメインエンティティ
 * スケジュールに対する回答を表現
 */

import { User } from './User';
import { ResponseStatus } from './ResponseStatus';

export interface ScheduleId {
  readonly value: string;
}

export interface DateResponses {
  readonly value: Record<string, ResponseStatus>;
}

export interface Comment {
  readonly value: string;
}

export class Response {
  private constructor(
    private readonly _scheduleId: ScheduleId,
    private readonly _user: User,
    private readonly _dateStatuses: DateResponses,
    private readonly _comment?: Comment,
    private readonly _updatedAt?: Date
  ) {}

  static create(
    scheduleId: string,
    user: User,
    dateStatuses: Record<string, ResponseStatus>,
    comment?: string,
    updatedAt?: Date
  ): Response {
    if (!scheduleId.trim()) {
      throw new Error('Schedule ID cannot be empty');
    }

    return new Response(
      { value: scheduleId },
      user,
      { value: dateStatuses },
      comment ? { value: comment } : undefined,
      updatedAt || new Date()
    );
  }

  static fromPrimitives(data: {
    scheduleId: string;
    userId: string;
    username: string;
    displayName?: string;
    dateStatuses: Record<string, string>;
    comment?: string;
    updatedAt: Date;
  }): Response {
    const user = User.create(data.userId, data.username, data.displayName);
    
    const dateStatuses: Record<string, ResponseStatus> = {};
    for (const [dateId, status] of Object.entries(data.dateStatuses)) {
      dateStatuses[dateId] = ResponseStatus.fromString(status);
    }

    return Response.create(
      data.scheduleId,
      user,
      dateStatuses,
      data.comment,
      data.updatedAt
    );
  }

  get scheduleId(): string {
    return this._scheduleId.value;
  }

  get user(): User {
    return this._user;
  }

  get dateStatuses(): Record<string, ResponseStatus> {
    return this._dateStatuses.value;
  }

  get comment(): string | undefined {
    return this._comment?.value;
  }

  get updatedAt(): Date {
    return this._updatedAt || new Date();
  }

  /**
   * 特定の日程に対する回答を取得
   */
  getStatusForDate(dateId: string): ResponseStatus | undefined {
    return this.dateStatuses[dateId];
  }

  /**
   * 日程に対する回答を更新
   */
  updateDateStatus(dateId: string, status: ResponseStatus): Response {
    const newDateStatuses = {
      ...this.dateStatuses,
      [dateId]: status
    };

    return new Response(
      this._scheduleId,
      this._user,
      { value: newDateStatuses },
      this._comment,
      new Date()
    );
  }

  /**
   * コメントを更新
   */
  updateComment(comment?: string): Response {
    return new Response(
      this._scheduleId,
      this._user,
      this._dateStatuses,
      comment ? { value: comment } : undefined,
      new Date()
    );
  }

  toPrimitives(): {
    scheduleId: string;
    userId: string;
    username: string;
    displayName?: string;
    dateStatuses: Record<string, string>;
    comment?: string;
    updatedAt: Date;
  } {
    const dateStatuses: Record<string, string> = {};
    for (const [dateId, status] of Object.entries(this.dateStatuses)) {
      dateStatuses[dateId] = status.stringValue;
    }

    return {
      scheduleId: this.scheduleId,
      userId: this.user.id,
      username: this.user.username,
      displayName: this.user.displayName,
      dateStatuses,
      comment: this.comment,
      updatedAt: this.updatedAt
    };
  }

  equals(other: Response): boolean {
    return this.scheduleId === other.scheduleId && 
           this.user.equals(other.user);
  }
}
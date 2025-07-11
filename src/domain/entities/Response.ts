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
    private readonly _id: string,
    private readonly _scheduleId: string,
    private readonly _user: User,
    private readonly _dateStatuses: Map<string, ResponseStatus>,
    private readonly _createdAt: Date,
    private readonly _updatedAt: Date,
    private readonly _comment?: string
  ) {}

  static create(params: {
    id: string;
    scheduleId: string;
    user: User;
    dateStatuses: Map<string, ResponseStatus>;
    comment?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }): Response {
    if (!params.id?.trim()) {
      throw new Error('回答IDは必須です');
    }
    if (!params.scheduleId?.trim()) {
      throw new Error('スケジュールIDは必須です');
    }
    if (params.comment && params.comment.length > 1000) {
      throw new Error('コメントは1000文字以内で入力してください');
    }

    const now = new Date();
    return new Response(
      params.id,
      params.scheduleId,
      params.user,
      params.dateStatuses,
      params.createdAt || now,
      params.updatedAt || now,
      params.comment
    );
  }

  static fromPrimitives(data: {
    id: string;
    scheduleId: string;
    user: {
      id: string;
      username: string;
      displayName?: string;
    };
    dateStatuses: Record<string, 'ok' | 'maybe' | 'ng'>;
    comment?: string;
    createdAt: Date;
    updatedAt: Date;
  }): Response {
    const user = User.create(data.user.id, data.user.username, data.user.displayName);
    
    const dateStatuses = new Map<string, ResponseStatus>();
    for (const [dateId, status] of Object.entries(data.dateStatuses)) {
      dateStatuses.set(dateId, ResponseStatus.fromString(status));
    }

    return Response.create({
      id: data.id,
      scheduleId: data.scheduleId,
      user,
      dateStatuses,
      comment: data.comment,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt
    });
  }

  get id(): string {
    return this._id;
  }

  get scheduleId(): string {
    return this._scheduleId;
  }

  get user(): User {
    return this._user;
  }

  get dateStatuses(): Map<string, ResponseStatus> {
    return this._dateStatuses;
  }

  get comment(): string | undefined {
    return this._comment;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * 特定の日程に対する回答を取得
   */
  getStatusForDate(dateId: string): ResponseStatus | undefined {
    return this.dateStatuses.get(dateId);
  }

  /**
   * ステータスを更新
   */
  updateStatuses(newStatuses: Map<string, ResponseStatus>): Response {
    return new Response(
      this._id,
      this._scheduleId,
      this._user,
      newStatuses,
      this._createdAt,
      new Date(),
      this._comment
    );
  }

  /**
   * コメントを更新
   */
  updateComment(comment?: string): Response {
    if (comment && comment.length > 1000) {
      throw new Error('コメントは1000文字以内で入力してください');
    }
    
    return new Response(
      this._id,
      this._scheduleId,
      this._user,
      this._dateStatuses,
      this._createdAt,
      new Date(),
      comment
    );
  }

  /**
   * 回答があるかチェック
   */
  hasResponded(): boolean {
    return this._dateStatuses.size > 0;
  }

  toPrimitives(): {
    id: string;
    scheduleId: string;
    user: {
      id: string;
      username: string;
      displayName?: string;
    };
    dateStatuses: Record<string, string>;
    comment?: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    const dateStatuses: Record<string, string> = {};
    for (const [dateId, status] of this.dateStatuses) {
      dateStatuses[dateId] = status.value;
    }

    return {
      id: this.id,
      scheduleId: this.scheduleId,
      user: this.user.toPrimitives(),
      dateStatuses,
      comment: this.comment,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  equals(other: Response): boolean {
    return this.id === other.id;
  }
}
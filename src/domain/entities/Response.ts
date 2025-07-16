/**
 * Response Domain Entity
 *
 * ユーザーの回答のドメインエンティティ
 * スケジュールに対する回答を表現
 */

import { ResponseStatus } from './ResponseStatus';
import { User } from './User';

export interface ScheduleId {
  readonly value: string;
}

export interface DateResponses {
  readonly value: Record<string, ResponseStatus>;
}

export interface ResponseCreateParams {
  readonly id: string;
  readonly scheduleId: string;
  readonly user: User;
  readonly dateStatuses: Map<string, ResponseStatus>;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export class Response {
  private constructor(
    private readonly _id: string,
    private readonly _scheduleId: string,
    private readonly _user: User,
    private readonly _dateStatuses: Map<string, ResponseStatus>,
    private readonly _createdAt: Date,
    private readonly _updatedAt: Date
  ) {}

  static create(params: ResponseCreateParams): Response {
    if (!params.id?.trim()) {
      throw new Error('回答IDは必須です');
    }
    if (!params.scheduleId?.trim()) {
      throw new Error('スケジュールIDは必須です');
    }

    const now = new Date();
    return new Response(
      params.id,
      params.scheduleId,
      params.user,
      params.dateStatuses,
      params.createdAt || now,
      params.updatedAt || now
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
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
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
   * @param newStatuses 新しい日程別ステータスのMap（dateId => ResponseStatus）
   * @returns 更新された新しいResponseインスタンス（イミュータブル）
   */
  updateStatuses(newStatuses: Map<string, ResponseStatus>): Response {
    return new Response(
      this._id,
      this._scheduleId,
      this._user,
      newStatuses,
      this._createdAt,
      new Date()
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
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  equals(other: Response): boolean {
    return this.id === other.id;
  }
}

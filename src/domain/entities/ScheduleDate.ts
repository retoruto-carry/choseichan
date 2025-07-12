/**
 * ScheduleDate Domain Entity
 *
 * スケジュールの候補日のドメインエンティティ
 * 日程候補を表現
 */

export interface ScheduleDateId {
  readonly value: string;
}

export interface DateTime {
  readonly value: string;
}

export class ScheduleDate {
  private constructor(
    private readonly _id: ScheduleDateId,
    private readonly _datetime: DateTime
  ) {}

  static create(id: string, datetime: string): ScheduleDate {
    if (!id || !id.trim()) {
      throw new Error('日程IDは必須です');
    }
    if (!datetime || !datetime.trim()) {
      throw new Error('日程時刻は必須です');
    }

    return new ScheduleDate({ value: id }, { value: datetime });
  }

  static fromPrimitives(data: { id: string; datetime: string }): ScheduleDate {
    return ScheduleDate.create(data.id, data.datetime);
  }

  get id(): string {
    return this._id.value;
  }

  get datetime(): string {
    return this._datetime.value;
  }

  toPrimitives(): {
    id: string;
    datetime: string;
  } {
    return {
      id: this.id,
      datetime: this.datetime,
    };
  }

  equals(other: ScheduleDate): boolean {
    return this.id === other.id;
  }

  /**
   * 日時をDateオブジェクトとして取得
   */
  getDateTimeAsDate(): Date {
    return new Date(this.datetime);
  }

  /**
   * 日時が過去かどうかチェック
   */
  isPast(): boolean {
    return this.getDateTimeAsDate() < new Date();
  }
}

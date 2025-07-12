/**
 * Schedule Domain Entity
 *
 * スケジュールのドメインエンティティ
 * 日程調整の情報を表現
 */

import type { DomainSchedule } from '../types/DomainTypes';
import { ScheduleDate } from './ScheduleDate';
import { User } from './User';

export interface ScheduleId {
  readonly value: string;
}

export interface GuildId {
  readonly value: string;
}

export interface ChannelId {
  readonly value: string;
}

export interface MessageId {
  readonly value: string;
}

export interface Title {
  readonly value: string;
}

export interface Description {
  readonly value: string;
}

export enum ScheduleStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

export class Schedule {
  private constructor(
    private readonly _id: ScheduleId,
    private readonly _guildId: GuildId,
    private readonly _channelId: ChannelId,
    private readonly _title: Title,
    private readonly _dates: ScheduleDate[],
    private readonly _createdBy: User,
    private readonly _authorId: string,
    private readonly _status: ScheduleStatus,
    private readonly _createdAt: Date,
    private readonly _updatedAt: Date,
    private readonly _messageId?: MessageId,
    private readonly _description?: Description,
    private readonly _deadline?: Date,
    private readonly _reminderTimings?: string[],
    private readonly _reminderMentions?: string[],
    private readonly _remindersSent?: string[],
    private readonly _notificationSent?: boolean,
    private readonly _totalResponses?: number
  ) {}

  static create(data: {
    id: string;
    guildId: string;
    channelId: string;
    title: string;
    dates: ScheduleDate[];
    createdBy: User;
    authorId: string;
    messageId?: string;
    description?: string;
    deadline?: Date;
    reminderTimings?: string[];
    reminderMentions?: string[];
    remindersSent?: string[];
    status?: ScheduleStatus;
    notificationSent?: boolean;
    totalResponses?: number;
    createdAt?: Date;
    updatedAt?: Date;
  }): Schedule {
    if (!data.id.trim()) {
      throw new Error('Schedule ID cannot be empty');
    }
    if (!data.guildId.trim()) {
      throw new Error('Guild ID cannot be empty');
    }
    if (!data.channelId.trim()) {
      throw new Error('Channel ID cannot be empty');
    }
    if (!data.title.trim()) {
      throw new Error('Title cannot be empty');
    }
    if (data.dates.length === 0) {
      throw new Error('Schedule must have at least one date');
    }

    const now = new Date();

    return new Schedule(
      { value: data.id },
      { value: data.guildId },
      { value: data.channelId },
      { value: data.title },
      data.dates,
      data.createdBy,
      data.authorId,
      data.status || ScheduleStatus.OPEN,
      data.createdAt || now,
      data.updatedAt || now,
      data.messageId ? { value: data.messageId } : undefined,
      data.description ? { value: data.description } : undefined,
      data.deadline,
      data.reminderTimings || ['3d', '1d', '8h'],
      data.reminderMentions || ['@here'],
      data.remindersSent,
      data.notificationSent || false,
      data.totalResponses || 0
    );
  }

  static fromPrimitives(data: DomainSchedule): Schedule {
    const dates = data.dates.map((d) => ScheduleDate.fromPrimitives(d));

    const createdBy = User.fromPrimitives(data.createdBy);

    return Schedule.create({
      id: data.id,
      guildId: data.guildId,
      channelId: data.channelId,
      title: data.title,
      dates,
      createdBy,
      authorId: data.authorId,
      messageId: data.messageId,
      description: data.description,
      deadline: data.deadline ? new Date(data.deadline) : undefined,
      reminderTimings: data.reminderTimings,
      reminderMentions: data.reminderMentions,
      remindersSent: data.remindersSent,
      status: data.status === 'closed' ? ScheduleStatus.CLOSED : ScheduleStatus.OPEN,
      notificationSent: data.notificationSent,
      totalResponses: data.totalResponses,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    });
  }

  // Getters
  get id(): string {
    return this._id.value;
  }

  get guildId(): string {
    return this._guildId.value;
  }

  get channelId(): string {
    return this._channelId.value;
  }

  get messageId(): string | undefined {
    return this._messageId?.value;
  }

  get title(): string {
    return this._title.value;
  }

  get description(): string | undefined {
    return this._description?.value;
  }

  get dates(): ScheduleDate[] {
    return [...this._dates]; // 不変性を保つためコピーを返す
  }

  get createdBy(): User {
    return this._createdBy;
  }

  get authorId(): string {
    return this._authorId;
  }

  get deadline(): Date | undefined {
    return this._deadline;
  }

  get reminderTimings(): string[] | undefined {
    return this._reminderTimings ? [...this._reminderTimings] : undefined;
  }

  get reminderMentions(): string[] | undefined {
    return this._reminderMentions ? [...this._reminderMentions] : undefined;
  }

  get remindersSent(): string[] | undefined {
    return this._remindersSent ? [...this._remindersSent] : undefined;
  }

  get status(): ScheduleStatus {
    return this._status;
  }

  get notificationSent(): boolean {
    return this._notificationSent || false;
  }

  get totalResponses(): number {
    return this._totalResponses || 0;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // ビジネスロジック
  isOpen(): boolean {
    return this._status === ScheduleStatus.OPEN;
  }

  isClosed(): boolean {
    return this._status === ScheduleStatus.CLOSED;
  }

  hasDeadline(): boolean {
    return this._deadline !== undefined;
  }

  isDeadlinePassed(currentTime: Date = new Date()): boolean {
    return this._deadline ? this._deadline < currentTime : false;
  }

  canBeEditedBy(userId: string): boolean {
    return this._authorId === userId;
  }

  // 更新メソッド
  close(): Schedule {
    return new Schedule(
      this._id,
      this._guildId,
      this._channelId,
      this._title,
      this._dates,
      this._createdBy,
      this._authorId,
      ScheduleStatus.CLOSED,
      this._createdAt,
      new Date(),
      this._messageId,
      this._description,
      this._deadline,
      this._reminderTimings,
      this._reminderMentions,
      this._remindersSent,
      this._notificationSent,
      this._totalResponses
    );
  }

  updateTitle(title: string): Schedule {
    if (!title.trim()) {
      throw new Error('Title cannot be empty');
    }

    return new Schedule(
      this._id,
      this._guildId,
      this._channelId,
      { value: title },
      this._dates,
      this._createdBy,
      this._authorId,
      this._status,
      this._createdAt,
      new Date(),
      this._messageId,
      this._description,
      this._deadline,
      this._reminderTimings,
      this._reminderMentions,
      this._remindersSent,
      this._notificationSent,
      this._totalResponses
    );
  }

  updateDescription(description?: string): Schedule {
    return new Schedule(
      this._id,
      this._guildId,
      this._channelId,
      this._title,
      this._dates,
      this._createdBy,
      this._authorId,
      this._status,
      this._createdAt,
      new Date(),
      this._messageId,
      description ? { value: description } : undefined,
      this._deadline,
      this._reminderTimings,
      this._reminderMentions,
      this._remindersSent,
      this._notificationSent,
      this._totalResponses
    );
  }

  updateDeadline(deadline: Date | null | undefined): Schedule {
    // 締切日時に基づいてステータスを更新（旧実装の動作を再現）
    let newStatus = this._status;
    if (!deadline || deadline > new Date()) {
      // 締切がない、または未来の場合は open にする
      newStatus = ScheduleStatus.OPEN;
    } else {
      // 締切が過去の場合は closed にする
      newStatus = ScheduleStatus.CLOSED;
    }

    return new Schedule(
      this._id,
      this._guildId,
      this._channelId,
      this._title,
      this._dates,
      this._createdBy,
      this._authorId,
      newStatus,
      this._createdAt,
      new Date(),
      this._messageId,
      this._description,
      deadline === null ? undefined : deadline,
      this._reminderTimings,
      this._reminderMentions,
      [], // remindersSent をリセット
      this._notificationSent,
      this._totalResponses
    );
  }

  addDate(date: ScheduleDate): Schedule {
    // 重複チェック
    if (this._dates.some((d) => d.equals(date))) {
      throw new Error('Date already exists in schedule');
    }

    return new Schedule(
      this._id,
      this._guildId,
      this._channelId,
      this._title,
      [...this._dates, date],
      this._createdBy,
      this._authorId,
      this._status,
      this._createdAt,
      new Date(),
      this._messageId,
      this._description,
      this._deadline,
      this._reminderTimings,
      this._reminderMentions,
      this._remindersSent,
      this._notificationSent,
      this._totalResponses
    );
  }

  updateTotalResponses(totalResponses: number): Schedule {
    return new Schedule(
      this._id,
      this._guildId,
      this._channelId,
      this._title,
      this._dates,
      this._createdBy,
      this._authorId,
      this._status,
      this._createdAt,
      new Date(),
      this._messageId,
      this._description,
      this._deadline,
      this._reminderTimings,
      this._reminderMentions,
      this._remindersSent,
      this._notificationSent,
      totalResponses
    );
  }

  updateMessageId(messageId: string): Schedule {
    return new Schedule(
      this._id,
      this._guildId,
      this._channelId,
      this._title,
      this._dates,
      this._createdBy,
      this._authorId,
      this._status,
      this._createdAt,
      new Date(),
      { value: messageId },
      this._description,
      this._deadline,
      this._reminderTimings,
      this._reminderMentions,
      this._remindersSent,
      this._notificationSent,
      this._totalResponses
    );
  }

  updateDates(dates: ScheduleDate[]): Schedule {
    if (dates.length === 0) {
      throw new Error('Schedule must have at least one date');
    }

    return new Schedule(
      this._id,
      this._guildId,
      this._channelId,
      this._title,
      dates,
      this._createdBy,
      this._authorId,
      this._status,
      this._createdAt,
      new Date(),
      this._messageId,
      this._description,
      this._deadline,
      this._reminderTimings,
      this._reminderMentions,
      this._remindersSent,
      this._notificationSent,
      this._totalResponses
    );
  }

  updateReminderSettings(timings?: string[], mentions?: string[]): Schedule {
    return new Schedule(
      this._id,
      this._guildId,
      this._channelId,
      this._title,
      this._dates,
      this._createdBy,
      this._authorId,
      this._status,
      this._createdAt,
      new Date(),
      this._messageId,
      this._description,
      this._deadline,
      timings,
      mentions,
      this._remindersSent,
      this._notificationSent,
      this._totalResponses
    );
  }

  resetReminders(): Schedule {
    return new Schedule(
      this._id,
      this._guildId,
      this._channelId,
      this._title,
      this._dates,
      this._createdBy,
      this._authorId,
      this._status,
      this._createdAt,
      new Date(),
      this._messageId,
      this._description,
      this._deadline,
      this._reminderTimings,
      this._reminderMentions,
      [], // Reset remindersSent
      this._notificationSent,
      this._totalResponses
    );
  }

  toPrimitives(): DomainSchedule {
    return {
      id: this.id,
      guildId: this.guildId,
      channelId: this.channelId,
      messageId: this.messageId,
      title: this.title,
      description: this.description,
      dates: this.dates.map((d) => d.toPrimitives()),
      createdBy: this.createdBy.toPrimitives(),
      authorId: this.authorId,
      deadline: this.deadline,
      reminderTimings: this.reminderTimings,
      reminderMentions: this.reminderMentions,
      remindersSent: this.remindersSent,
      status: this.status,
      notificationSent: this.notificationSent,
      totalResponses: this.totalResponses,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  equals(other: Schedule): boolean {
    return this.id === other.id;
  }
}

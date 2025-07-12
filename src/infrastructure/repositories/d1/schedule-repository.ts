/**
 * D1実装のスケジュールリポジトリ
 */

import { TIME_CONSTANTS } from '../../../constants/ApplicationConstants';
import type { IScheduleRepository } from '../../../domain/repositories/interfaces';
import type { DomainSchedule, DomainScheduleDate } from '../../../domain/types/DomainTypes';
import { RepositoryError } from '../errors';

// Database row types
interface ScheduleRow {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id?: string;
  title: string;
  description?: string;
  created_by_id: string;
  created_by_username: string;
  author_id: string;
  deadline?: number;
  reminder_timings?: string;
  reminder_mentions?: string;
  reminders_sent?: string;
  status: string;
  notification_sent: number;
  total_responses: number;
  created_at: number;
  updated_at: number;
  expires_at: number;
}

interface ScheduleDateRow {
  date_id: string;
  datetime: string;
}

export class D1ScheduleRepository implements IScheduleRepository {
  constructor(private db: D1Database) {}

  async save(schedule: DomainSchedule): Promise<void> {
    const guildId = schedule.guildId || 'default';

    // Calculate expiration time
    const baseTime = schedule.deadline ? schedule.deadline.getTime() : schedule.createdAt.getTime();
    const expiresAt =
      Math.floor(baseTime / TIME_CONSTANTS.MILLISECONDS_PER_SECOND) +
      TIME_CONSTANTS.SIX_MONTHS_SECONDS;

    try {
      // Start transaction
      const tx = await this.db.batch([
        // Delete existing schedule dates if updating
        this.db
          .prepare('DELETE FROM schedule_dates WHERE schedule_id = ?')
          .bind(schedule.id),

        // Insert or update schedule
        this.db
          .prepare(`
          INSERT INTO schedules (
            id, guild_id, channel_id, message_id, title, description,
            created_by_id, created_by_username, author_id,
            deadline, reminder_timings, reminder_mentions, reminders_sent,
            status, notification_sent, total_responses,
            created_at, updated_at, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            channel_id = excluded.channel_id,
            message_id = excluded.message_id,
            title = excluded.title,
            description = excluded.description,
            deadline = excluded.deadline,
            reminder_timings = excluded.reminder_timings,
            reminder_mentions = excluded.reminder_mentions,
            reminders_sent = excluded.reminders_sent,
            status = excluded.status,
            notification_sent = excluded.notification_sent,
            total_responses = excluded.total_responses,
            updated_at = excluded.updated_at,
            expires_at = excluded.expires_at
        `)
          .bind(
            schedule.id,
            guildId,
            schedule.channelId,
            schedule.messageId || null,
            schedule.title,
            schedule.description || null,
            schedule.createdBy.id,
            schedule.createdBy.username,
            schedule.authorId,
            schedule.deadline ? Math.floor(schedule.deadline.getTime() / 1000) : null,
            schedule.reminderTimings ? JSON.stringify(schedule.reminderTimings) : null,
            schedule.reminderMentions ? JSON.stringify(schedule.reminderMentions) : null,
            schedule.remindersSent ? JSON.stringify(schedule.remindersSent) : null,
            schedule.status,
            schedule.notificationSent ? 1 : 0,
            schedule.totalResponses,
            Math.floor(schedule.createdAt.getTime() / 1000),
            Math.floor(schedule.updatedAt.getTime() / 1000),
            expiresAt
          ),

        // Insert schedule dates
        ...schedule.dates.map((date, index) =>
          this.db
            .prepare(`
            INSERT INTO schedule_dates (id, schedule_id, date_id, datetime, display_order)
            VALUES (?, ?, ?, ?, ?)
          `)
            .bind(`${schedule.id}_${date.id}`, schedule.id, date.id, date.datetime, index)
        ),
      ]);

      await tx;
    } catch (error) {
      throw new RepositoryError('Failed to save schedule', 'SAVE_ERROR', error as Error);
    }
  }

  async findById(scheduleId: string, guildId: string = 'default'): Promise<DomainSchedule | null> {
    try {
      // N+1クエリ問題を解決：JOINクエリで一度に取得
      const result = await this.db
        .prepare(`
        SELECT 
          s.id,
          s.guild_id,
          s.channel_id,
          s.message_id,
          s.title,
          s.description,
          s.created_by_id,
          s.created_by_username,
          s.author_id,
          s.deadline,
          s.reminder_timings,
          s.reminder_mentions,
          s.reminders_sent,
          s.status,
          s.notification_sent,
          s.total_responses,
          s.created_at,
          s.updated_at,
          s.expires_at,
          sd.date_id,
          sd.datetime,
          sd.display_order
        FROM schedules s
        LEFT JOIN schedule_dates sd ON s.id = sd.schedule_id
        WHERE s.id = ? AND s.guild_id = ?
        ORDER BY sd.display_order
      `)
        .bind(scheduleId, guildId)
        .all();

      if (!result.results || result.results.length === 0) return null;

      // 最初の行からスケジュール情報を取得
      const firstRow = result.results[0] as any;
      const scheduleRow: ScheduleRow = {
        id: firstRow.id,
        guild_id: firstRow.guild_id,
        channel_id: firstRow.channel_id,
        message_id: firstRow.message_id,
        title: firstRow.title,
        description: firstRow.description,
        created_by_id: firstRow.created_by_id,
        created_by_username: firstRow.created_by_username,
        author_id: firstRow.author_id,
        deadline: firstRow.deadline,
        reminder_timings: firstRow.reminder_timings,
        reminder_mentions: firstRow.reminder_mentions,
        reminders_sent: firstRow.reminders_sent,
        status: firstRow.status,
        notification_sent: firstRow.notification_sent,
        total_responses: firstRow.total_responses,
        created_at: firstRow.created_at,
        updated_at: firstRow.updated_at,
        expires_at: firstRow.expires_at,
      };

      // 日付データを抽出（date_idがnullでない場合のみ）
      const dateRows: ScheduleDateRow[] = result.results
        .filter((row: any) => row.date_id)
        .map((row: any) => ({
          date_id: row.date_id,
          datetime: row.datetime,
          display_order: row.display_order,
        }));

      return this.mapRowToSchedule(scheduleRow, dateRows);
    } catch (error) {
      throw new RepositoryError('Failed to find schedule', 'FIND_ERROR', error as Error);
    }
  }

  async findByChannel(
    channelId: string,
    guildId: string = 'default',
    limit: number = 100
  ): Promise<DomainSchedule[]> {
    try {
      const result = await this.db
        .prepare(`
        SELECT * FROM schedules 
        WHERE guild_id = ? AND channel_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `)
        .bind(guildId, channelId, limit)
        .all();

      // Optimize: Execute date queries in parallel instead of sequentially
      const scheduleRows = result.results as unknown as ScheduleRow[];
      const dateQueries = scheduleRows.map((row) =>
        this.db
          .prepare(`
          SELECT date_id, datetime FROM schedule_dates 
          WHERE schedule_id = ? 
          ORDER BY display_order
        `)
          .bind(row.id)
          .all()
      );

      const dateResults = await Promise.all(dateQueries);

      const schedules: DomainSchedule[] = [];
      for (let i = 0; i < scheduleRows.length; i++) {
        const schedule = this.mapRowToSchedule(
          scheduleRows[i],
          dateResults[i].results as unknown as ScheduleDateRow[]
        );
        if (schedule) schedules.push(schedule);
      }

      return schedules;
    } catch (error) {
      throw new RepositoryError(
        'Failed to find schedules by channel',
        'FIND_ERROR',
        error as Error
      );
    }
  }

  async findByDeadlineRange(
    startTime: Date,
    endTime: Date,
    guildId?: string
  ): Promise<DomainSchedule[]> {
    try {
      const startTimestamp = Math.floor(startTime.getTime() / 1000);
      const endTimestamp = Math.floor(endTime.getTime() / 1000);

      let query = `
        SELECT * FROM schedules 
        WHERE deadline >= ? AND deadline <= ? AND status = 'open'
      `;
      const params: (number | string)[] = [startTimestamp, endTimestamp];

      if (guildId) {
        query += ' AND guild_id = ?';
        params.push(guildId);
      }

      query += ' ORDER BY deadline ASC';

      const result = await this.db
        .prepare(query)
        .bind(...params)
        .all();

      // Optimize: Execute date queries in parallel instead of sequentially
      const scheduleRows = result.results as unknown as ScheduleRow[];
      const dateQueries = scheduleRows.map((row) =>
        this.db
          .prepare(`
          SELECT date_id, datetime FROM schedule_dates 
          WHERE schedule_id = ? 
          ORDER BY display_order
        `)
          .bind(row.id)
          .all()
      );

      const dateResults = await Promise.all(dateQueries);

      const schedules: DomainSchedule[] = [];
      for (let i = 0; i < scheduleRows.length; i++) {
        const schedule = this.mapRowToSchedule(
          scheduleRows[i],
          dateResults[i].results as unknown as ScheduleDateRow[]
        );
        if (schedule) schedules.push(schedule);
      }

      return schedules;
    } catch (error) {
      throw new RepositoryError(
        'Failed to find schedules by deadline',
        'FIND_ERROR',
        error as Error
      );
    }
  }

  async delete(scheduleId: string, guildId: string = 'default'): Promise<void> {
    try {
      // Cascading delete will handle related tables
      await this.db
        .prepare(`
        DELETE FROM schedules 
        WHERE id = ? AND guild_id = ?
      `)
        .bind(scheduleId, guildId)
        .run();
    } catch (error) {
      throw new RepositoryError('Failed to delete schedule', 'DELETE_ERROR', error as Error);
    }
  }

  async findByMessageId(messageId: string, guildId: string): Promise<DomainSchedule | null> {
    try {
      const scheduleRow = await this.db
        .prepare(`
        SELECT * FROM schedules 
        WHERE message_id = ? AND guild_id = ?
      `)
        .bind(messageId, guildId)
        .first();

      if (!scheduleRow) return null;

      const datesResult = await this.db
        .prepare(`
        SELECT date_id, datetime FROM schedule_dates 
        WHERE schedule_id = ? 
        ORDER BY display_order
      `)
        .bind(scheduleRow.id)
        .all();

      return this.mapRowToSchedule(
        scheduleRow as unknown as ScheduleRow,
        datesResult.results as unknown as ScheduleDateRow[]
      );
    } catch (error) {
      throw new RepositoryError(
        'Failed to find schedule by message ID',
        'FIND_ERROR',
        error as Error
      );
    }
  }

  async countByGuild(guildId: string, status?: string): Promise<number> {
    try {
      let query = `
        SELECT COUNT(*) as count FROM schedules 
        WHERE guild_id = ?
      `;
      const params: string[] = [guildId];

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      const result = await this.db
        .prepare(query)
        .bind(...params)
        .first();

      return Number(result?.count) || 0;
    } catch (error) {
      throw new RepositoryError('Failed to count schedules', 'COUNT_ERROR', error as Error);
    }
  }

  async updateReminders(params: {
    scheduleId: string;
    guildId: string;
    remindersSent: string[];
    reminderSent?: boolean;
  }): Promise<void> {
    try {
      const remindersSentJson = JSON.stringify(params.remindersSent);
      const updatedAt = Math.floor(Date.now() / 1000);

      await this.db
        .prepare(`
        UPDATE schedules 
        SET 
          reminders_sent = ?,
          updated_at = ?
        WHERE id = ? AND guild_id = ?
      `)
        .bind(remindersSentJson, updatedAt, params.scheduleId, params.guildId)
        .run();
    } catch (error) {
      throw new RepositoryError('Failed to update reminders', 'UPDATE_ERROR', error as Error);
    }
  }

  /**
   * Map database row to Schedule object
   */
  private mapRowToSchedule(row: ScheduleRow, dateRows: ScheduleDateRow[]): DomainSchedule | null {
    if (!row) return null;

    const dates: DomainScheduleDate[] = dateRows.map((dateRow) => ({
      id: dateRow.date_id,
      datetime: dateRow.datetime,
    }));

    return {
      id: row.id,
      guildId: row.guild_id,
      channelId: row.channel_id,
      messageId: row.message_id || undefined,
      title: row.title,
      description: row.description || undefined,
      dates,
      createdBy: {
        id: row.created_by_id,
        username: row.created_by_username,
      },
      authorId: row.author_id,
      deadline: row.deadline ? new Date(row.deadline * 1000) : undefined,
      reminderTimings: row.reminder_timings ? JSON.parse(row.reminder_timings) : undefined,
      reminderMentions: row.reminder_mentions ? JSON.parse(row.reminder_mentions) : undefined,
      remindersSent: row.reminders_sent ? JSON.parse(row.reminders_sent) : undefined,
      status: row.status as 'open' | 'closed',
      notificationSent: row.notification_sent === 1,
      totalResponses: row.total_responses,
      createdAt: new Date(row.created_at * 1000),
      updatedAt: new Date(row.updated_at * 1000),
    };
  }
}

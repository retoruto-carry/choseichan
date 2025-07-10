/**
 * D1実装のスケジュールリポジトリ
 */

import { IScheduleRepository, NotFoundError, RepositoryError } from '../../../domain/repositories/interfaces';
import { Schedule, ScheduleDate } from '../../../types/schedule-v2';
import { TIME_CONSTANTS } from '../../../constants';

export class D1ScheduleRepository implements IScheduleRepository {
  constructor(private db: D1Database) {}

  async save(schedule: Schedule): Promise<void> {
    const guildId = schedule.guildId || 'default';
    
    // Calculate expiration time
    const baseTime = schedule.deadline ? schedule.deadline.getTime() : schedule.createdAt.getTime();
    const expiresAt = Math.floor(baseTime / TIME_CONSTANTS.MILLISECONDS_PER_SECOND) + TIME_CONSTANTS.SIX_MONTHS_SECONDS;
    
    try {
      // Start transaction
      const tx = await this.db.batch([
        // Delete existing schedule dates if updating
        this.db.prepare('DELETE FROM schedule_dates WHERE schedule_id = ?').bind(schedule.id),
        
        // Insert or update schedule
        this.db.prepare(`
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
        `).bind(
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
          this.db.prepare(`
            INSERT INTO schedule_dates (id, schedule_id, date_id, datetime, display_order)
            VALUES (?, ?, ?, ?, ?)
          `).bind(
            `${schedule.id}_${date.id}`,
            schedule.id,
            date.id,
            date.datetime,
            index
          )
        )
      ]);
      
      await tx;
    } catch (error) {
      throw new RepositoryError('Failed to save schedule', 'SAVE_ERROR', error as Error);
    }
  }

  async findById(scheduleId: string, guildId: string = 'default'): Promise<Schedule | null> {
    try {
      // Get schedule data
      const scheduleRow = await this.db.prepare(`
        SELECT * FROM schedules 
        WHERE id = ? AND guild_id = ?
      `).bind(scheduleId, guildId).first();
      
      if (!scheduleRow) return null;
      
      // Get schedule dates
      const datesResult = await this.db.prepare(`
        SELECT date_id, datetime FROM schedule_dates 
        WHERE schedule_id = ? 
        ORDER BY display_order
      `).bind(scheduleId).all();
      
      return this.mapRowToSchedule(scheduleRow, datesResult.results);
    } catch (error) {
      throw new RepositoryError('Failed to find schedule', 'FIND_ERROR', error as Error);
    }
  }

  async findByChannel(channelId: string, guildId: string = 'default', limit: number = 100): Promise<Schedule[]> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM schedules 
        WHERE guild_id = ? AND channel_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `).bind(guildId, channelId, limit).all();
      
      const schedules: Schedule[] = [];
      for (const row of result.results) {
        const datesResult = await this.db.prepare(`
          SELECT date_id, datetime FROM schedule_dates 
          WHERE schedule_id = ? 
          ORDER BY display_order
        `).bind(row.id).all();
        
        const schedule = this.mapRowToSchedule(row, datesResult.results);
        if (schedule) schedules.push(schedule);
      }
      
      return schedules;
    } catch (error) {
      throw new RepositoryError('Failed to find schedules by channel', 'FIND_ERROR', error as Error);
    }
  }

  async findByDeadlineRange(
    startTime: Date, 
    endTime: Date, 
    guildId?: string
  ): Promise<Schedule[]> {
    try {
      const startTimestamp = Math.floor(startTime.getTime() / 1000);
      const endTimestamp = Math.floor(endTime.getTime() / 1000);
      
      let query = `
        SELECT * FROM schedules 
        WHERE deadline >= ? AND deadline <= ? AND status = 'open'
      `;
      const params: any[] = [startTimestamp, endTimestamp];
      
      if (guildId) {
        query += ' AND guild_id = ?';
        params.push(guildId);
      }
      
      query += ' ORDER BY deadline ASC';
      
      const result = await this.db.prepare(query).bind(...params).all();
      
      const schedules: Schedule[] = [];
      for (const row of result.results) {
        const datesResult = await this.db.prepare(`
          SELECT date_id, datetime FROM schedule_dates 
          WHERE schedule_id = ? 
          ORDER BY display_order
        `).bind(row.id).all();
        
        const schedule = this.mapRowToSchedule(row, datesResult.results);
        if (schedule) schedules.push(schedule);
      }
      
      return schedules;
    } catch (error) {
      throw new RepositoryError('Failed to find schedules by deadline', 'FIND_ERROR', error as Error);
    }
  }

  async delete(scheduleId: string, guildId: string = 'default'): Promise<void> {
    try {
      // Cascading delete will handle related tables
      await this.db.prepare(`
        DELETE FROM schedules 
        WHERE id = ? AND guild_id = ?
      `).bind(scheduleId, guildId).run();
    } catch (error) {
      throw new RepositoryError('Failed to delete schedule', 'DELETE_ERROR', error as Error);
    }
  }

  async findByMessageId(messageId: string, guildId: string): Promise<Schedule | null> {
    try {
      const scheduleRow = await this.db.prepare(`
        SELECT * FROM schedules 
        WHERE message_id = ? AND guild_id = ?
      `).bind(messageId, guildId).first();
      
      if (!scheduleRow) return null;
      
      const datesResult = await this.db.prepare(`
        SELECT date_id, datetime FROM schedule_dates 
        WHERE schedule_id = ? 
        ORDER BY display_order
      `).bind(scheduleRow.id).all();
      
      return this.mapRowToSchedule(scheduleRow, datesResult.results);
    } catch (error) {
      throw new RepositoryError('Failed to find schedule by message ID', 'FIND_ERROR', error as Error);
    }
  }

  async countByGuild(guildId: string): Promise<number> {
    try {
      const result = await this.db.prepare(`
        SELECT COUNT(*) as count FROM schedules 
        WHERE guild_id = ?
      `).bind(guildId).first();
      
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
      
      await this.db.prepare(`
        UPDATE schedules 
        SET 
          reminders_sent = ?,
          updated_at = ?
        WHERE id = ? AND guild_id = ?
      `).bind(
        remindersSentJson,
        updatedAt,
        params.scheduleId,
        params.guildId
      ).run();
    } catch (error) {
      throw new RepositoryError('Failed to update reminders', 'UPDATE_ERROR', error as Error);
    }
  }

  /**
   * Map database row to Schedule object
   */
  private mapRowToSchedule(row: any, dateRows: any[]): Schedule | null {
    if (!row) return null;
    
    const dates: ScheduleDate[] = dateRows.map(dateRow => ({
      id: dateRow.date_id,
      datetime: dateRow.datetime
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
        username: row.created_by_username
      },
      authorId: row.author_id,
      deadline: row.deadline ? new Date(row.deadline * 1000) : undefined,
      reminderTimings: row.reminder_timings ? JSON.parse(row.reminder_timings) : undefined,
      reminderMentions: row.reminder_mentions ? JSON.parse(row.reminder_mentions) : undefined,
      remindersSent: row.reminders_sent ? JSON.parse(row.reminders_sent) : undefined,
      status: row.status,
      notificationSent: row.notification_sent === 1,
      totalResponses: row.total_responses,
      createdAt: new Date(row.created_at * 1000),
      updatedAt: new Date(row.updated_at * 1000)
    };
  }
}
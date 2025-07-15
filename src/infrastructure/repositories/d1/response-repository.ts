/**
 * D1実装のレスポンスリポジトリ
 */

import { TIME_CONSTANTS } from '../../../application/constants/ApplicationConstants';
import type {
  IResponseRepository,
  IScheduleRepository,
} from '../../../domain/repositories/interfaces';
import type {
  DomainResponse,
  DomainResponseStatus,
  DomainScheduleDate,
  DomainScheduleSummary,
} from '../../../domain/types/DomainTypes';
import { RepositoryError } from '../errors';

export class D1ResponseRepository implements IResponseRepository {
  constructor(
    private db: D1Database,
    private scheduleRepository: IScheduleRepository
  ) {}

  async save(response: DomainResponse, guildId: string = 'default'): Promise<void> {
    // Get schedule to determine expiration time
    const schedule = await this.scheduleRepository.findById(response.scheduleId, guildId);
    if (!schedule) {
      throw new RepositoryError('Schedule not found', 'NOT_FOUND');
    }

    const baseTime = schedule.deadline ? schedule.deadline.getTime() : schedule.createdAt.getTime();
    const expiresAt =
      Math.floor(baseTime / TIME_CONSTANTS.MILLISECONDS_PER_SECOND) +
      TIME_CONSTANTS.SIX_MONTHS_SECONDS;

    try {
      // First, insert or update the response
      const responseResult = await this.db
        .prepare(`
        INSERT INTO responses (
          schedule_id, guild_id, user_id, username, display_name, 
          updated_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(schedule_id, user_id) DO UPDATE SET
          username = excluded.username,
          display_name = excluded.display_name,
          updated_at = excluded.updated_at,
          expires_at = excluded.expires_at
        RETURNING id
      `)
        .bind(
          response.scheduleId,
          guildId,
          response.userId,
          response.username,
          response.displayName || null,
          Math.floor(response.updatedAt.getTime() / 1000),
          expiresAt
        )
        .first<{ id: number }>();

      if (!responseResult) {
        throw new Error('Failed to insert/update response');
      }

      const responseId = responseResult.id;

      // Delete existing date statuses
      await this.db
        .prepare(`
        DELETE FROM response_date_status 
        WHERE response_id = ?
      `)
        .bind(responseId)
        .run();

      // Insert new date statuses
      const statusInserts = Object.entries(response.dateStatuses).map(([dateId, status]) =>
        this.db
          .prepare(`
          INSERT INTO response_date_status (response_id, date_id, status)
          VALUES (?, ?, ?)
        `)
          .bind(responseId, dateId, status)
      );

      if (statusInserts.length > 0) {
        await this.db.batch(statusInserts);
      }
    } catch (error) {
      throw new RepositoryError('Failed to save response', 'SAVE_ERROR', error as Error);
    }
  }

  async findByUser(
    scheduleId: string,
    userId: string,
    guildId: string = 'default'
  ): Promise<DomainResponse | null> {
    try {
      const responseRow = await this.db
        .prepare(`
        SELECT * FROM responses 
        WHERE schedule_id = ? AND user_id = ? AND guild_id = ?
      `)
        .bind(scheduleId, userId, guildId)
        .first();

      if (!responseRow) return null;

      // Get date statuses
      const statusResult = await this.db
        .prepare(`
        SELECT date_id, status FROM response_date_status 
        WHERE response_id = ?
      `)
        .bind(responseRow.id)
        .all();

      return this.mapRowToResponse(responseRow, statusResult.results);
    } catch (error) {
      throw new RepositoryError('Failed to find response', 'FIND_ERROR', error as Error);
    }
  }

  async findByScheduleId(
    scheduleId: string,
    guildId: string = 'default'
  ): Promise<DomainResponse[]> {
    try {
      // まず基本的なレスポンス情報を取得
      const responseResult = await this.db
        .prepare(`
        SELECT * FROM responses 
        WHERE schedule_id = ? AND guild_id = ?
        ORDER BY updated_at DESC
      `)
        .bind(scheduleId, guildId)
        .all();

      if (!responseResult.results || responseResult.results.length === 0) {
        return [];
      }

      // 次に、すべてのレスポンスの日付ステータスを一度に取得
      const responseIds = responseResult.results.map((row: any) => row.id);
      const placeholders = responseIds.map(() => '?').join(',');

      const statusResult = await this.db
        .prepare(`
        SELECT response_id, date_id, status 
        FROM response_date_status 
        WHERE response_id IN (${placeholders})
      `)
        .bind(...responseIds)
        .all();

      // ステータスマップを作成
      const statusMap = new Map<string, Record<string, DomainResponseStatus>>();
      for (const row of statusResult.results as any[]) {
        if (!statusMap.has(row.response_id)) {
          statusMap.set(row.response_id, {});
        }
        const responseStatuses = statusMap.get(row.response_id);
        if (responseStatuses) {
          responseStatuses[row.date_id] = row.status;
        }
      }

      // DomainResponseオブジェクトを構築
      const responses: DomainResponse[] = [];
      for (const row of responseResult.results as any[]) {
        const response = this.mapRowToResponse(row, []);
        if (response) {
          // ステータスマップから日付ステータスを設定
          response.dateStatuses = statusMap.get(row.id) || {};
          responses.push(response);
        }
      }

      return responses;
    } catch (error) {
      throw new RepositoryError('Failed to find responses', 'FIND_ERROR', error as Error);
    }
  }

  async delete(scheduleId: string, userId: string, guildId: string = 'default'): Promise<void> {
    try {
      await this.db
        .prepare(`
        DELETE FROM responses 
        WHERE schedule_id = ? AND user_id = ? AND guild_id = ?
      `)
        .bind(scheduleId, userId, guildId)
        .run();
    } catch (error) {
      throw new RepositoryError('Failed to delete response', 'DELETE_ERROR', error as Error);
    }
  }

  async deleteBySchedule(scheduleId: string, guildId: string = 'default'): Promise<void> {
    try {
      await this.db
        .prepare(`
        DELETE FROM responses 
        WHERE schedule_id = ? AND guild_id = ?
      `)
        .bind(scheduleId, guildId)
        .run();
    } catch (error) {
      throw new RepositoryError('Failed to delete responses', 'DELETE_ERROR', error as Error);
    }
  }

  async getScheduleSummary(
    scheduleId: string,
    guildId: string = 'default'
  ): Promise<DomainScheduleSummary | null> {
    const schedule = await this.scheduleRepository.findById(scheduleId, guildId);
    if (!schedule) return null;

    try {
      // Get response counts using direct query instead of view for better reliability
      const countResult = await this.db
        .prepare(`
        SELECT 
          sd.date_id,
          rds.status,
          COUNT(*) as count
        FROM schedule_dates sd
        LEFT JOIN responses r ON sd.schedule_id = r.schedule_id
        LEFT JOIN response_date_status rds ON r.id = rds.response_id AND sd.date_id = rds.date_id
        WHERE sd.schedule_id = ? AND rds.status IS NOT NULL
        GROUP BY sd.date_id, rds.status
      `)
        .bind(scheduleId)
        .all();

      // Initialize response counts
      const responseCounts: Record<string, Record<DomainResponseStatus, number>> = {};
      for (const date of schedule.dates) {
        responseCounts[date.id] = {
          ok: 0,
          maybe: 0,
          ng: 0,
        };
      }

      // Fill in actual counts
      for (const row of countResult.results) {
        const dateId = row.date_id as string;
        const status = row.status as DomainResponseStatus;
        const count = Number(row.count);

        if (responseCounts[dateId]) {
          responseCounts[dateId][status] = count;
        }
      }

      // Get user responses
      const userResponsesResult = await this.db
        .prepare(`
        SELECT 
          r.user_id,
          rds.date_id,
          rds.status
        FROM responses r
        JOIN response_date_status rds ON r.id = rds.response_id
        WHERE r.schedule_id = ? AND r.guild_id = ?
      `)
        .bind(scheduleId, guildId)
        .all();

      const userResponses: Record<string, Record<string, DomainResponseStatus>> = {};
      for (const row of userResponsesResult.results) {
        const userId = row.user_id as string;
        const dateId = row.date_id as string;
        const status = row.status as DomainResponseStatus;

        if (!userResponses[userId]) {
          userResponses[userId] = {};
        }
        userResponses[userId][dateId] = status;
      }

      // Get total response count
      const totalResult = await this.db
        .prepare(`
        SELECT COUNT(DISTINCT user_id) as total 
        FROM responses 
        WHERE schedule_id = ? AND guild_id = ?
      `)
        .bind(scheduleId, guildId)
        .first();

      // Get all responses for the summary
      const responses = await this.findByScheduleId(scheduleId, guildId);

      // Calculate statistics
      const statistics = this.calculateStatistics(responses, responseCounts, schedule.dates);

      return {
        schedule,
        responses,
        responseCounts,
        totalResponseUsers: Number(totalResult?.total) || 0,
        bestDateId: statistics.optimalDates.optimalDateId,
        statistics,
      };
    } catch (error) {
      throw new RepositoryError('Failed to get schedule summary', 'SUMMARY_ERROR', error as Error);
    }
  }

  /**
   * Map database row to Response object
   */
  private mapRowToResponse(row: unknown, statusRows: unknown[]): DomainResponse | null {
    if (!row || typeof row !== 'object') return null;

    const r = row as Record<string, unknown>;

    const dateStatuses: Record<string, DomainResponseStatus> = {};
    for (const statusRow of statusRows) {
      if (typeof statusRow === 'object' && statusRow !== null) {
        const sr = statusRow as Record<string, unknown>;
        if (typeof sr.date_id === 'string' && typeof sr.status === 'string') {
          dateStatuses[sr.date_id] = sr.status as DomainResponseStatus;
        }
      }
    }

    return {
      scheduleId: r.schedule_id as string,
      userId: r.user_id as string,
      username: r.username as string,
      displayName: (r.display_name as string) || undefined,
      dateStatuses,
      updatedAt: new Date((r.updated_at as number) * 1000),
    };
  }

  /**
   * Calculate statistics for schedule summary
   */
  private calculateStatistics(
    responses: DomainResponse[],
    responseCounts: Record<string, Record<string, number>>,
    dates: DomainScheduleDate[]
  ): DomainScheduleSummary['statistics'] {
    // Overall participation calculation
    let fullyAvailable = 0;
    let partiallyAvailable = 0;
    let unavailable = 0;

    for (const response of responses) {
      const statuses = Object.values(response.dateStatuses);
      if (statuses.every((s) => s === 'ok')) {
        fullyAvailable++;
      } else if (statuses.some((s) => s === 'ok' || s === 'maybe')) {
        partiallyAvailable++;
      } else {
        unavailable++;
      }
    }

    // Optimal dates calculation
    const scores: Record<string, number> = {};
    for (const date of dates) {
      const counts = responseCounts[date.id] || { ok: 0, maybe: 0, ng: 0 };
      scores[date.id] = counts.ok * 2 + counts.maybe * 1;
    }

    const sortedDates = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([dateId]) => dateId);

    return {
      overallParticipation: {
        fullyAvailable,
        partiallyAvailable,
        unavailable,
      },
      optimalDates: {
        optimalDateId: sortedDates[0],
        alternativeDateIds: sortedDates.slice(1, 3),
        scores,
      },
    };
  }
}

/**
 * Mock Repository Factory for Unit Tests
 *
 * ユニットテスト用のモックリポジトリファクトリ
 * DIパターンを使用したテストを支援
 */

import type {
  FindByChannelOptions,
  FindByDeadlineRangeOptions,
  IRepositoryFactory,
  IResponseRepository,
  IScheduleRepository,
} from '../../src/domain/repositories/interfaces';
import type {
  DomainResponse,
  DomainSchedule,
  DomainScheduleSummary,
} from '../../src/domain/types/DomainTypes';

export class MockScheduleRepository implements IScheduleRepository {
  private schedules: Map<string, DomainSchedule> = new Map();

  async save(schedule: DomainSchedule): Promise<void> {
    this.schedules.set(schedule.id, schedule);
  }

  async findById(scheduleId: string, _guildId: string): Promise<DomainSchedule | null> {
    return this.schedules.get(scheduleId) || null;
  }

  async findByChannel(options: FindByChannelOptions): Promise<DomainSchedule[]> {
    const { channelId, guildId, limit } = options;
    return Array.from(this.schedules.values())
      .filter((s) => s.channelId === channelId && s.guildId === guildId)
      .slice(0, limit || 100);
  }

  async findByDeadlineRange(options: FindByDeadlineRangeOptions): Promise<DomainSchedule[]> {
    const { startTime, endTime, guildId } = options;
    return Array.from(this.schedules.values())
      .filter((s) => s.deadline && s.deadline >= startTime && s.deadline <= endTime)
      .filter((s) => !guildId || s.guildId === guildId);
  }

  async delete(scheduleId: string, _guildId: string): Promise<void> {
    this.schedules.delete(scheduleId);
  }

  async findByMessageId(messageId: string, guildId: string): Promise<DomainSchedule | null> {
    return (
      Array.from(this.schedules.values()).find(
        (s) => s.messageId === messageId && s.guildId === guildId
      ) || null
    );
  }

  async countByGuild(guildId: string): Promise<number> {
    return Array.from(this.schedules.values()).filter((s) => s.guildId === guildId).length;
  }

  async updateReminders(params: {
    scheduleId: string;
    guildId: string;
    remindersSent: string[];
    reminderSent?: boolean;
  }): Promise<void> {
    const schedule = this.schedules.get(params.scheduleId);
    if (schedule) {
      this.schedules.set(params.scheduleId, {
        ...schedule,
        remindersSent: params.remindersSent,
      });
    }
  }

  // テスト用ヘルパーメソッド
  clear() {
    this.schedules.clear();
  }

  getAll() {
    return Array.from(this.schedules.values());
  }

  has(scheduleId: string) {
    return this.schedules.has(scheduleId);
  }
}

export class MockResponseRepository implements IResponseRepository {
  private responses: Map<string, DomainResponse> = new Map();

  async save(response: DomainResponse, _guildId: string): Promise<void> {
    const key = `${response.scheduleId}:${response.userId}`;
    this.responses.set(key, response);
  }

  async findByUser(params: {
    scheduleId: string;
    userId: string;
    guildId?: string;
  }): Promise<DomainResponse | null> {
    const key = `${params.scheduleId}:${params.userId}`;
    return this.responses.get(key) || null;
  }

  async findByScheduleId(scheduleId: string, _guildId: string): Promise<DomainResponse[]> {
    return Array.from(this.responses.values()).filter((r) => r.scheduleId === scheduleId);
  }

  async delete(params: { scheduleId: string; userId: string; guildId?: string }): Promise<void> {
    const key = `${params.scheduleId}:${params.userId}`;
    this.responses.delete(key);
  }

  async deleteBySchedule(scheduleId: string, _guildId: string): Promise<void> {
    const keysToDelete = Array.from(this.responses.keys()).filter((key) =>
      key.startsWith(`${scheduleId}:`)
    );

    keysToDelete.forEach((key) => this.responses.delete(key));
  }

  async getScheduleSummary(
    scheduleId: string,
    guildId: string
  ): Promise<DomainScheduleSummary | null> {
    const responses = await this.findByScheduleId(scheduleId, guildId);
    if (responses.length === 0) return null;

    // モック実装 - 実際の実装では実データから計算される
    const mockSchedule: DomainSchedule = {
      id: scheduleId,
      guildId,
      channelId: 'channel123',
      title: 'Mock Schedule',
      dates: [
        { id: 'date1', datetime: '2024-12-01 10:00' },
        { id: 'date2', datetime: '2024-12-02 14:00' },
      ],
      createdBy: { id: 'user123', username: 'testuser' },
      authorId: 'user123',
      status: 'open',
      notificationSent: false,
      totalResponses: responses.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const responseCounts = responses.reduce(
      (acc, response) => {
        Object.entries(response.dateStatuses).forEach(([dateId, status]) => {
          if (!acc[dateId]) {
            acc[dateId] = { ok: 0, maybe: 0, ng: 0 };
          }
          acc[dateId][status]++;
        });
        return acc;
      },
      {} as Record<string, Record<string, number>>
    );

    return {
      schedule: mockSchedule,
      responses,
      responseCounts,
      totalResponseUsers: responses.length,
      bestDateId: 'date1',
      statistics: {
        overallParticipation: {
          fullyAvailable: 0,
          partiallyAvailable: 0,
          unavailable: 0,
        },
        optimalDates: {
          optimalDateId: 'date1',
          alternativeDateIds: ['date2'],
          scores: { date1: 10, date2: 5 },
        },
      },
    };
  }

  // テスト用ヘルパーメソッド
  clear() {
    this.responses.clear();
  }

  getAll() {
    return Array.from(this.responses.values());
  }

  has(scheduleId: string, userId: string) {
    const key = `${scheduleId}:${userId}`;
    return this.responses.has(key);
  }
}

export class MockRepositoryFactory implements IRepositoryFactory {
  private scheduleRepository: MockScheduleRepository;
  private responseRepository: MockResponseRepository;

  constructor() {
    this.scheduleRepository = new MockScheduleRepository();
    this.responseRepository = new MockResponseRepository();
  }

  getScheduleRepository(): IScheduleRepository {
    return this.scheduleRepository;
  }

  getResponseRepository(): IResponseRepository {
    return this.responseRepository;
  }

  async beginTransaction() {
    // モック実装 - テストでは実際のトランザクションは不要
    return {
      async commit() {},
      async rollback() {},
    };
  }

  // テスト用ヘルパーメソッド
  clearAll() {
    this.scheduleRepository.clear();
    this.responseRepository.clear();
  }

  getScheduleRepositoryMock(): MockScheduleRepository {
    return this.scheduleRepository;
  }

  getResponseRepositoryMock(): MockResponseRepository {
    return this.responseRepository;
  }
}

/**
 * Factory function for creating mock repositories
 */
export function createMockRepositoryFactory(): MockRepositoryFactory {
  return new MockRepositoryFactory();
}

/**
 * Factory function for creating mock schedule repository
 */
export function createMockScheduleRepository(): MockScheduleRepository {
  return new MockScheduleRepository();
}

/**
 * Factory function for creating mock response repository
 */
export function createMockResponseRepository(): MockResponseRepository {
  return new MockResponseRepository();
}

/**
 * Helper function to create test schedule data
 */
export function createTestScheduleData(overrides: Partial<DomainSchedule> = {}): DomainSchedule {
  return {
    id: 'test-schedule-1',
    guildId: 'guild123',
    channelId: 'channel123',
    messageId: 'message123',
    title: 'Test Schedule',
    description: 'Test description',
    dates: [
      { id: 'date1', datetime: '2024-12-01 10:00' },
      { id: 'date2', datetime: '2024-12-02 14:00' },
    ],
    createdBy: { id: 'user123', username: 'testuser' },
    authorId: 'user123',
    deadline: new Date(Date.now() + 86400000), // 24 hours later
    reminderTimings: ['1d', '8h', '30m'],
    reminderMentions: ['@here'],
    remindersSent: [],
    status: 'open',
    notificationSent: false,
    totalResponses: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper function to create test response data
 */
export function createTestResponseData(overrides: Partial<DomainResponse> = {}): DomainResponse {
  return {
    scheduleId: 'test-schedule-1',
    userId: 'user123',
    username: 'testuser',
    displayName: 'Test User',
    dateStatuses: {
      date1: 'ok',
      date2: 'maybe',
    },
    updatedAt: new Date(),
    ...overrides,
  };
}

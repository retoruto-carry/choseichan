import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageServiceV2 } from '../../src/services/storage-v2';
import { Schedule } from '../../src/types/schedule';
import { createTestD1Database, closeTestDatabase, applyMigrations, createTestEnv } from '../helpers/d1-database';
import type { D1Database } from '../helpers/d1-database';

describe('Deadline Index Management', () => {
  let db: D1Database;
  let storage: StorageServiceV2;
  let env: any;

  beforeEach(async () => {
    db = createTestD1Database();
    await applyMigrations(db);
    env = createTestEnv(db);
    storage = new StorageServiceV2(env);
  });

  afterEach(() => {
    closeTestDatabase(db);
  });

  it('should clean up old deadline index when deadline is updated', async () => {
    const oldDeadline = new Date('2024-12-25 18:00');
    const newDeadline = new Date('2024-12-26 18:00');
    
    const existingSchedule: Schedule = {
      id: 'test-schedule',
      title: 'Test Event',
      dates: [{ id: 'date1', datetime: '2024-12-20 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: oldDeadline,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false,
      totalResponses: 0
    };
    
    // 既存のスケジュールを保存
    await storage.saveSchedule(existingSchedule);
    
    // 締切を更新
    const updatedSchedule = { ...existingSchedule, deadline: newDeadline };
    await storage.saveSchedule(updatedSchedule);
    
    // D1でスケジュールが正しく更新されているか確認
    const retrieved = await storage.getSchedule('test-schedule', 'guild123');
    expect(retrieved).toBeDefined();
    expect(retrieved?.deadline?.getTime()).toBe(newDeadline.getTime());
  });

  it('should clean up deadline index when deadline is removed', async () => {
    const oldDeadline = new Date('2024-12-25 18:00');
    
    const existingSchedule: Schedule = {
      id: 'test-schedule-2',
      title: 'Test Event 2',
      dates: [{ id: 'date1', datetime: '2024-12-20 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: oldDeadline,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false,
      totalResponses: 0
    };
    
    // 既存のスケジュールを保存
    await storage.saveSchedule(existingSchedule);
    
    // 締切を削除
    const updatedSchedule = { ...existingSchedule, deadline: undefined };
    await storage.saveSchedule(updatedSchedule);
    
    // D1でスケジュールが正しく更新されているか確認
    const retrieved = await storage.getSchedule('test-schedule-2', 'guild123');
    expect(retrieved).toBeDefined();
    expect(retrieved?.deadline).toBeUndefined();
  });

  it('should not delete deadline index if deadline remains the same', async () => {
    const deadline = new Date('2024-12-25 18:00');
    
    const existingSchedule: Schedule = {
      id: 'test-schedule-3',
      title: 'Test Event 3',
      dates: [{ id: 'date1', datetime: '2024-12-20 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: deadline,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false,
      totalResponses: 0
    };
    
    // 既存のスケジュールを保存
    await storage.saveSchedule(existingSchedule);
    
    // タイトルのみ更新（締切は同じ）
    const updatedSchedule = { ...existingSchedule, title: 'Updated Title' };
    await storage.saveSchedule(updatedSchedule);
    
    // D1でスケジュールが正しく更新されているか確認
    const retrieved = await storage.getSchedule('test-schedule-3', 'guild123');
    expect(retrieved).toBeDefined();
    expect(retrieved?.title).toBe('Updated Title');
    expect(retrieved?.deadline?.getTime()).toBe(deadline.getTime());
  });

  it('should handle new schedule with deadline correctly', async () => {
    const deadline = new Date('2024-12-30T18:00:00+09:00');  // JSTで明示的に指定
    
    const newSchedule: Schedule = {
      id: 'test-schedule-4',
      title: 'New Event',
      dates: [{ id: 'date1', datetime: '2024-12-25 19:00' }],
      createdBy: { id: 'user123', username: 'TestUser' },
      authorId: 'user123',
      channelId: 'channel123',
      guildId: 'guild123',
      deadline: deadline,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'open',
      notificationSent: false,
      totalResponses: 0
    };
    
    // 新しいスケジュールを保存
    await storage.saveSchedule(newSchedule);
    
    // D1でスケジュールが保存されているか確認
    const retrieved = await storage.getSchedule('test-schedule-4', 'guild123');
    expect(retrieved).toBeDefined();
    expect(retrieved?.deadline?.getTime()).toBe(deadline.getTime());
    
    // 締切範囲でスケジュールを検索できるか確認
    const startDate = new Date('2024-12-29T00:00:00+09:00');  // JSTで明示的に指定
    const endDate = new Date('2024-12-31T23:59:59+09:00');    // JSTで明示的に指定
    const schedulesInRange = await storage.getSchedulesWithDeadlineInRange(startDate, endDate, 'guild123');
    
    expect(schedulesInRange).toHaveLength(1);
    expect(schedulesInRange[0].id).toBe('test-schedule-4');
  });
});
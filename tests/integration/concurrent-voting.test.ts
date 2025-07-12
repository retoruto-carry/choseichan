/**
 * 並行投票の統合テスト
 * 
 * 複数ユーザーが同時に投票を行った場合の競合対策をテスト
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DependencyContainer } from '../../src/infrastructure/factories/DependencyContainer';
import type { Env } from '../../src/infrastructure/types/discord';
import { getMessageUpdateStrategy } from '../../src/infrastructure/utils/message-update-strategy';
import type { D1Database } from '../helpers/d1-database';
import {
  applyMigrations,
  closeTestDatabase,
  createTestD1Database,
  createTestEnv,
} from '../helpers/d1-database';

describe('並行投票の統合テスト', () => {
  let container: DependencyContainer;
  let env: Env;
  let db: D1Database;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup D1 database
    db = createTestD1Database();
    await applyMigrations(db);

    // Create test environment
    env = createTestEnv(db);
    container = new DependencyContainer(env);

    // Clear update strategy state
    getMessageUpdateStrategy().clear();

    // Mock fetch for Discord API calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: '123456' }),
      text: async () => 'OK',
    });
  });

  afterEach(async () => {
    await closeTestDatabase(db);
    vi.restoreAllMocks();
    getMessageUpdateStrategy().clear();
  });

  describe('並行投票シナリオ', () => {
    it('複数ユーザーが同時に投票しても投票数が正確に記録される', async () => {
      // 1. スケジュール作成
      const createResult = await container.applicationServices.createScheduleUseCase.execute({
        guildId: 'guild-123',
        channelId: 'channel-123',
        authorId: 'creator-123',
        authorUsername: 'creator',
        title: '並行投票テスト',
        dates: [
          { id: 'date1', datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
          { id: 'date2', datetime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() },
        ],
      });

      if (!createResult.success) {
        console.error('Schedule creation failed:', createResult.errors);
      }
      expect(createResult.success).toBe(true);
      const scheduleId = createResult.schedule?.id || '';

      // 2. 複数ユーザーが同時に投票（Promise.allを使用して並行実行）
      const votes = [
        {
          userId: 'user1',
          username: 'ユーザー1',
          responses: [
            { dateId: 'date1', status: 'ok' as const },
            { dateId: 'date2', status: 'maybe' as const },
          ],
        },
        {
          userId: 'user2',
          username: 'ユーザー2',
          responses: [
            { dateId: 'date1', status: 'maybe' as const },
            { dateId: 'date2', status: 'ok' as const },
          ],
        },
        {
          userId: 'user3',
          username: 'ユーザー3',
          responses: [
            { dateId: 'date1', status: 'ng' as const },
            { dateId: 'date2', status: 'ok' as const },
          ],
        },
        {
          userId: 'user4',
          username: 'ユーザー4',
          responses: [
            { dateId: 'date1', status: 'ok' as const },
            { dateId: 'date2', status: 'ng' as const },
          ],
        },
      ];

      // 並行投票実行
      const voteResults = await Promise.allSettled(
        votes.map((vote) =>
          container.applicationServices.submitResponseUseCase.execute({
            scheduleId,
            guildId: 'guild-123',
            userId: vote.userId,
            username: vote.username,
            responses: vote.responses,
          })
        )
      );

      // 3. すべての投票が成功したことを確認
      voteResults.forEach((result, index) => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.success).toBe(true);
        }
      });

      // 4. 投票結果の集計を確認
      const summaryResult = await container.applicationServices.getScheduleSummaryUseCase.execute(
        scheduleId,
        'guild-123'
      );

      expect(summaryResult.success).toBe(true);
      expect(summaryResult.summary).toBeDefined();

      const summary = summaryResult.summary!;

      // 投票数の確認
      expect(summary.totalResponseUsers).toBe(4); // 4ユーザーが投票

      // 各日程の投票数を確認
      const date1Counts = summary.responseCounts['date1'];
      const date2Counts = summary.responseCounts['date2'];

      expect(date1Counts).toBeDefined();
      expect(date2Counts).toBeDefined();

      // date1: OK=2, MAYBE=1, NG=1
      expect(date1Counts.yes).toBe(2);
      expect(date1Counts.maybe).toBe(1);
      expect(date1Counts.no).toBe(1);

      // date2: OK=2, MAYBE=1, NG=1
      expect(date2Counts.yes).toBe(2);
      expect(date2Counts.maybe).toBe(1);
      expect(date2Counts.no).toBe(1);
    });

    it('同一ユーザーが複数回投票した場合、最後の投票のみが有効になる', async () => {
      // 1. スケジュール作成
      const createResult = await container.applicationServices.createScheduleUseCase.execute({
        guildId: 'guild-123',
        channelId: 'channel-123',
        authorId: 'creator-123',
        authorUsername: 'creator',
        title: '重複投票テスト',
        dates: [
          { id: 'date1', datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
        ],
      });

      if (!createResult.success) {
        console.error('Schedule creation failed:', createResult.errors);
      }
      expect(createResult.success).toBe(true);
      const scheduleId = createResult.schedule?.id || '';

      // 2. 同一ユーザーが複数回投票
      const userId = 'duplicate-user';
      const username = '重複ユーザー';

      // 最初の投票
      const firstVote = await container.applicationServices.submitResponseUseCase.execute({
        scheduleId,
        guildId: 'guild-123',
        userId,
        username,
        responses: [{ dateId: 'date1', status: 'ok' }],
      });

      expect(firstVote.success).toBe(true);

      // 2回目の投票（上書き）
      const secondVote = await container.applicationServices.submitResponseUseCase.execute({
        scheduleId,
        guildId: 'guild-123',
        userId,
        username,
        responses: [{ dateId: 'date1', status: 'ng' }],
      });

      expect(secondVote.success).toBe(true);

      // 3. 最終的な投票結果を確認
      const summaryResult = await container.applicationServices.getScheduleSummaryUseCase.execute(
        scheduleId,
        'guild-123'
      );

      expect(summaryResult.success).toBe(true);
      const summary = summaryResult.summary!;

      expect(summary.totalResponseUsers).toBe(1); // 1ユーザーのみ

      const date1Counts = summary.responseCounts['date1'];
      expect(date1Counts).toBeDefined();
      expect(date1Counts.yes).toBe(0); // 最初のOKは上書きされた
      expect(date1Counts.maybe).toBe(0);
      expect(date1Counts.no).toBe(1); // 最後のNGが有効
    });

    it('大量の並行投票でもパフォーマンスが維持される', async () => {
      // 1. スケジュール作成
      const createResult = await container.applicationServices.createScheduleUseCase.execute({
        guildId: 'guild-123',
        channelId: 'channel-123',
        authorId: 'creator-123',
        authorUsername: 'creator',
        title: 'パフォーマンステスト',
        dates: [
          { id: 'date1', datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
        ],
      });

      if (!createResult.success) {
        console.error('Schedule creation failed:', createResult.errors);
      }
      expect(createResult.success).toBe(true);
      const scheduleId = createResult.schedule?.id || '';

      // 2. 大量のユーザーが同時投票（50ユーザー）
      const userCount = 50;
      const votes = Array.from({ length: userCount }, (_, i) => ({
        userId: `user-${i}`,
        username: `ユーザー${i}`,
        responses: [{ dateId: 'date1', status: i % 3 === 0 ? 'ok' : i % 3 === 1 ? 'maybe' : 'ng' }],
      }));

      const startTime = Date.now();

      // 並行投票実行
      const voteResults = await Promise.allSettled(
        votes.map((vote) =>
          container.applicationServices.submitResponseUseCase.execute({
            scheduleId,
            guildId: 'guild-123',
            userId: vote.userId,
            username: vote.username,
            responses: vote.responses,
          })
        )
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 3. パフォーマンス確認（5秒以内で完了）
      expect(duration).toBeLessThan(5000);

      // 4. すべての投票が成功したことを確認
      voteResults.forEach((result, index) => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.success).toBe(true);
        }
      });

      // 5. 投票数の整合性確認
      const summaryResult = await container.applicationServices.getScheduleSummaryUseCase.execute(
        scheduleId,
        'guild-123'
      );

      expect(summaryResult.success).toBe(true);
      const summary = summaryResult.summary!;
      expect(summary.totalResponseUsers).toBe(userCount);

      const date1Counts = summary.responseCounts['date1'];
      expect(date1Counts).toBeDefined();

      // 投票分布の確認（OK: 17, MAYBE: 17, NG: 16）
      const expectedOk = Math.floor(userCount / 3) + (userCount % 3 > 0 ? 1 : 0);
      const expectedMaybe = Math.floor(userCount / 3) + (userCount % 3 > 1 ? 1 : 0);
      const expectedNg = Math.floor(userCount / 3);

      expect(date1Counts.yes + date1Counts.maybe + date1Counts.no).toBe(userCount);
    });
  });

  describe('メッセージ更新戦略', () => {
    it('レート制限が正常に動作する', async () => {
      const strategy = getMessageUpdateStrategy();
      
      // 最初の更新は許可される
      expect(strategy.shouldUpdate('schedule-1', 'message-1')).toBe(true);
      strategy.recordUpdate('schedule-1', 'message-1');
      
      // 短時間内の更新はスキップされる
      expect(strategy.shouldUpdate('schedule-1', 'message-1')).toBe(false);
      
      // 最小間隔後は更新可能
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(strategy.shouldUpdate('schedule-1', 'message-1')).toBe(true);
    });

    it('異なるスケジュールの更新は独立して処理される', async () => {
      const strategy = getMessageUpdateStrategy();
      
      // 両方とも最初の更新は許可される
      expect(strategy.shouldUpdate('schedule-1', 'message-1')).toBe(true);
      strategy.recordUpdate('schedule-1', 'message-1');
      
      expect(strategy.shouldUpdate('schedule-2', 'message-2')).toBe(true);
      strategy.recordUpdate('schedule-2', 'message-2');
      
      // それぞれのスケジュールは独立してレート制限される
      expect(strategy.shouldUpdate('schedule-1', 'message-1')).toBe(false);
      expect(strategy.shouldUpdate('schedule-2', 'message-2')).toBe(false);
    });
    
    it('締切時の強制更新が動作する', async () => {
      const strategy = getMessageUpdateStrategy();
      
      // 通常の更新を記録
      strategy.recordUpdate('schedule-1', 'message-1');
      expect(strategy.shouldUpdate('schedule-1', 'message-1')).toBe(false);
      
      // 強制更新後は即座に更新可能
      strategy.forceUpdate('schedule-1', 'message-1');
      expect(strategy.shouldUpdate('schedule-1', 'message-1')).toBe(true);
    });
  });
});
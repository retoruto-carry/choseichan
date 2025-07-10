/**
 * 投票処理サービス
 * D1での競合処理とトランザクションを考慮した実装
 */

import { Response, ResponseStatus } from '../types/schedule-v2';
import { IRepositoryFactory } from '../repositories/interfaces';
import { ConflictError, RepositoryError } from '../repositories/interfaces';

export interface VoteData {
  scheduleId: string;
  userId: string;
  username: string;
  displayName?: string;
  dateStatuses: Record<string, ResponseStatus>;
  comment?: string;
}

export class VoteService {
  constructor(private repositoryFactory: IRepositoryFactory) {}

  /**
   * 投票を保存（楽観的ロック付き）
   */
  async saveVote(voteData: VoteData, guildId: string): Promise<void> {
    const scheduleRepo = this.repositoryFactory.getScheduleRepository();
    const responseRepo = this.repositoryFactory.getResponseRepository();
    
    // トランザクション開始（D1の場合のみ有効）
    const transaction = await this.repositoryFactory.beginTransaction?.();
    
    try {
      // 1. スケジュールの存在確認
      const schedule = await scheduleRepo.findById(voteData.scheduleId, guildId);
      if (!schedule) {
        throw new RepositoryError('Schedule not found', 'NOT_FOUND');
      }
      
      // 2. スケジュールが開いているか確認
      if (schedule.status !== 'open') {
        throw new ConflictError('Schedule is closed');
      }
      
      // 3. 投票データを作成
      const response: Response = {
        scheduleId: voteData.scheduleId,
        userId: voteData.userId,
        username: voteData.username,
        displayName: voteData.displayName,
        dateStatuses: voteData.dateStatuses,
        comment: voteData.comment,
        updatedAt: new Date()
      };
      
      // 4. 投票を保存
      await responseRepo.save(response, guildId);
      
      // 5. トランザクションをコミット
      if (transaction) {
        await transaction.commit();
      }
    } catch (error) {
      // トランザクションをロールバック
      if (transaction) {
        await transaction.rollback();
      }
      
      if (error instanceof ConflictError || error instanceof RepositoryError) {
        throw error;
      }
      
      throw new RepositoryError('Failed to save vote', 'SAVE_ERROR', error as Error);
    }
  }

  /**
   * 複数の投票を一括保存（バッチ処理）
   */
  async saveVotesBatch(votes: VoteData[], guildId: string): Promise<void> {
    const errors: Error[] = [];
    
    // D1の場合はトランザクション内で処理
    const transaction = await this.repositoryFactory.beginTransaction?.();
    
    try {
      for (const vote of votes) {
        try {
          await this.saveVote(vote, guildId);
        } catch (error) {
          errors.push(error as Error);
        }
      }
      
      if (errors.length > 0) {
        throw new RepositoryError(
          `Failed to save ${errors.length} votes`, 
          'BATCH_ERROR'
        );
      }
      
      if (transaction) {
        await transaction.commit();
      }
    } catch (error) {
      if (transaction) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  /**
   * 投票を削除
   */
  async deleteVote(
    scheduleId: string, 
    userId: string, 
    guildId: string
  ): Promise<void> {
    const responseRepo = this.repositoryFactory.getResponseRepository();
    
    try {
      await responseRepo.delete(scheduleId, userId, guildId);
    } catch (error) {
      throw new RepositoryError('Failed to delete vote', 'DELETE_ERROR', error as Error);
    }
  }

  /**
   * リアルタイム集計結果を取得
   */
  async getRealtimeSummary(scheduleId: string, guildId: string) {
    const responseRepo = this.repositoryFactory.getResponseRepository();
    
    try {
      return await responseRepo.getScheduleSummary(scheduleId, guildId);
    } catch (error) {
      throw new RepositoryError('Failed to get summary', 'SUMMARY_ERROR', error as Error);
    }
  }
}
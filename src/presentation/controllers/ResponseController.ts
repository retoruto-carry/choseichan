/**
 * Response Controller
 * 
 * レスポンス関連のプレゼンテーション層コントローラー
 * 投票処理とUI構築を調整
 */

import { SubmitResponseUseCase } from '../../application/usecases/response/SubmitResponseUseCase';
import { UpdateResponseUseCase } from '../../application/usecases/response/UpdateResponseUseCase';
import { GetResponseUseCase } from '../../application/usecases/response/GetResponseUseCase';
import { GetScheduleUseCase } from '../../application/usecases/schedule/GetScheduleUseCase';
import { SubmitResponseRequest, UpdateResponseRequest, GetResponseRequest } from '../../application/dto/ResponseDto';
import { ResponseUIBuilder } from '../builders/ResponseUIBuilder';
import { ScheduleUIBuilder } from '../builders/ScheduleUIBuilder';
import { IDiscordApiService, DiscordMessage } from '../../infrastructure/services/DiscordApiService';

export interface ResponseControllerResult {
  success: boolean;
  message?: DiscordMessage;
  errors?: string[];
}

export class ResponseController {
  constructor(
    private readonly submitResponseUseCase: SubmitResponseUseCase,
    private readonly updateResponseUseCase: UpdateResponseUseCase,
    private readonly getResponseUseCase: GetResponseUseCase,
    private readonly getScheduleUseCase: GetScheduleUseCase,
    private readonly discordApiService: IDiscordApiService
  ) {}

  /**
   * 投票投稿
   */
  async submitResponse(request: SubmitResponseRequest): Promise<ResponseControllerResult> {
    const result = await this.submitResponseUseCase.execute(request);

    if (!result.success) {
      return {
        success: false,
        message: {
          embeds: [ResponseUIBuilder.buildErrorEmbed('投票エラー', result.errors || ['投票の処理に失敗しました'])],
          ephemeral: true
        },
        errors: result.errors
      };
    }

    // スケジュール情報を取得して結果を表示
    const scheduleResult = await this.getScheduleUseCase.execute(request.scheduleId, request.guildId);
    if (!scheduleResult.success || !scheduleResult.schedule) {
      return {
        success: false,
        message: {
          embeds: [ResponseUIBuilder.buildErrorEmbed('エラー', ['スケジュール情報の取得に失敗しました'])],
          ephemeral: true
        }
      };
    }

    // 投票結果のUIを構築
    const resultEmbed = ResponseUIBuilder.buildVoteResultEmbed(
      scheduleResult.schedule,
      result.response,
      result.isNewResponse
    );

    return {
      success: true,
      message: {
        embeds: [resultEmbed],
        ephemeral: true
      }
    };
  }

  /**
   * 投票更新
   */
  async updateResponse(request: UpdateResponseRequest): Promise<ResponseControllerResult> {
    const result = await this.updateResponseUseCase.execute(request);

    if (!result.success) {
      return {
        success: false,
        message: {
          embeds: [ResponseUIBuilder.buildErrorEmbed('更新エラー', result.errors || ['投票の更新に失敗しました'])],
          ephemeral: true
        },
        errors: result.errors
      };
    }

    // 更新成功メッセージ
    const successEmbed = ResponseUIBuilder.buildSuccessEmbed(
      '投票を更新しました',
      '投票内容を正常に更新しました。'
    );

    return {
      success: true,
      message: {
        embeds: [successEmbed],
        ephemeral: true
      }
    };
  }

  /**
   * ユーザーの投票取得
   */
  async getUserResponse(
    scheduleId: string,
    guildId: string,
    userId: string
  ): Promise<ResponseControllerResult> {
    const request: GetResponseRequest = {
      scheduleId,
      guildId,
      userId
    };

    const result = await this.getResponseUseCase.execute(request);

    if (!result.success) {
      return {
        success: false,
        message: {
          embeds: [ResponseUIBuilder.buildErrorEmbed('取得エラー', result.errors || ['投票情報の取得に失敗しました'])],
          ephemeral: true
        },
        errors: result.errors
      };
    }

    // スケジュール情報も取得
    const scheduleResult = await this.getScheduleUseCase.execute(scheduleId, guildId);
    if (!scheduleResult.success || !scheduleResult.schedule) {
      return {
        success: false,
        message: {
          embeds: [ResponseUIBuilder.buildErrorEmbed('エラー', ['スケジュール情報の取得に失敗しました'])],
          ephemeral: true
        }
      };
    }

    // 投票確認UIを構築（既存回答付き）
    const embed = ResponseUIBuilder.buildVoteConfirmationEmbed(
      scheduleResult.schedule,
      result.response
    );

    return {
      success: true,
      message: {
        embeds: [embed],
        ephemeral: true
      }
    };
  }

  /**
   * 投票統計表示
   */
  async displayStatistics(scheduleId: string, guildId: string): Promise<ResponseControllerResult> {
    // 全レスポンス取得
    const responsesResult = await this.getResponseUseCase.getAllResponses({
      scheduleId,
      guildId
    });

    if (!responsesResult.success) {
      return {
        success: false,
        message: {
          embeds: [ResponseUIBuilder.buildErrorEmbed('取得エラー', responsesResult.errors || ['統計情報の取得に失敗しました'])],
          ephemeral: true
        },
        errors: responsesResult.errors
      };
    }

    // スケジュール情報取得
    const scheduleResult = await this.getScheduleUseCase.execute(scheduleId, guildId);
    if (!scheduleResult.success || !scheduleResult.schedule) {
      return {
        success: false,
        message: {
          embeds: [ResponseUIBuilder.buildErrorEmbed('エラー', ['スケジュール情報の取得に失敗しました'])],
          ephemeral: true
        }
      };
    }

    // 統計UIを構築
    if (!responsesResult.responses || responsesResult.responses.length === 0) {
      return {
        success: true,
        message: {
          embeds: [ResponseUIBuilder.buildErrorEmbed('統計情報', ['まだ投票がありません'])],
          ephemeral: true
        }
      };
    }

    if (!responsesResult.statistics) {
      return {
        success: false,
        message: {
          embeds: [ResponseUIBuilder.buildErrorEmbed('エラー', ['統計情報の計算に失敗しました'])],
          ephemeral: true
        }
      };
    }

    const statisticsEmbed = ResponseUIBuilder.buildVoteStatisticsEmbed(
      scheduleResult.schedule,
      responsesResult.statistics
    );

    return {
      success: true,
      message: {
        embeds: [statisticsEmbed],
        ephemeral: true
      }
    };
  }

  /**
   * コメント付き投票処理
   */
  async submitResponseWithComment(
    scheduleId: string,
    guildId: string,
    userId: string,
    username: string,
    displayName: string | undefined,
    selectedDateIds: string[],
    comment?: string
  ): Promise<ResponseControllerResult> {
    // 日程選択を回答形式に変換
    const responses = selectedDateIds.map(dateId => ({
      dateId,
      status: 'ok' as const
    }));

    const request: SubmitResponseRequest = {
      scheduleId,
      guildId,
      userId,
      username,
      displayName,
      responses,
      comment
    };

    return this.submitResponse(request);
  }

  /**
   * 投票キャンセル
   */
  async cancelVote(): Promise<ResponseControllerResult> {
    const cancelEmbed = ResponseUIBuilder.buildSuccessEmbed(
      '投票をキャンセルしました',
      '投票処理をキャンセルしました。'
    );

    return {
      success: true,
      message: {
        embeds: [cancelEmbed],
        ephemeral: true
      }
    };
  }

  /**
   * コメントモーダル構築
   */
  buildCommentModal(scheduleId: string, currentComment?: string): DiscordMessage {
    const modal = ResponseUIBuilder.buildCommentModal(scheduleId, currentComment);
    
    return {
      // モーダルは特別な形式なので、messageとしてではなく直接レスポンス
      components: modal.components as any
    };
  }
}
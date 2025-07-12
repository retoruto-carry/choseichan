/**
 * Schedule Controller
 *
 * スケジュール関連のプレゼンテーション層コントローラー
 * Use Casesの実行とUI構築を調整
 */

import type { ResponseStatistics } from '../../application/dto/ResponseDto';
import type {
  CloseScheduleRequest,
  CreateScheduleRequest,
  UpdateScheduleRequest,
} from '../../application/dto/ScheduleDto';
import { getLogger } from '../../infrastructure/logging/Logger';
import type { GetResponseUseCase } from '../../application/usecases/response/GetResponseUseCase';
import type { CloseScheduleUseCase } from '../../application/usecases/schedule/CloseScheduleUseCase';
import type { CreateScheduleUseCase } from '../../application/usecases/schedule/CreateScheduleUseCase';
import type { GetScheduleUseCase } from '../../application/usecases/schedule/GetScheduleUseCase';
import type { UpdateScheduleUseCase } from '../../application/usecases/schedule/UpdateScheduleUseCase';
import type {
  DiscordMessage,
  IDiscordApiService,
} from '../../infrastructure/services/DiscordApiService';
import { ResponseUIBuilder } from '../builders/ResponseUIBuilder';
import { type ScheduleDisplayOptions, ScheduleUIBuilder } from '../builders/ScheduleUIBuilder';

export interface ScheduleControllerResult {
  success: boolean;
  message?: DiscordMessage;
  errors?: string[];
}

export class ScheduleController {
  private readonly logger = getLogger();

  constructor(
    private readonly createScheduleUseCase: CreateScheduleUseCase,
    private readonly updateScheduleUseCase: UpdateScheduleUseCase,
    private readonly closeScheduleUseCase: CloseScheduleUseCase,
    private readonly getScheduleUseCase: GetScheduleUseCase,
    private readonly getResponseUseCase: GetResponseUseCase,
    private readonly discordApiService: IDiscordApiService
  ) {}

  /**
   * スケジュール作成
   */
  async createSchedule(request: CreateScheduleRequest): Promise<ScheduleControllerResult> {
    const result = await this.createScheduleUseCase.execute(request);

    if (!result.success || !result.schedule) {
      return {
        success: false,
        message: {
          embeds: [
            ResponseUIBuilder.buildErrorEmbed(
              'スケジュール作成エラー',
              result.errors || ['不明なエラー']
            ),
          ],
          ephemeral: true,
        },
        errors: result.errors,
      };
    }

    // 成功時のUIを構築
    const displayOptions: ScheduleDisplayOptions = {
      showVoteButtons: true,
      showEditButtons: true,
      showCloseButton: true,
      showDeleteButton: true,
      isOwnerView: true,
    };

    const embed = ScheduleUIBuilder.buildScheduleEmbed(result.schedule, undefined, displayOptions);
    const components = ScheduleUIBuilder.buildActionButtons(result.schedule, displayOptions);

    return {
      success: true,
      message: {
        embeds: [embed],
        components,
      },
    };
  }

  /**
   * スケジュール表示
   */
  async displaySchedule(
    scheduleId: string,
    guildId: string,
    options: ScheduleDisplayOptions = {}
  ): Promise<ScheduleControllerResult> {
    // スケジュール詳細を取得
    const summaryResult = await this.getScheduleUseCase.getScheduleSummary(scheduleId, guildId);

    if (!summaryResult.success || !summaryResult.summary) {
      return {
        success: false,
        message: {
          embeds: [
            ResponseUIBuilder.buildErrorEmbed(
              'スケジュール取得エラー',
              summaryResult.errors || ['スケジュールが見つかりません']
            ),
          ],
          ephemeral: true,
        },
        errors: summaryResult.errors,
      };
    }

    const { summary } = summaryResult;
    const schedule = summary.schedule;

    // UIを構築
    const embed = ScheduleUIBuilder.buildScheduleEmbed(schedule, summary.responseCounts, options);
    const components = ScheduleUIBuilder.buildActionButtons(schedule, options);

    return {
      success: true,
      message: {
        embeds: [embed],
        components,
      },
    };
  }

  /**
   * スケジュール更新
   */
  async updateSchedule(request: UpdateScheduleRequest): Promise<ScheduleControllerResult> {
    const result = await this.updateScheduleUseCase.execute(request);

    if (!result.success || !result.schedule) {
      return {
        success: false,
        message: {
          embeds: [
            ResponseUIBuilder.buildErrorEmbed(
              '更新エラー',
              result.errors || ['更新に失敗しました']
            ),
          ],
          ephemeral: true,
        },
        errors: result.errors,
      };
    }

    // 更新後の表示
    return this.displaySchedule(result.schedule.id, result.schedule.guildId, {
      showVoteButtons: true,
      showEditButtons: true,
      showCloseButton: true,
      isOwnerView: true,
    });
  }

  /**
   * スケジュール締切
   */
  async closeSchedule(request: CloseScheduleRequest): Promise<ScheduleControllerResult> {
    const result = await this.closeScheduleUseCase.execute(request);

    if (!result.success || !result.schedule) {
      return {
        success: false,
        message: {
          embeds: [
            ResponseUIBuilder.buildErrorEmbed(
              '締切エラー',
              result.errors || ['締切に失敗しました']
            ),
          ],
          ephemeral: true,
        },
        errors: result.errors,
      };
    }

    // 締切後の表示
    const successEmbed = ResponseUIBuilder.buildSuccessEmbed(
      'スケジュールを締め切りました',
      `**${result.schedule.title}** の回答を締め切りました。`
    );

    return {
      success: true,
      message: {
        embeds: [successEmbed],
        ephemeral: true,
      },
    };
  }

  /**
   * 投票表示UI構築
   */
  async buildVoteInterface(
    scheduleId: string,
    guildId: string,
    _userId?: string
  ): Promise<ScheduleControllerResult> {
    // スケジュール情報取得
    const scheduleResult = await this.getScheduleUseCase.execute(scheduleId, guildId);
    if (!scheduleResult.success || !scheduleResult.schedule) {
      return {
        success: false,
        message: {
          embeds: [
            ResponseUIBuilder.buildErrorEmbed(
              'エラー',
              scheduleResult.errors || ['スケジュールが見つかりません']
            ),
          ],
          ephemeral: true,
        },
      };
    }

    const schedule = scheduleResult.schedule;

    // 締切チェック
    if (schedule.status === 'closed') {
      return {
        success: false,
        message: {
          embeds: [
            ResponseUIBuilder.buildErrorEmbed('投票不可', [
              'このスケジュールは既に締め切られています',
            ]),
          ],
          ephemeral: true,
        },
      };
    }

    // 期限チェック
    if (schedule.deadline) {
      const deadline = new Date(schedule.deadline);
      if (deadline < new Date()) {
        return {
          success: false,
          message: {
            embeds: [ResponseUIBuilder.buildErrorEmbed('投票不可', ['回答期限が過ぎています'])],
            ephemeral: true,
          },
        };
      }
    }

    // 投票UIを構築
    const embed = ResponseUIBuilder.buildVoteConfirmationEmbed(schedule);
    const selectMenu = ScheduleUIBuilder.buildDateSelectMenu(schedule, `vote_dates:${scheduleId}`);
    const actionButtons = ResponseUIBuilder.buildVoteActionButtons(scheduleId);

    return {
      success: true,
      message: {
        embeds: [embed],
        components: [
          {
            type: 1, // ACTION_ROW
            components: [selectMenu],
          },
          ...actionButtons,
        ],
        ephemeral: true,
      },
    };
  }

  /**
   * 回答一覧表示
   */
  async displayResponses(scheduleId: string, guildId: string): Promise<ScheduleControllerResult> {
    const summaryResult = await this.getScheduleUseCase.getScheduleSummary(scheduleId, guildId);

    if (!summaryResult.success || !summaryResult.summary) {
      return {
        success: false,
        message: {
          embeds: [
            ResponseUIBuilder.buildErrorEmbed(
              'エラー',
              summaryResult.errors || ['スケジュールが見つかりません']
            ),
          ],
          ephemeral: true,
        },
      };
    }

    const { summary } = summaryResult;

    // 回答一覧Embedを構築
    const responseListEmbed = ScheduleUIBuilder.buildResponseListEmbed(
      summary.schedule,
      summary.responses
    );

    // 統計Embedを構築（回答がある場合）
    const embeds = [responseListEmbed];
    if (summary.responses.length > 0) {
      // ResponseStatistics形式に変換して統計Embedを構築
      const responseStatistics = await this.buildResponseStatistics(scheduleId, guildId);
      if (responseStatistics) {
        const statisticsEmbed = ResponseUIBuilder.buildVoteStatisticsEmbed(
          summary.schedule,
          responseStatistics
        );
        embeds.push(statisticsEmbed);
      }
    }

    return {
      success: true,
      message: {
        embeds,
        ephemeral: true,
      },
    };
  }

  /**
   * ResponseStatistics形式の統計情報を取得（プライベートヘルパー）
   */
  private async buildResponseStatistics(
    scheduleId: string,
    guildId: string
  ): Promise<ResponseStatistics | null> {
    try {
      const responsesResult = await this.getResponseUseCase.getAllResponses({
        scheduleId,
        guildId,
      });

      if (!responsesResult.success || !responsesResult.statistics) {
        return null;
      }

      return responsesResult.statistics;
    } catch (error) {
      this.logger.error('Failed to build response statistics', error instanceof Error ? error : new Error(String(error)), {
        operation: 'build-response-statistics',
        useCase: 'ScheduleController',
        scheduleId,
        guildId,
      });
      return null;
    }
  }
}

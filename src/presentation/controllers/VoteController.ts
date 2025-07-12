/**
 * Vote Controller
 *
 * 投票機能のコントローラー
 * 元: src/handlers/vote-handlers.ts の Clean Architecture版
 */

import { InteractionResponseType } from 'discord-interactions';
import type { ScheduleResponse } from '../../application/dto/ScheduleDto';
import { NotificationService } from '../../application/services/NotificationService';
import { MessageUpdateType } from '../../domain/services/MessageUpdateService';
import { DiscordApiAdapter } from '../../infrastructure/adapters/DiscordApiAdapter';
import { LoggerAdapter } from '../../infrastructure/adapters/LoggerAdapter';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { getLogger } from '../../infrastructure/logging/Logger';
import type { ButtonInteraction, Env, ModalInteraction } from '../../infrastructure/types/discord';
import { VoteUIBuilder } from '../builders/VoteUIBuilder';
import { updateOriginalMessage } from '../utils/discord';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../utils/embeds';
import { createEphemeralResponse, createErrorResponse } from '../utils/responses';

export class VoteController {
  private readonly logger = getLogger();

  constructor(
    private readonly dependencyContainer: DependencyContainer,
    private readonly uiBuilder: VoteUIBuilder
  ) {}

  /**
   * 回答ボタン処理
   */
  async handleRespondButton(
    interaction: ButtonInteraction,
    params: string[],
    _env: Env
  ): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';
      const userId = interaction.member?.user.id || interaction.user?.id || '';

      // Get schedule using Clean Architecture
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );
      if (!scheduleResult.success || !scheduleResult.schedule) {
        return createErrorResponse('日程調整が見つかりません。');
      }
      const schedule = scheduleResult.schedule;

      if (schedule.status === 'closed') {
        return createErrorResponse('この日程調整は締め切られています。');
      }

      // Save message ID if not already saved
      if (interaction.message?.id && !schedule.messageId) {
        await this.dependencyContainer.updateScheduleUseCase.execute({
          scheduleId,
          guildId,
          editorUserId: userId,
          messageId: interaction.message.id,
        });
      }

      // Get current user's responses
      const responseResult = await this.dependencyContainer.getResponseUseCase.execute({
        scheduleId,
        userId,
        guildId,
      });

      // ResponseDto の dateStatuses を使用
      const currentResponses = [];
      if (responseResult.success && responseResult.response) {
        for (const [dateId, status] of Object.entries(responseResult.response.dateStatuses)) {
          currentResponses.push({ dateId, status });
        }
      }

      // Create vote select menus
      const selectMenus = this.uiBuilder.createVoteSelectMenus(
        schedule,
        responseResult.response || null
      );

      // Max 5 select menus per message
      const firstBatch = selectMenus.slice(0, 5);
      const hasMore = selectMenus.length > 5;

      // 6個以上の日程がある場合は分割
      const components = [];
      if (selectMenus.length <= 5) {
        components.push(...selectMenus);
      } else {
        // 最初の5個を表示
        components.push(...firstBatch);
        // 残りがあることを示すメッセージを追加
        if (hasMore) {
          components.push({
            type: 1,
            components: [
              {
                type: 2,
                style: 2,
                label: `※ 他に${selectMenus.length - 5}個の日程があります`,
                custom_id: 'dummy_more',
                disabled: true,
              },
            ],
          });
        }
      }

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `📝 **${schedule.title}** の回答\n\n各日程について回答を選択してください：\n\n※反映には最大1分かかります`,
            components,
            flags: 64, // Ephemeral
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error handling respond button',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'handle-respond-button',
          useCase: 'VoteController',
          scheduleId: params[0],
          guildId: interaction.guild_id,
        }
      );
      return createErrorResponse('エラーが発生しました。');
    }
  }

  /**
   * 詳細表示トグルボタン処理
   */
  async handleToggleDetailsButton(
    interaction: ButtonInteraction,
    params: string[],
    _env: Env
  ): Promise<Response> {
    try {
      const [scheduleId, currentState] = params;
      const guildId = interaction.guild_id || 'default';
      const showDetails = currentState !== 'true';

      // Get schedule and summary using Clean Architecture
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );
      if (!scheduleResult.success || !scheduleResult.schedule) {
        return createErrorResponse('日程調整が見つかりません。');
      }

      const summaryResult = await this.dependencyContainer.getScheduleSummaryUseCase.execute(
        scheduleId,
        guildId
      );
      if (!summaryResult.success || !summaryResult.summary) {
        return createErrorResponse('サマリー情報の取得に失敗しました。');
      }

      // Update the message with new state
      const embed = createScheduleEmbedWithTable(summaryResult.summary, showDetails);
      const components = createSimpleScheduleComponents(scheduleResult.schedule, showDetails);

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: {
            embeds: [embed],
            components,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error toggling details',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'toggle-details',
          useCase: 'VoteController',
          scheduleId: params[0],
          guildId: interaction.guild_id,
        }
      );
      return createErrorResponse('表示の切り替えに失敗しました。');
    }
  }

  /**
   * 投票モーダル処理
   */
  async handleVoteModal(
    interaction: ModalInteraction,
    params: string[],
    _env: Env
  ): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';
      const userId = interaction.member?.user.id || interaction.user?.id || '';
      const username = interaction.member?.user.username || interaction.user?.username || 'Unknown';

      // Get schedule using Clean Architecture
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );
      if (!scheduleResult.success || !scheduleResult.schedule) {
        return createErrorResponse('日程調整が見つかりません。');
      }
      const schedule = scheduleResult.schedule;

      if (schedule.status === 'closed' && schedule.createdBy.id !== userId) {
        return createErrorResponse('この日程調整は締め切られています。');
      }

      // Parse responses from modal
      const components = interaction.data.components;
      const responses: Array<{ dateId: string; status: 'ok' | 'maybe' | 'ng' }> = [];

      // Parse each date response
      for (let i = 0; i < schedule.dates.length && i < components.length; i++) {
        const dateId = schedule.dates[i].id;
        const value = components[i]?.components[0]?.value || '';
        const trimmedValue = value.trim().toLowerCase();

        let status: 'ok' | 'maybe' | 'ng' = 'ng';
        if (trimmedValue === 'o' || trimmedValue === '○' || trimmedValue === '◯') {
          status = 'ok';
        } else if (trimmedValue === '△' || trimmedValue === '▲') {
          status = 'maybe';
        }

        responses.push({ dateId, status });
      }

      // Submit response using Clean Architecture
      const submitResult = await this.dependencyContainer.submitResponseUseCase.execute({
        scheduleId,
        userId,
        username,
        responses,
        guildId,
      });

      if (!submitResult.success) {
        return createErrorResponse('回答の保存に失敗しました。');
      }

      // Send response message
      const responseContent = this.createResponseMessage(schedule, responses, username);

      // Update main message using MessageUpdateService
      if (schedule.messageId && schedule.channelId) {
        const messageUpdateService = this.dependencyContainer.messageUpdateService;
        if (messageUpdateService) {
          await messageUpdateService.scheduleUpdate({
            scheduleId,
            messageId: schedule.messageId,
            channelId: schedule.channelId,
            guildId,
            updateType: MessageUpdateType.VOTE_UPDATE,
          });
        }
      }

      return createEphemeralResponse(responseContent);
    } catch (error) {
      this.logger.error(
        'Error handling vote modal',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'handle-vote-modal',
          useCase: 'VoteController',
          scheduleId: params[0],
          guildId: interaction.guild_id,
          userId: interaction.member?.user.id || interaction.user?.id,
        }
      );
      return createErrorResponse('回答の処理中にエラーが発生しました。');
    }
  }

  /**
   * 締切ボタン処理
   */
  async handleCloseButton(
    interaction: ButtonInteraction,
    params: string[],
    env: Env
  ): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';
      const userId = interaction.member?.user.id || interaction.user?.id || '';

      // Get schedule using Clean Architecture
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );
      if (!scheduleResult.success || !scheduleResult.schedule) {
        return createErrorResponse('日程調整が見つかりません。');
      }
      const schedule = scheduleResult.schedule;

      // Check permissions
      if (schedule.createdBy.id !== userId) {
        return createErrorResponse('この日程調整を締め切る権限がありません。');
      }

      if (schedule.status === 'closed') {
        return createErrorResponse('この日程調整は既に締め切られています。');
      }

      // Close schedule using Clean Architecture
      const closeResult = await this.dependencyContainer.closeScheduleUseCase.execute({
        scheduleId,
        guildId,
        editorUserId: userId,
      });

      if (!closeResult.success) {
        return createErrorResponse('日程調整の締切に失敗しました。');
      }

      // Send notifications in background
      if (env.ctx && env.DISCORD_TOKEN && env.DISCORD_APPLICATION_ID) {
        // 締切時は即座に最終更新を実行
        if (schedule.messageId && schedule.channelId) {
          const messageUpdateService = this.dependencyContainer.messageUpdateService;
          if (messageUpdateService) {
            await messageUpdateService.scheduleUpdate({
              scheduleId,
              messageId: schedule.messageId,
              channelId: schedule.channelId,
              guildId,
              updateType: MessageUpdateType.CLOSE_UPDATE,
            });
          }
        }

        env.ctx.waitUntil(this.sendClosureNotifications(scheduleId, guildId, env));
      }

      return createEphemeralResponse(
        '✅ 日程調整を締め切りました。\n📊 集計結果と個人宛通知を送信しています...'
      );
    } catch (error) {
      this.logger.error(
        'Error closing schedule',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'close-schedule',
          useCase: 'VoteController',
          scheduleId: params[0],
          guildId: interaction.guild_id,
          userId: interaction.member?.user.id || interaction.user?.id,
        }
      );
      return createErrorResponse('締切処理中にエラーが発生しました。');
    }
  }

  /**
   * 締切通知を送信
   */
  private async sendClosureNotifications(
    scheduleId: string,
    guildId: string,
    env: Env
  ): Promise<void> {
    try {
      // Create NotificationService with Clean Architecture dependencies
      // Ensure Discord credentials are available
      const discordToken = env.DISCORD_TOKEN ?? '';
      const applicationId = env.DISCORD_APPLICATION_ID ?? '';

      if (!discordToken || !applicationId) {
        throw new Error('Discord credentials are not configured');
      }

      const notificationService = new NotificationService(
        new LoggerAdapter(),
        new DiscordApiAdapter(),
        this.dependencyContainer.infrastructureServices.repositoryFactory.getScheduleRepository(),
        this.dependencyContainer.infrastructureServices.repositoryFactory.getResponseRepository(),
        this.dependencyContainer.getScheduleSummaryUseCase,
        discordToken,
        applicationId,
        this.dependencyContainer.infrastructureServices.backgroundExecutor
      );

      // Send summary message
      await notificationService.sendSummaryMessage(scheduleId, guildId);

      // Get schedule for PR message
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );
      if (scheduleResult.success && scheduleResult.schedule) {
        notificationService.sendPRMessage(scheduleResult.schedule);
      }
    } catch (error) {
      this.logger.error(
        'Error sending closure notifications',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'send-closure-notifications',
          useCase: 'VoteController',
          scheduleId,
          guildId,
        }
      );
    }
  }

  /**
   * メインメッセージを更新
   */
  private async updateMainMessage(
    scheduleId: string,
    messageId: string,
    interactionToken: string,
    env: Env,
    guildId: string
  ): Promise<void> {
    try {
      if (!env.DISCORD_APPLICATION_ID) {
        return;
      }

      // Get latest schedule and summary
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(
        scheduleId,
        guildId
      );
      if (!scheduleResult.success || !scheduleResult.schedule) {
        return;
      }

      const summaryResult = await this.dependencyContainer.getScheduleSummaryUseCase.execute(
        scheduleId,
        guildId
      );
      if (!summaryResult.success || !summaryResult.summary) {
        return;
      }

      // Update the message
      const embed = createScheduleEmbedWithTable(summaryResult.summary, false);
      const components = createSimpleScheduleComponents(scheduleResult.schedule, false);

      await updateOriginalMessage(
        env.DISCORD_APPLICATION_ID,
        interactionToken,
        {
          embeds: [embed],
          components,
        },
        messageId
      );
    } catch (error) {
      this.logger.error(
        'Error updating main message',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'update-main-message',
          useCase: 'VoteController',
          scheduleId,
          messageId,
          guildId,
        }
      );
    }
  }

  /**
   * 回答メッセージを作成
   */
  private createResponseMessage(
    schedule: ScheduleResponse,
    responses: Array<{ dateId: string; status: 'ok' | 'maybe' | 'ng' }>,
    username: string
  ): string {
    const lines = [`✅ ${username} さんの回答を受け付けました！\n`];

    // Add response summary
    for (const response of responses) {
      const date = schedule.dates.find((d) => d.id === response.dateId);
      if (date) {
        const statusEmoji =
          response.status === 'ok' ? '○' : response.status === 'maybe' ? '△' : '×';
        lines.push(`${statusEmoji} ${date.datetime}`);
      }
    }

    return lines.join('\n');
  }
}

export function createVoteController(env: Env): VoteController {
  const container = new DependencyContainer(env);
  const uiBuilder = new VoteUIBuilder();
  return new VoteController(container, uiBuilder);
}

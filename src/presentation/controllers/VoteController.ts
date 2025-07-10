/**
 * Vote Controller
 * 
 * 投票機能のコントローラー
 * 元: src/handlers/vote-handlers.ts の Clean Architecture版
 */

import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ButtonInteraction, Env } from '../../types/discord';
import { ResponseStatus } from '../../types/schedule';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { VoteUIBuilder } from '../builders/VoteUIBuilder';
import { createEphemeralResponse, createErrorResponse } from '../../utils/responses';
import { sendFollowupMessage } from '../../utils/discord-webhook';
import { updateOriginalMessage } from '../../utils/discord';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../../utils/embeds';
import { NotificationService } from '../../application/services/NotificationService';

export class VoteController {
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
    env: Env,
    storage?: any // For backwards compatibility with tests
  ): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';
      const userId = interaction.member?.user.id || interaction.user?.id || '';

      // Get schedule using Clean Architecture
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(scheduleId, guildId);
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
          messageId: interaction.message.id
        });
      }

      // Get current user's responses
      const responseResult = await this.dependencyContainer.getResponseUseCase.execute({
        scheduleId,
        userId,
        guildId
      });

      // ResponseDto の dateStatuses を使用
      const currentResponses = [];
      if (responseResult.success && responseResult.response) {
        for (const [dateId, status] of Object.entries(responseResult.response.dateStatuses)) {
          currentResponses.push({ dateId, status });
        }
      }

      // Create vote modal
      const modal = this.uiBuilder.createVoteModal(schedule, currentResponses);

      return new Response(JSON.stringify({
        type: InteractionResponseType.MODAL,
        data: modal
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
      console.error('Error handling respond button:', error);
      return createErrorResponse('エラーが発生しました。');
    }
  }

  /**
   * 詳細表示トグルボタン処理
   */
  async handleToggleDetailsButton(
    interaction: ButtonInteraction,
    params: string[],
    env: Env,
    storage?: any
  ): Promise<Response> {
    try {
      const [scheduleId, currentState] = params;
      const guildId = interaction.guild_id || 'default';
      const showDetails = currentState !== 'true';

      // Get schedule and summary using Clean Architecture
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(scheduleId, guildId);
      if (!scheduleResult.success || !scheduleResult.schedule) {
        return createErrorResponse('日程調整が見つかりません。');
      }

      const summaryResult = await this.dependencyContainer.getScheduleSummaryUseCase.execute(scheduleId, guildId);
      if (!summaryResult.success || !summaryResult.summary) {
        return createErrorResponse('サマリー情報の取得に失敗しました。');
      }

      // Update the message with new state
      const embed = createScheduleEmbedWithTable(summaryResult.summary, showDetails);
      const components = createSimpleScheduleComponents(scheduleResult.schedule, showDetails);

      return new Response(JSON.stringify({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          embeds: [embed],
          components
        }
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
      console.error('Error toggling details:', error);
      return createErrorResponse('表示の切り替えに失敗しました。');
    }
  }

  /**
   * 投票モーダル処理
   */
  async handleVoteModal(
    interaction: any, // ModalInteraction type
    params: string[],
    env: Env,
    storage?: any
  ): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';
      const userId = interaction.member?.user.id || interaction.user?.id || '';
      const username = interaction.member?.user.username || interaction.user?.username || 'Unknown';

      // Get schedule using Clean Architecture
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(scheduleId, guildId);
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
      const comment = components[components.length - 1]?.components[0]?.value || '';

      // Parse each date response
      for (let i = 0; i < schedule.dates.length && i < components.length - 1; i++) {
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
        comment,
        guildId
      });

      if (!submitResult.success) {
        return createErrorResponse('回答の保存に失敗しました。');
      }

      // Send response message
      const responseContent = this.createResponseMessage(schedule, responses, username);

      // Update main message in background
      if (env.ctx && schedule.messageId && env.DISCORD_APPLICATION_ID) {
        env.ctx.waitUntil(
          this.updateMainMessage(scheduleId, schedule.messageId, interaction.token, env, guildId)
        );
      }

      return createEphemeralResponse(responseContent);

    } catch (error) {
      console.error('Error handling vote modal:', error);
      return createErrorResponse('回答の処理中にエラーが発生しました。');
    }
  }

  /**
   * 締切ボタン処理
   */
  async handleCloseButton(
    interaction: ButtonInteraction,
    params: string[],
    env: Env,
    storage?: any
  ): Promise<Response> {
    try {
      const [scheduleId] = params;
      const guildId = interaction.guild_id || 'default';
      const userId = interaction.member?.user.id || interaction.user?.id || '';

      // Get schedule using Clean Architecture
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(scheduleId, guildId);
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
        editorUserId: userId
      });

      if (!closeResult.success) {
        return createErrorResponse('日程調整の締切に失敗しました。');
      }

      // Send notifications in background
      if (env.ctx && env.DISCORD_TOKEN && env.DISCORD_APPLICATION_ID) {
        env.ctx.waitUntil(
          this.sendClosureNotifications(scheduleId, guildId, env)
        );
      }

      return createEphemeralResponse('✅ 日程調整を締め切りました。\n📊 集計結果と個人宛通知を送信しています...');

    } catch (error) {
      console.error('Error closing schedule:', error);
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
      const notificationService = new NotificationService(
        this.dependencyContainer.infrastructureServices.repositoryFactory.getScheduleRepository(),
        this.dependencyContainer.infrastructureServices.repositoryFactory.getResponseRepository(),
        this.dependencyContainer.getScheduleSummaryUseCase,
        env.DISCORD_TOKEN!,
        env.DISCORD_APPLICATION_ID!
      );

      // Send summary message
      await notificationService.sendSummaryMessage(scheduleId, guildId);

      // Get schedule for PR message
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(scheduleId, guildId);
      if (scheduleResult.success && scheduleResult.schedule) {
        await notificationService.sendPRMessage(scheduleResult.schedule);
      }
    } catch (error) {
      console.error('Error sending closure notifications:', error);
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
      const scheduleResult = await this.dependencyContainer.getScheduleUseCase.execute(scheduleId, guildId);
      if (!scheduleResult.success || !scheduleResult.schedule) {
        return;
      }

      const summaryResult = await this.dependencyContainer.getScheduleSummaryUseCase.execute(scheduleId, guildId);
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
          components
        },
        messageId
      );
    } catch (error) {
      console.error('Error updating main message:', error);
    }
  }

  /**
   * 回答メッセージを作成
   */
  private createResponseMessage(
    schedule: any,
    responses: Array<{ dateId: string; status: 'ok' | 'maybe' | 'ng' }>,
    username: string
  ): string {
    const lines = [`✅ ${username} さんの回答を受け付けました！\n`];
    
    // Add response summary
    for (const response of responses) {
      const date = schedule.dates.find((d: any) => d.id === response.dateId);
      if (date) {
        const statusEmoji = response.status === 'ok' ? '○' : 
                           response.status === 'maybe' ? '△' : '×';
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
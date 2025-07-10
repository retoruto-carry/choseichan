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
import { saveScheduleMessageId } from '../../utils/schedule-updater';
import { sendFollowupMessage } from '../../utils/discord-webhook';

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

      // スケジュール取得
      let schedule = null;
      if (storage) {
        // Use passed storage for test compatibility
        schedule = await storage.getSchedule(scheduleId, guildId);
      } else {
        // Use Clean Architecture
        const scheduleResult = await this.dependencyContainer.getScheduleUseCase
          .execute(scheduleId, guildId);
        schedule = scheduleResult.success ? scheduleResult.schedule : null;
      }

      if (!schedule) {
        return createErrorResponse('日程調整が見つかりません。');
      }

      if (schedule.status === 'closed') {
        return createErrorResponse('この日程調整は締め切られています。');
      }

      // Save message ID if not already saved (using passed storage for test compatibility)
      if (interaction.message?.id && !schedule.messageId) {
        const storageToUse = storage || await (async () => {
          const { StorageServiceV2 } = await import('../../services/storage-v2');
          return new StorageServiceV2(env);
        })();
        await saveScheduleMessageId(scheduleId, interaction.message.id, storageToUse, guildId);
      }

      // Get current user's responses
      const userId = interaction.member?.user.id || interaction.user?.id || '';
      let userResponse = null;
      
      if (storage) {
        // Use passed storage for test compatibility
        userResponse = await storage.getResponse(scheduleId, userId, guildId);
      } else {
        // Use Clean Architecture
        const userResponseResult = await this.dependencyContainer.getResponseUseCase
          .execute({ scheduleId, userId, guildId });
        userResponse = userResponseResult.success ? userResponseResult.response : null;
      }

      // Create select menu components
      const components = this.uiBuilder.createVoteSelectMenus(
        schedule,
        userResponse
      );

      // Handle multiple component groups (max 5 per message)
      const componentGroups = this.splitComponentsIntoGroups(components);
      const totalGroups = componentGroups.length;

      // Send followup messages for additional groups
      if (totalGroups > 1 && env.DISCORD_APPLICATION_ID) {
        await this.sendFollowupMessages(
          componentGroups.slice(1),
          totalGroups,
          interaction,
          env
        );
      }

      // Prepare initial message
      const initialMessage = this.createInitialMessage(
        schedule.title,
        schedule.dates.length,
        totalGroups
      );

      const componentsWithNotice = this.addDelayNotice(componentGroups[0]);

      return createEphemeralResponse(
        initialMessage,
        undefined,
        componentsWithNotice
      );

    } catch (error) {
      console.error('Error in handleRespondButton:', error);
      return createErrorResponse('回答画面の表示中にエラーが発生しました。');
    }
  }

  /**
   * 日程選択メニュー処理
   */
  async handleDateSelectMenu(
    interaction: ButtonInteraction,
    env: Env
  ): Promise<Response> {
    try {
      const guildId = interaction.guild_id || 'default';
      const parts = interaction.data.custom_id.split(':');
      const [_, scheduleId, dateId] = parts;

      const userId = interaction.member?.user.id || interaction.user?.id || '';
      const userName = interaction.member?.user.username || interaction.user?.username || '';
      const selectedValue = interaction.data.values?.[0] || 'none';

      // レスポンス保存処理
      await this.processVoteResponse(
        scheduleId,
        userId,
        userName,
        dateId,
        selectedValue as ResponseStatus | 'none',
        guildId,
        env
      );

      // Always return DEFERRED_UPDATE_MESSAGE immediately
      return new Response(JSON.stringify({
        type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
      console.error('Error in handleDateSelectMenu:', error);
      // Still return DEFERRED_UPDATE_MESSAGE to avoid Discord errors
      return new Response(JSON.stringify({
        type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE
      }), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  private splitComponentsIntoGroups(components: any[]): any[][] {
    const componentGroups: any[][] = [];
    for (let i = 0; i < components.length; i += 5) {
      componentGroups.push(components.slice(i, i + 5));
    }
    return componentGroups;
  }

  private async sendFollowupMessages(
    componentGroups: any[][],
    totalGroups: number,
    interaction: ButtonInteraction,
    env: Env
  ): Promise<void> {
    const sendFollowups = async () => {
      for (let i = 0; i < componentGroups.length; i++) {
        await sendFollowupMessage(
          env.DISCORD_APPLICATION_ID,
          interaction.token,
          `続き (${i + 2}/${totalGroups}):`,
          componentGroups[i],
          env
        );
      }
    };

    if (env.ctx && typeof env.ctx.waitUntil === 'function') {
      env.ctx.waitUntil(sendFollowups());
    } else {
      sendFollowups().catch(err => console.error('Failed to send followup messages:', err));
    }
  }

  private createInitialMessage(title: string, dateCount: number, totalGroups: number): string {
    return totalGroups === 1 
      ? `**${title}** の回答を選択してください:`
      : `**${title}** の回答を選択してください (1/${totalGroups}):\n\n📝 日程が${dateCount}件あります。`;
  }

  private addDelayNotice(components: any[]): any[] {
    return [
      ...components,
      {
        type: 1, // Action Row
        components: [{
          type: 2, // Button
          style: 2, // Secondary
          label: '※反映には最大1分かかります',
          custom_id: 'delay_notice',
          disabled: true
        }]
      }
    ];
  }

  private async processVoteResponse(
    scheduleId: string,
    userId: string,
    userName: string,
    dateId: string,
    selectedValue: ResponseStatus | 'none',
    guildId: string,
    env: Env
  ): Promise<void> {
    try {
      // 一時的にStorageServiceV2を使用（後でClean Architectureに移行）
      const { StorageServiceV2 } = await import('../../services/storage-v2');
      const storage = new StorageServiceV2(env);

      // Get or create user response
      let userResponse = await storage.getResponse(scheduleId, userId, guildId);

      if (!userResponse) {
        userResponse = {
          scheduleId,
          userId,
          userName,
          responses: [],
          comment: '',
          updatedAt: new Date()
        };
      }

      // Always update userName in case it has changed
      userResponse.userName = userName;

      // Update the specific date response
      if (selectedValue === 'none') {
        // Remove the response for this date
        userResponse.responses = userResponse.responses.filter(r => r.dateId !== dateId);
      } else {
        const status = selectedValue as ResponseStatus;
        const existingIndex = userResponse.responses.findIndex(r => r.dateId === dateId);

        if (existingIndex >= 0) {
          userResponse.responses[existingIndex].status = status;
        } else {
          userResponse.responses.push({
            dateId,
            status
          });
        }
      }

      userResponse.updatedAt = new Date();

      // Save response
      await storage.saveResponse(userResponse, guildId);

    } catch (error) {
      console.error('Failed to process vote:', error);
      throw error;
    }
  }
}

/**
 * Factory function for creating controller with dependencies
 */
export function createVoteController(env: Env): VoteController {
  const container = new DependencyContainer(env);
  const uiBuilder = new VoteUIBuilder();
  
  return new VoteController(container, uiBuilder);
}
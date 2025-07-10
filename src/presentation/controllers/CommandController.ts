/**
 * Command Controller
 * 
 * スラッシュコマンド機能のコントローラー
 * 元: src/handlers/commands.ts の Clean Architecture版
 */

import { InteractionResponseType } from 'discord-interactions';
import { CommandInteraction, Env } from '../../types/discord';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { CommandUIBuilder } from '../builders/CommandUIBuilder';
import { DISCORD_FLAGS, ERROR_MESSAGES } from '../../constants';
import { handleHelpCommand } from '../../handlers/help';

export class CommandController {
  constructor(
    private readonly dependencyContainer: DependencyContainer,
    private readonly uiBuilder: CommandUIBuilder
  ) {}

  /**
   * メインコマンドハンドラー
   */
  async handleChoseichanCommand(
    interaction: CommandInteraction,
    env: Env
  ): Promise<Response> {
    try {
      const subcommand = interaction.data.options?.[0];
      
      if (!subcommand) {
        return this.createErrorResponse(ERROR_MESSAGES.INVALID_INPUT);
      }

      switch (subcommand.name) {
        case 'create':
          return this.handleCreateCommand(interaction);
        case 'list':
          return this.handleListCommand(interaction);
        case 'help':
          return handleHelpCommand();
        default:
          return this.createErrorResponse(ERROR_MESSAGES.UNKNOWN_COMMAND);
      }

    } catch (error) {
      console.error('Error in handleChoseichanCommand:', error);
      return this.createErrorResponse('コマンドの処理中にエラーが発生しました。');
    }
  }

  /**
   * スケジュール作成コマンド処理
   */
  private async handleCreateCommand(
    interaction: CommandInteraction
  ): Promise<Response> {
    try {
      // モーダルを表示して対話的に作成
      const modal = this.uiBuilder.createScheduleCreationModal();

      return new Response(JSON.stringify({
        type: InteractionResponseType.MODAL,
        data: modal
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
      console.error('Error in handleCreateCommand:', error);
      return this.createErrorResponse('スケジュール作成画面の表示中にエラーが発生しました。');
    }
  }

  /**
   * スケジュール一覧コマンド処理
   */
  private async handleListCommand(
    interaction: CommandInteraction,
    storage?: any // For backwards compatibility with tests
  ): Promise<Response> {
    try {
      const channelId = interaction.channel_id;
      const guildId = interaction.guild_id || 'default';
      
      if (!channelId) {
        return this.createErrorResponse('このコマンドはチャンネル内でのみ使用できます。');
      }

      // スケジュール一覧取得
      let schedules = [];
      if (storage) {
        // Use passed storage for test compatibility
        schedules = await storage.listSchedulesByChannel(channelId, guildId);
      } else {
        // Use Clean Architecture
        const schedulesResult = await this.dependencyContainer.findSchedulesUseCase
          .findByChannel(channelId, guildId, 10);
        
        if (!schedulesResult.success) {
          return this.createErrorResponse(schedulesResult.errors?.[0] || 'スケジュール一覧の取得に失敗しました。');
        }
        schedules = schedulesResult.schedules || [];
      }
      
      if (schedules.length === 0) {
        return new Response(JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'このチャンネルには進行中の日程調整がありません。',
            flags: DISCORD_FLAGS.EPHEMERAL
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      // UI構築
      const embed = this.uiBuilder.createScheduleListEmbed(schedules);

      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed],
          flags: DISCORD_FLAGS.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
      console.error('Error in handleListCommand:', error);
      return this.createErrorResponse('スケジュール一覧の表示中にエラーが発生しました。');
    }
  }

  private createErrorResponse(message: string): Response {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: message,
        flags: DISCORD_FLAGS.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }
}

/**
 * Factory function for creating controller with dependencies
 */
export function createCommandController(env: Env): CommandController {
  const container = new DependencyContainer(env);
  const uiBuilder = new CommandUIBuilder();
  
  return new CommandController(container, uiBuilder);
}
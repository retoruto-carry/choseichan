/**
 * Command Controller
 *
 * スラッシュコマンド機能のコントローラー
 * 元: src/handlers/commands.ts の Clean Architecture版
 */

import { InteractionResponseType } from 'discord-interactions';
import { DISCORD_CONSTANTS, ERROR_MESSAGES } from '../../constants/ApplicationConstants';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { getLogger } from '../../infrastructure/logging/Logger';
import type { CommandInteraction, Env } from '../../infrastructure/types/discord';
import { CommandUIBuilder } from '../builders/CommandUIBuilder';
import { HelpUIBuilder } from '../builders/HelpUIBuilder';

export class CommandController {
  private readonly logger = getLogger();

  constructor(
    private readonly dependencyContainer: DependencyContainer,
    private readonly uiBuilder: CommandUIBuilder,
    private readonly helpUIBuilder: HelpUIBuilder
  ) {}

  /**
   * メインコマンドハンドラー
   */
  async handleChoseichanCommand(interaction: CommandInteraction, _env: Env): Promise<Response> {
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
          return this.handleHelpCommand();
        default:
          return this.createErrorResponse(ERROR_MESSAGES.UNKNOWN_COMMAND);
      }
    } catch (error) {
      this.logger.error(
        'Error in handleChoseichanCommand',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'handle-choseichan-command',
          useCase: 'CommandController',
          subcommand: interaction.data.options?.[0]?.name,
          guildId: interaction.guild_id,
        }
      );
      return this.createErrorResponse('コマンドの処理中にエラーが発生しました。');
    }
  }

  /**
   * スケジュール作成コマンド処理
   */
  private async handleCreateCommand(_interaction: CommandInteraction): Promise<Response> {
    try {
      // モーダルを表示して対話的に作成
      const modal = this.uiBuilder.createScheduleCreationModal();

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.MODAL,
          data: modal,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error in handleCreateCommand',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'handle-create-command',
          useCase: 'CommandController',
          guildId: _interaction.guild_id,
        }
      );
      return this.createErrorResponse('スケジュール作成画面の表示中にエラーが発生しました。');
    }
  }

  /**
   * スケジュール一覧コマンド処理
   */
  private async handleListCommand(interaction: CommandInteraction): Promise<Response> {
    try {
      const channelId = interaction.channel_id;
      const guildId = interaction.guild_id || 'default';

      if (!channelId) {
        return this.createErrorResponse('このコマンドはチャンネル内でのみ使用できます。');
      }

      // スケジュール一覧取得
      const schedulesResult = await this.dependencyContainer.findSchedulesUseCase.findByChannel(
        channelId,
        guildId,
        10
      );

      if (!schedulesResult.success) {
        return this.createErrorResponse(
          schedulesResult.errors?.[0] || 'スケジュール一覧の取得に失敗しました。'
        );
      }
      const schedules = schedulesResult.schedules || [];

      if (schedules.length === 0) {
        return new Response(
          JSON.stringify({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: 'このチャンネルには進行中の日程調整がありません。',
              flags: DISCORD_CONSTANTS.FLAGS.EPHEMERAL,
            },
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }

      // UI構築
      const embed = this.uiBuilder.createScheduleListEmbed(schedules);

      return new Response(
        JSON.stringify({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [embed],
            flags: DISCORD_CONSTANTS.FLAGS.EPHEMERAL,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      this.logger.error(
        'Error in handleListCommand',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'handle-list-command',
          useCase: 'CommandController',
          channelId: interaction.channel_id,
          guildId: interaction.guild_id,
        }
      );
      return this.createErrorResponse('スケジュール一覧の表示中にエラーが発生しました。');
    }
  }

  /**
   * ヘルプコマンド処理
   */
  private handleHelpCommand(): Response {
    const embed = this.helpUIBuilder.createHelpEmbed();

    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed],
          flags: DISCORD_CONSTANTS.FLAGS.EPHEMERAL,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  private createErrorResponse(message: string): Response {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: message,
          flags: DISCORD_CONSTANTS.FLAGS.EPHEMERAL,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Factory function for creating controller with dependencies
 */
export function createCommandController(env: Env): CommandController {
  const container = new DependencyContainer(env);
  const uiBuilder = new CommandUIBuilder();
  const helpUIBuilder = new HelpUIBuilder();

  return new CommandController(container, uiBuilder, helpUIBuilder);
}

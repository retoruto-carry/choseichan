/**
 * Command Controller
 *
 * スラッシュコマンド機能のコントローラー
 * 元: src/handlers/commands.ts の Clean Architecture版
 */

import { InteractionResponseType } from 'discord-interactions';
import { DependencyContainer } from '../../di/DependencyContainer';
import { DISCORD_API_CONSTANTS } from '../../infrastructure/constants/DiscordConstants';
import { getLogger } from '../../infrastructure/logging/Logger';
import type { CommandInteraction, Env } from '../../infrastructure/types/discord';
import { CommandUIBuilder } from '../builders/CommandUIBuilder';
import { LIST_LIMITS } from '../constants/ui';

export class CommandController {
  private readonly logger = getLogger();

  constructor(
    private readonly dependencyContainer: DependencyContainer,
    private readonly uiBuilder: CommandUIBuilder
  ) {}

  /**
   * メインコマンドハンドラー
   */
  async handleChouseichanCommand(interaction: CommandInteraction, _env: Env): Promise<Response> {
    try {
      // 直接作成コマンドを実行
      return this.handleCreateCommand(interaction);
    } catch (error) {
      this.logger.error(
        'Error in handleChouseichanCommand',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'handle-chouseichan-command',
          useCase: 'CommandController',
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
      const schedulesResult = await this.dependencyContainer.findSchedulesUseCase.findByChannel({
        channelId,
        guildId,
        limit: LIST_LIMITS.DEFAULT_SCHEDULE_LIMIT,
      });

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
              flags: DISCORD_API_CONSTANTS.FLAGS.EPHEMERAL,
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
            flags: DISCORD_API_CONSTANTS.FLAGS.EPHEMERAL,
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

  private createErrorResponse(message: string): Response {
    return new Response(
      JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: message,
          flags: DISCORD_API_CONSTANTS.FLAGS.EPHEMERAL,
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

  return new CommandController(container, uiBuilder);
}

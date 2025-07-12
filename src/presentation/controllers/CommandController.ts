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
import { EMBED_COLORS } from '../constants/ui';

export class CommandController {
  private readonly logger = getLogger();

  constructor(
    private readonly dependencyContainer: DependencyContainer,
    private readonly uiBuilder: CommandUIBuilder
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
      this.logger.error('Error in handleChoseichanCommand', error instanceof Error ? error : new Error(String(error)), {
        operation: 'handle-choseichan-command',
        useCase: 'CommandController',
        subcommand: interaction.data.options?.[0]?.name,
        guildId: interaction.guild_id,
      });
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
      this.logger.error('Error in handleCreateCommand', error instanceof Error ? error : new Error(String(error)), {
        operation: 'handle-create-command',
        useCase: 'CommandController',
        guildId: _interaction.guild_id,
      });
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
      this.logger.error('Error in handleListCommand', error instanceof Error ? error : new Error(String(error)), {
        operation: 'handle-list-command',
        useCase: 'CommandController',
        channelId: interaction.channel_id,
        guildId: interaction.guild_id,
      });
      return this.createErrorResponse('スケジュール一覧の表示中にエラーが発生しました。');
    }
  }

  /**
   * ヘルプコマンド処理
   */
  private handleHelpCommand(): Response {
    const embed = {
      title: '📚 調整ちゃん - 使い方',
      description: 'Discord上で簡単に日程調整ができるボットです',
      color: EMBED_COLORS.INFO,
      fields: [
        {
          name: '📝 日程調整を作成',
          value: '`/choseichan create`\n対話形式で日程調整を作成します',
          inline: false,
        },
        {
          name: '📋 日程調整一覧を表示',
          value: '`/choseichan list`\nチャンネル内の日程調整を一覧表示します',
          inline: false,
        },
        {
          name: '🆘 ヘルプを表示',
          value: '`/choseichan help`\nこのヘルプメッセージを表示します',
          inline: false,
        },
        {
          name: '🔘 回答方法',
          value:
            '1. 日程調整メッセージの「回答する」ボタンをクリック\n2. 各日程の横にある○△×ボタンで回答\n　○: 参加可能\n　△: 未定・条件付き\n　×: 参加不可',
          inline: false,
        },
        {
          name: '📊 回答状況の確認',
          value: '「状況を見る」ボタンで現在の回答状況を表形式で確認できます',
          inline: false,
        },
        {
          name: '💡 便利な機能',
          value:
            '• 回答は何度でも変更可能\n• 個人向けメッセージは自分だけに表示\n• 回答状況は表形式でわかりやすく表示\n• 最有力候補は自動で判定',
          inline: false,
        },
      ],
      footer: {
        text: '調整ちゃん v1.0.0',
      },
    };

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

  return new CommandController(container, uiBuilder);
}

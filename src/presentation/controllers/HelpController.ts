/**
 * Help Controller
 * 
 * ヘルプ機能のコントローラー
 * 元: src/handlers/help.ts の Clean Architecture版
 */

import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { Env } from '../../types/discord';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { HelpUIBuilder } from '../builders/HelpUIBuilder';

export class HelpController {
  constructor(
    private readonly dependencyContainer: DependencyContainer,
    private readonly uiBuilder: HelpUIBuilder
  ) {}

  /**
   * ヘルプコマンド処理
   */
  async handleHelpCommand(): Promise<Response> {
    try {
      const helpEmbed = this.uiBuilder.createHelpEmbed();

      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [helpEmbed],
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
      console.error('Error in handleHelpCommand:', error);
      return this.createErrorResponse('ヘルプの表示中にエラーが発生しました。');
    }
  }

  private createErrorResponse(message: string): Response {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: message,
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }
}

/**
 * Factory function for creating controller with dependencies
 */
export function createHelpController(env: Env): HelpController {
  const container = new DependencyContainer(env);
  const uiBuilder = new HelpUIBuilder();
  
  return new HelpController(container, uiBuilder);
}
/**
 * Comment Controller
 * 
 * コメント機能のコントローラー
 * 元: src/handlers/modals/comment.ts の Clean Architecture版
 * 
 * NOTE: コメント機能は廃止されました
 */

import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ModalInteraction, ButtonInteraction, Env } from '../../types/discord';
import { DependencyContainer } from '../../infrastructure/factories/DependencyContainer';
import { CommentUIBuilder } from '../builders/CommentUIBuilder';

export class CommentController {
  constructor(
    private readonly dependencyContainer: DependencyContainer,
    private readonly uiBuilder: CommentUIBuilder
  ) {}

  // コメント機能は廃止されました
  // 後方互換性のため、エラーレスポンスを返すメソッドのみ残します

  async handleAddCommentModal(
    interaction: ModalInteraction,
    params: string[],
    env: Env,
    storage?: any
  ): Promise<Response> {
    return this.createErrorResponse('コメント機能は廃止されました。');
  }

  async handleAddCommentButton(
    interaction: ButtonInteraction,
    params: string[],
    env: Env,
    storage?: any
  ): Promise<Response> {
    return this.createErrorResponse('コメント機能は廃止されました。');
  }

  private createErrorResponse(message: string): Response {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `❌ ${message}`,
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }
}

export function createCommentController(env: Env): CommentController {
  const container = new DependencyContainer(env);
  const uiBuilder = new CommentUIBuilder();
  return new CommentController(container, uiBuilder);
}
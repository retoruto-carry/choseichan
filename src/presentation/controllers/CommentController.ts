/**
 * Comment Controller
 * 
 * コメント機能のコントローラー
 * 元: src/handlers/modals/comment.ts の Clean Architecture版
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

  /**
   * 全体コメント追加モーダル処理
   */
  async handleAddCommentModal(
    interaction: ModalInteraction,
    params: string[],
    env: Env,
    storage?: any // For backwards compatibility with tests
  ): Promise<Response> {
    try {
      const guildId = interaction.guild_id || 'default';
      const [scheduleId] = params;
      const userId = interaction.member?.user.id || interaction.user?.id || '';

      if (!userId) {
        return this.createErrorResponse('ユーザー情報を取得できませんでした。');
      }

      // 一時的にStorageServiceV2を使用（後でClean Architectureに移行）
      const { StorageServiceV2 } = await import('../../services/storage-v2');
      const storageToUse = storage || new StorageServiceV2(env);

      const schedule = await storageToUse.getSchedule(scheduleId, guildId);
      if (!schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      const comment = interaction.data.components[0].components[0].value || '';
      
      // ユーザーレスポンスを取得
      let userResponse = await storageToUse.getResponse(scheduleId, userId, guildId);
      
      if (!userResponse) {
        return this.createErrorResponse('まず日程の回答を行ってからコメントを追加してください。');
      }

      // コメントを更新
      userResponse.comment = comment;
      userResponse.updatedAt = new Date();
      await storageToUse.saveResponse(userResponse, guildId);

      const { EMBED_COLORS } = await import('../../types/schedule');

      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [{
            title: '💬 コメントを更新しました',
            description: comment || 'コメントを削除しました。',
            color: EMBED_COLORS.INFO
          }],
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
      console.error('Error in handleAddCommentModal:', error);
      return this.createErrorResponse('コメントの更新中にエラーが発生しました。');
    }
  }

  /**
   * 日程別コメント追加モーダル処理
   */
  async handleDateCommentModal(
    interaction: ModalInteraction,
    params: string[],
    env: Env,
    storage?: any // For backwards compatibility with tests
  ): Promise<Response> {
    try {
      const guildId = interaction.guild_id || 'default';
      const [scheduleId, dateId] = params;
      const userId = interaction.member?.user.id || interaction.user?.id || '';

      if (!userId) {
        return this.createErrorResponse('ユーザー情報を取得できませんでした。');
      }

      // 一時的にStorageServiceV2を使用（後でClean Architectureに移行）
      const { StorageServiceV2 } = await import('../../services/storage-v2');
      const storageToUse = storage || new StorageServiceV2(env);

      const schedule = await storageToUse.getSchedule(scheduleId, guildId);
      if (!schedule) {
        return this.createErrorResponse('日程調整が見つかりません。');
      }

      const comment = interaction.data.components[0].components[0].value || '';
      
      // ユーザーレスポンスを取得
      let userResponse = await storageToUse.getResponse(scheduleId, userId, guildId);
      
      if (!userResponse) {
        return this.createErrorResponse('まず日程の回答を行ってからコメントを追加してください。');
      }

      // 特定の日程のコメントを更新
      const responseIndex = userResponse.responses.findIndex((r: any) => r.dateId === dateId);
      if (responseIndex >= 0) {
        userResponse.responses[responseIndex].comment = comment;
      }
      
      userResponse.updatedAt = new Date();
      await storageToUse.saveResponse(userResponse, guildId);

      const dateInfo = schedule.dates.find((d: any) => d.id === dateId);
      const { EMBED_COLORS } = await import('../../types/schedule');

      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [{
            title: '💬 日程別コメントを更新しました',
            description: `**${dateInfo?.datetime || '不明な日程'}**\n${comment || 'コメントを削除しました。'}`,
            color: EMBED_COLORS.INFO
          }],
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
      console.error('Error in handleDateCommentModal:', error);
      return this.createErrorResponse('日程別コメントの更新中にエラーが発生しました。');
    }
  }

  /**
   * 全体コメント追加ボタン処理
   */
  async handleAddCommentButton(
    interaction: ButtonInteraction,
    params: string[],
    env: Env,
    storage?: any // For backwards compatibility with tests
  ): Promise<Response> {
    try {
      const guildId = interaction.guild_id || 'default';
      const [scheduleId] = params;
      const userId = interaction.member?.user.id || interaction.user?.id || '';

      if (!userId) {
        return this.createErrorResponse('ユーザー情報を取得できませんでした。');
      }

      // 一時的にStorageServiceV2を使用（後でClean Architectureに移行）
      const { StorageServiceV2 } = await import('../../services/storage-v2');
      const storageToUse = storage || new StorageServiceV2(env);

      // 現在のコメントを取得
      const userResponse = await storageToUse.getResponse(scheduleId, userId, guildId);
      const currentComment = userResponse?.comment || '';

      // モーダルを表示
      return new Response(JSON.stringify({
        type: InteractionResponseType.MODAL,
        data: {
          custom_id: `modal:add_comment:${scheduleId}`,
          title: 'コメントを追加',
          components: [
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'comment',
                label: 'コメント',
                style: 2,
                placeholder: '参加条件や要望など',
                value: currentComment,
                required: false,
                max_length: 200
              }]
            }
          ]
        }
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
      console.error('Error in handleAddCommentButton:', error);
      return this.createErrorResponse('コメント入力画面の表示中にエラーが発生しました。');
    }
  }

  /**
   * 日程別コメントボタン処理
   */
  async handleCommentButton(
    interaction: ButtonInteraction,
    params: string[],
    env: Env,
    storage?: any // For backwards compatibility with tests
  ): Promise<Response> {
    try {
      const guildId = interaction.guild_id || 'default';
      const [scheduleId, dateId] = params;
      const userId = interaction.member?.user.id || interaction.user?.id || '';

      if (!userId) {
        return this.createErrorResponse('ユーザー情報を取得できませんでした。');
      }

      // 一時的にStorageServiceV2を使用（後でClean Architectureに移行）
      const { StorageServiceV2 } = await import('../../services/storage-v2');
      const storageToUse = storage || new StorageServiceV2(env);

      // この特定の日程の現在のコメントを取得
      const userResponse = await storageToUse.getResponse(scheduleId, userId, guildId);
      const dateResponse = userResponse?.responses.find((r: any) => r.dateId === dateId);
      const currentComment = dateResponse?.comment || '';
      
      const schedule = await storageToUse.getSchedule(scheduleId, guildId);
      const date = schedule?.dates.find((d: any) => d.id === dateId);
      
      // 特定の日程のコメント追加/編集用モーダルを表示
      return new Response(JSON.stringify({
        type: InteractionResponseType.MODAL,
        data: {
          custom_id: `modal:date_comment:${scheduleId}:${dateId}`,
          title: date ? date.datetime : 'コメント',
          components: [
            {
              type: 1,
              components: [{
                type: 4,
                custom_id: 'comment',
                label: 'この日程へのコメント',
                style: 2,
                placeholder: '例: 午後なら参加可能',
                value: currentComment,
                required: false,
                max_length: 100
              }]
            }
          ]
        }
      }), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
      console.error('Error in handleCommentButton:', error);
      return this.createErrorResponse('コメント入力画面の表示中にエラーが発生しました。');
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
export function createCommentController(env: Env): CommentController {
  const container = new DependencyContainer(env);
  const uiBuilder = new CommentUIBuilder();
  
  return new CommentController(container, uiBuilder);
}
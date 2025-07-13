/**
 * Discord関連のユーティリティ関数
 */

import type {
  ButtonInteraction,
  CommandInteraction,
  ModalInteraction,
} from '../infrastructure/types/discord';

/**
 * インタラクションからユーザーの表示名を取得
 * 優先順位: サーバーニックネーム > グローバル表示名 > ユーザー名
 */
export function getDisplayName(
  interaction: CommandInteraction | ButtonInteraction | ModalInteraction
): string {
  // サーバー内でのニックネーム
  if (interaction.member?.nick) {
    return interaction.member.nick;
  }

  // グローバル表示名
  const user = interaction.member?.user || interaction.user;
  if (user?.global_name) {
    return user.global_name;
  }

  // デフォルトのユーザー名
  return user?.username || 'Unknown User';
}

/**
 * ユーザーIDを取得
 */
export function getUserId(
  interaction: CommandInteraction | ButtonInteraction | ModalInteraction
): string | undefined {
  return interaction.member?.user.id || interaction.user?.id;
}

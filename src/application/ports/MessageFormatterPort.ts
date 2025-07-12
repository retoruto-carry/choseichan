/**
 * メッセージフォーマッターのポート定義
 *
 * Discord向けのメッセージフォーマットを生成するインターフェース
 * プレゼンテーション層の実装詳細から独立
 */

import type { ScheduleSummaryResponse } from '../dto/ScheduleDto';

/**
 * Discord Embedオブジェクト（簡略化）
 */
export interface MessageEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
  };
  timestamp?: string;
}

/**
 * Discord Componentオブジェクト（簡略化）
 */
export interface MessageComponent {
  type: number;
  components?: MessageComponent[];
  style?: number;
  label?: string;
  custom_id?: string;
  disabled?: boolean;
  placeholder?: string;
  options?: Array<{
    label: string;
    value: string;
    description?: string;
  }>;
}

/**
 * メッセージフォーマッターのインターフェース
 */
export interface IMessageFormatterPort {
  /**
   * スケジュールメッセージ（EmbedとComponents）を作成
   */
  formatScheduleMessage(
    summary: ScheduleSummaryResponse,
    showVoteButton: boolean
  ): { embed: object; components: object[] };
}

/**
 * 後方互換性のためのエイリアス
 */
export interface IMessageFormatter extends IMessageFormatterPort {}

/**
 * Discord メッセージ更新のインターフェース
 */
export interface IDiscordMessageUpdater {
  /**
   * オリジナルメッセージを更新
   */
  updateOriginalMessage(
    applicationId: string,
    interactionToken: string,
    data: {
      embeds?: MessageEmbed[];
      components?: MessageComponent[];
      content?: string;
    },
    messageId?: string
  ): Promise<void>;
}

/**
 * スケジュールメインメッセージ統一UIBuilder
 *
 * メインメッセージ（初回作成・投票後更新・更新ボタン・詳細切り替え）で
 * 一貫したUIを提供するための統一Builder
 */

import type { ScheduleResponse, ScheduleSummaryResponse } from '../../application/dto/ScheduleDto';
import { createButtonId } from '../../utils/id';
import { createScheduleEmbed, createScheduleEmbedWithTable } from '../utils/embeds';

export class ScheduleMainMessageBuilder {
  /**
   * メインメッセージのEmbed作成
   * @param summary スケジュール概要（詳細表示時）
   * @param schedule スケジュール情報（簡易表示時）
   * @param showDetails 詳細表示フラグ
   */
  static createMainEmbed(
    summary?: ScheduleSummaryResponse,
    schedule?: ScheduleResponse,
    showDetails: boolean = false
  ) {
    if (showDetails && summary) {
      // 詳細表示（投票状況含む）
      return createScheduleEmbedWithTable(summary, showDetails);
    } else if (schedule) {
      // 簡易表示（投票状況なし）
      return createScheduleEmbed(schedule);
    } else if (summary) {
      // Summary渡されたが簡易表示
      return createScheduleEmbed(summary.schedule);
    } else {
      throw new Error('schedule or summary must be provided');
    }
  }

  /**
   * メインメッセージのコンポーネント作成
   * @param schedule スケジュール情報
   * @param showDetails 詳細表示フラグ
   * @param showVoteButton 投票ボタン表示フラグ
   */
  static createMainComponents(
    schedule: ScheduleResponse,
    showDetails: boolean = false,
    showVoteButton: boolean = true
  ) {
    const components = [];

    // 第1行: 回答ボタン・詳細切り替え・更新ボタン
    if (schedule.status === 'open' && showVoteButton) {
      const firstRowButtons = [];

      // 回答ボタン
      firstRowButtons.push({
        type: 2, // BUTTON
        style: 1, // PRIMARY (青) - 統一仕様
        label: '回答する',
        custom_id: createButtonId('respond', schedule.id),
        emoji: { name: '✏️' }, // 統一仕様
      });

      // 詳細/簡易表示切り替えボタン
      firstRowButtons.push({
        type: 2, // BUTTON
        style: 2, // SECONDARY
        label: showDetails ? '簡易表示' : '詳細',
        custom_id: showDetails
          ? createButtonId('hide_details', schedule.id)
          : createButtonId('status', schedule.id),
        emoji: { name: showDetails ? '📊' : '👥' }, // 統一仕様
      });

      // 更新ボタン
      firstRowButtons.push({
        type: 2, // BUTTON
        style: 2, // SECONDARY
        label: '更新',
        custom_id: createButtonId('refresh', schedule.id),
        emoji: { name: '🔄' },
      });

      components.push({
        type: 1, // ACTION_ROW
        components: firstRowButtons,
      });
    }

    // 第2行: 編集ボタン（常に表示）
    const secondRowButtons = [];

    // 編集ボタン
    secondRowButtons.push({
      type: 2, // BUTTON
      style: 2, // SECONDARY
      label: '編集',
      custom_id: createButtonId('edit', schedule.id),
      emoji: { name: '⚙️' }, // 統一仕様
    });

    if (secondRowButtons.length > 0) {
      components.push({
        type: 1, // ACTION_ROW
        components: secondRowButtons,
      });
    }

    return components;
  }

  /**
   * メインメッセージの完全なUI作成（Embed + Components）
   * @param summary スケジュール概要（詳細表示時）
   * @param schedule スケジュール情報（簡易表示時）
   * @param showDetails 詳細表示フラグ
   * @param showVoteButton 投票ボタン表示フラグ
   */
  static createMainMessage(
    summary?: ScheduleSummaryResponse,
    schedule?: ScheduleResponse,
    showDetails: boolean = false,
    showVoteButton: boolean = true
  ) {
    const targetSchedule = schedule || summary?.schedule;
    if (!targetSchedule) {
      throw new Error('schedule or summary must be provided');
    }

    const embed = ScheduleMainMessageBuilder.createMainEmbed(summary, schedule, showDetails);
    const components = ScheduleMainMessageBuilder.createMainComponents(
      targetSchedule,
      showDetails,
      showVoteButton
    );

    return { embed, components };
  }
}

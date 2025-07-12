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
    } else {
      // 簡易表示（基本情報のみ・回答者数表示・簡易投票状況）
      const targetSchedule = schedule || summary?.schedule;
      if (!targetSchedule) {
        throw new Error('schedule or summary must be provided');
      }
      // summaryがある場合は回答者数とsummary情報を渡す
      const totalResponses = summary?.responses?.length;
      return createScheduleEmbed(targetSchedule, totalResponses, summary);
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
    const firstRowButtons = [];

    // 回答ボタン（スケジュールが開いている且つ表示フラグがtrueの場合のみ）
    if (schedule.status === 'open' && showVoteButton) {
      firstRowButtons.push({
        type: 2, // BUTTON
        style: 1, // PRIMARY (青) - 統一仕様
        label: '回答する',
        custom_id: createButtonId('respond', schedule.id),
        emoji: { name: '✏️' }, // 統一仕様
      });
    }

    // 以下のボタンは締切状態に関係なく常に表示

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

    // 更新ボタン（一時的にコメントアウト）
    /*
    firstRowButtons.push({
      type: 2, // BUTTON
      style: 2, // SECONDARY
      label: '更新',
      custom_id: createButtonId('refresh', schedule.id),
      emoji: { name: '🔄' },
    });
    */

    // 編集ボタン
    firstRowButtons.push({
      type: 2, // BUTTON
      style: 2, // SECONDARY
      label: '編集',
      custom_id: createButtonId('edit', schedule.id),
      emoji: { name: '⚙️' }, // 統一仕様
    });

    if (firstRowButtons.length > 0) {
      components.push({
        type: 1, // ACTION_ROW
        components: firstRowButtons,
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
   * @param isNewlyCreated 新規作成フラグ
   */
  static createMainMessage(
    summary?: ScheduleSummaryResponse,
    schedule?: ScheduleResponse,
    showDetails: boolean = false,
    showVoteButton: boolean = true,
    isNewlyCreated: boolean = false
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

    // 新規作成時のみcontentを追加
    const content = isNewlyCreated
      ? `${targetSchedule.createdBy.username}さんによって、日程調整「${targetSchedule.title}」が作成されました！📅`
      : undefined;

    return { embed, components, content };
  }
}

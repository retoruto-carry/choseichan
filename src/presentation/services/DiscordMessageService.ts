/**
 * Discord Message Service
 *
 * Discord固有のメッセージフォーマット処理を担当
 * UIロジックをPresentation層に統一
 */

import type { ScheduleSummaryResponseDto } from '../../application/dto/ScheduleDto';
import { ScheduleMainMessageBuilder } from '../builders/ScheduleMainMessageBuilder';

export class DiscordMessageService {
  /**
   * スケジュールメッセージ（EmbedとComponents）を作成
   */
  formatScheduleMessage(
    summary: ScheduleSummaryResponseDto,
    showVoteButton: boolean
  ): { embed: object; components: object[] } {
    const { embed, components } = ScheduleMainMessageBuilder.createMainMessage({
      summary,
      showDetails: false, // 投票後更新は簡易表示（詳細表示はボタンで切り替え）
      showVoteButtons: showVoteButton,
    });

    return { embed, components };
  }
}

import type {
  ScheduleResponseDto,
  ScheduleSummaryResponseDto,
} from '../../application/dto/ScheduleDto';
import { EMBED_COLORS, STATUS_EMOJI } from '../constants/ui';
import { createButtonId } from './button-helpers';
import { formatDate } from './date-formatter';

export interface CreateScheduleEmbedOptions {
  readonly schedule: ScheduleResponseDto;
  readonly totalResponses?: number;
  readonly summary?: ScheduleSummaryResponseDto;
}

export interface CreateScheduleEmbedWithTableOptions {
  readonly summary: ScheduleSummaryResponseDto;
  readonly showDetails?: boolean;
}

export interface CreateSimpleScheduleComponentsOptions {
  readonly schedule: ScheduleResponseDto;
  readonly showDetails?: boolean;
}

export function createScheduleEmbed(options: CreateScheduleEmbedOptions) {
  const { schedule, totalResponses, summary } = options;
  // 最有力候補を判定
  const bestDateId = summary?.bestDateId || summary?.statistics?.optimalDates?.optimalDateId;
  const hasResponses = summary?.responses && summary.responses.length > 0;

  // 日程フィールドを作成
  const dateFields = schedule.dates.map((date, idx) => {
    const isBest = date.id === bestDateId && hasResponses;
    const prefix = isBest ? '⭐ ' : '';
    const dateStr = date.datetime;

    let fieldValue = '';
    if (summary?.responseCounts) {
      const count = summary.responseCounts[date.id] || { yes: 0, maybe: 0, no: 0 };
      fieldValue = `**集計：** ${STATUS_EMOJI.yes} ${count.yes}人 ${STATUS_EMOJI.maybe} ${count.maybe}人 ${STATUS_EMOJI.no} ${count.no}人`;
    } else {
      fieldValue = '集計なし';
    }

    return {
      name: `${prefix}${idx + 1}. **${dateStr}**`,
      value: fieldValue,
      inline: false,
    };
  });

  const descriptionParts = [schedule.description || '', ''];

  if (schedule.deadline) {
    const deadlineStr = schedule.deadline || '';
    descriptionParts.push(`⏰ **締切：** ${formatDate(deadlineStr)}`);
  }

  if (totalResponses !== undefined) {
    descriptionParts.push(`**回答者：** ${totalResponses}人`);
  }

  return {
    title: `📅 ${schedule.title}`,
    description: descriptionParts.filter(Boolean).join('\n'),
    color: schedule.status === 'open' ? EMBED_COLORS.OPEN : EMBED_COLORS.CLOSED,
    fields: dateFields.slice(0, 25), // Discord's limit
    footer: {
      text: `作成：${schedule.createdBy.displayName || schedule.createdBy.username}`,
    },
    timestamp: schedule.createdAt,
  };
}

export function createScheduleEmbedWithTable(options: CreateScheduleEmbedWithTableOptions) {
  const { summary, showDetails = false } = options;
  const schedule = summary.schedule;
  const responseCounts = summary.responseCounts;
  const bestDateId = summary.bestDateId || summary.statistics?.optimalDates?.optimalDateId;
  const userResponses = summary.responses || [];

  // 日程リストを作成（番号付き）
  const dateFields = schedule.dates.map((date, idx) => {
    const count = responseCounts[date.id];
    const isBest = date.id === bestDateId && userResponses.length > 0;
    // 日程候補は自由文字列なのでそのまま表示
    const dateStr = date.datetime;

    // 集計のみ（詳細なし）
    let fieldValue = `**集計：** ${STATUS_EMOJI.yes} ${count.yes}人 ${STATUS_EMOJI.maybe} ${count.maybe}人 ${STATUS_EMOJI.no} ${count.no}人`;

    // 詳細表示の場合は各ユーザーの回答も含める
    if (showDetails && userResponses.length > 0) {
      // 回答を状態別にグループ化（投票順を保持）
      const responsesByStatus: Record<string, string[]> = {
        ok: [],
        maybe: [],
        ng: [],
      };

      userResponses.forEach((ur) => {
        const status = ur.dateStatuses[date.id];
        if (!status) return;

        // 名前の表示
        const displayName = ur.displayName || ur.username;

        if (status === 'ok') {
          responsesByStatus.ok.push(displayName);
        } else if (status === 'maybe') {
          responsesByStatus.maybe.push(displayName);
        } else {
          responsesByStatus.ng.push(displayName);
        }
      });

      // 順序を固定：✅ → ❓ → ❌
      const responseLines: string[] = [];

      if (responsesByStatus.ok.length > 0) {
        responseLines.push(`${STATUS_EMOJI.yes} ${responsesByStatus.ok.join(', ')}`);
      }
      if (responsesByStatus.maybe.length > 0) {
        responseLines.push(`${STATUS_EMOJI.maybe} ${responsesByStatus.maybe.join(', ')}`);
      }
      if (responsesByStatus.ng.length > 0) {
        responseLines.push(`${STATUS_EMOJI.no} ${responsesByStatus.ng.join(', ')}`);
      }

      if (responseLines.length > 0) {
        fieldValue += `\n${responseLines.join(' ')}`;
      } else {
        fieldValue += '\n回答なし';
      }
    }

    return {
      name: `${isBest ? '⭐ ' : ''}${idx + 1}. **${dateStr}**`,
      value: fieldValue,
      inline: false,
    };
  });

  // 締切情報を description に追加
  const descriptionParts = [schedule.description || '', ''];

  if (schedule.deadline) {
    // deadline is always a string in DTOs
    descriptionParts.push(`⏰ **締切：** ${formatDate(schedule.deadline)}`);
  }

  descriptionParts.push(`**回答者：** ${userResponses.length}人`);

  return {
    title: `📅 ${schedule.title}`,
    description: descriptionParts.filter(Boolean).join('\n'),
    color: schedule.status === 'open' ? EMBED_COLORS.OPEN : EMBED_COLORS.CLOSED,
    fields: dateFields.slice(0, 25), // Discord's limit
    footer: {
      text: `作成：${schedule.createdBy.displayName || schedule.createdBy.username}`,
    },
    timestamp: schedule.updatedAt,
  };
}

export function createSimpleScheduleComponents(options: CreateSimpleScheduleComponentsOptions) {
  const { schedule, showDetails = false } = options;
  const components = [];

  // 回答するボタン（開いている時のみ）
  if (schedule.status === 'open') {
    components.push({
      type: 2,
      style: 1, // Primary
      label: '回答する',
      custom_id: createButtonId('respond', schedule.id),
      emoji: { name: '✏️' },
    });
  }

  // 詳細/簡易表示ボタン
  if (showDetails) {
    // 詳細表示中は簡易表示ボタンを表示
    components.push({
      type: 2,
      style: 2, // Secondary
      label: '簡易表示',
      custom_id: createButtonId('hide_details', schedule.id),
      emoji: { name: '📊' },
    });
  } else {
    // 簡易表示中は詳細ボタンを表示
    components.push({
      type: 2,
      style: 2, // Secondary
      label: '詳細',
      custom_id: createButtonId('status', schedule.id),
      emoji: { name: '👥' },
    });
  }

  // 更新ボタン（一時的にコメントアウト）
  /*
  components.push({
    type: 2,
    style: 2, // Secondary
    label: '更新',
    custom_id: createButtonId('refresh', schedule.id),
    emoji: { name: '🔄' },
  });
  */

  // 編集ボタン（常に表示）
  components.push({
    type: 2,
    style: 2, // Secondary
    label: '編集',
    custom_id: createButtonId('edit', schedule.id),
    emoji: { name: '⚙️' },
  });

  return [
    {
      type: 1,
      components,
    },
  ];
}

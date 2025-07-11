import { STATUS_EMOJI, EMBED_COLORS } from '../constants/ui';
import { ScheduleSummaryResponse, ScheduleResponse } from '../application/dto/ScheduleDto';
import { DomainSchedule } from '../domain/types/DomainTypes';
import { createButtonId } from './id';
import { formatDate } from './date';

export function createScheduleEmbed(schedule: DomainSchedule | ScheduleResponse) {
  const dateList = schedule.dates
    .map((date: any, index: number) => `${index + 1}. ${date.datetime}`)
    .join('\n');
  
  const descriptionParts = [
    schedule.description || '',
    ''
  ];
  
  if (schedule.deadline) {
    const deadlineStr = schedule.deadline instanceof Date 
      ? schedule.deadline.toISOString() 
      : schedule.deadline;
    descriptionParts.push(`⏰ 締切: ${formatDate(deadlineStr)}`);
    descriptionParts.push('');
  }
  
  descriptionParts.push('**候補日時:**');
  descriptionParts.push(dateList);
  descriptionParts.push('');
  descriptionParts.push('下の「回答する」ボタンを押して参加可否を入力してください。');
  
  return {
    title: `📅 ${schedule.title}`,
    description: descriptionParts.filter(Boolean).join('\n'),
    color: schedule.status === 'open' ? EMBED_COLORS.OPEN : EMBED_COLORS.CLOSED,
    fields: [],
    footer: {
      text: `作成: ${schedule.createdBy.username}`
    },
    timestamp: schedule.createdAt instanceof Date ? schedule.createdAt.toISOString() : schedule.createdAt
  };
}

export function createScheduleEmbedWithTable(summary: ScheduleSummaryResponse, showDetails: boolean = false) {
  const schedule = summary.schedule;
  const responseCounts = summary.responseCounts;
  const bestDateId = summary.bestDateId || summary.statistics?.optimalDates?.optimalDateId;
  const userResponses = summary.responses || [];
  
  // 日程リストを作成（番号付き）
  const dateFields = schedule.dates.map((date, idx) => {
    const count = responseCounts[date.id];
    const isBest = date.id === bestDateId && userResponses.length > 0;
    const dateStr = date.datetime;
    
    // 集計のみ（詳細なし）
    let fieldValue = `集計: ${STATUS_EMOJI.yes} ${count.yes}人 ${STATUS_EMOJI.maybe} ${count.maybe}人 ${STATUS_EMOJI.no} ${count.no}人`;
    
    // 詳細表示の場合は各ユーザーの回答も含める
    if (showDetails && userResponses.length > 0) {
      const responses = userResponses
        .map((ur) => {
          const status = ur.dateStatuses[date.id];
          if (!status) return null;
          const statusEmoji = status === 'ok' ? STATUS_EMOJI.yes : status === 'maybe' ? STATUS_EMOJI.maybe : STATUS_EMOJI.no;
          const comment = ur.comment ? ` (${ur.comment})` : '';
          return `${statusEmoji} ${ur.username}${comment}`;
        })
        .filter((r): r is string => r !== null);
      
      if (responses.length > 0) {
        fieldValue += '\n' + responses.join(', ');
      } else {
        fieldValue += '\n回答なし';
      }
    }
    
    return {
      name: `${isBest ? '⭐ ' : ''}${idx + 1}. ${dateStr}`,
      value: fieldValue,
      inline: false
    };
  });

  // 締切情報を description に追加
  const descriptionParts = [
    schedule.description || '',
    ''
  ];
  
  if (schedule.deadline) {
    // Handle both Date and string types
    const deadlineStr = (schedule.deadline as unknown) instanceof Date
      ? (schedule.deadline as unknown as Date).toISOString() 
      : schedule.deadline as string;
    descriptionParts.push(`⏰ 締切: ${formatDate(deadlineStr)}`);
  }
  
  descriptionParts.push(`回答者: ${userResponses.length}人`);
  
  return {
    title: `📅 ${schedule.title}`,
    description: descriptionParts.filter(Boolean).join('\n'),
    color: schedule.status === 'open' ? EMBED_COLORS.OPEN : EMBED_COLORS.CLOSED,
    fields: dateFields.slice(0, 25), // Discord's limit
    footer: {
      text: [
        `作成: ${schedule.createdBy.username}`,
        '最新の情報は更新をクリック'
      ].join(' | ')
    },
    timestamp: schedule.updatedAt
  };
}

export function createSimpleScheduleComponents(schedule: DomainSchedule | ScheduleResponse, showDetails: boolean = false) {
  const components = [];

  // 回答するボタン（開いている時のみ）
  if (schedule.status === 'open') {
    components.push({
      type: 2,
      style: 1, // Primary
      label: '回答する',
      custom_id: createButtonId('respond', schedule.id),
      emoji: { name: '✏️' }
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
      emoji: { name: '📊' }
    });
  } else {
    // 簡易表示中は詳細ボタンを表示
    components.push({
      type: 2,
      style: 2, // Secondary
      label: '詳細',
      custom_id: createButtonId('status', schedule.id),
      emoji: { name: '👥' }
    });
  }

  // 更新ボタン
  components.push({
    type: 2,
    style: 2, // Secondary
    label: '更新',
    custom_id: createButtonId('refresh', schedule.id),
    emoji: { name: '🔄' }
  });

  // 編集ボタン（常に表示）
  components.push({
    type: 2,
    style: 2, // Secondary
    label: '編集',
    custom_id: createButtonId('edit', schedule.id),
    emoji: { name: '⚙️' }
  });

  return [
    {
      type: 1,
      components
    }
  ];
}
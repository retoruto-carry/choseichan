import { Schedule, ScheduleSummary, STATUS_EMOJI, EMBED_COLORS } from '../types/schedule';
import { formatDate } from './date';
import { createButtonId } from './id';

export function createScheduleEmbed(schedule: Schedule) {
  const dateList = schedule.dates
    .map((date, index) => `${index + 1}. ${formatDate(date.datetime)}`)
    .join('\n');
  
  return {
    title: `📅 ${schedule.title}`,
    description: [
      schedule.description || '',
      '',
      '**候補日時:**',
      dateList,
      '',
      '下の「回答する」ボタンを押して参加可否を入力してください。'
    ].filter(Boolean).join('\n'),
    color: schedule.status === 'open' ? EMBED_COLORS.OPEN : EMBED_COLORS.CLOSED,
    fields: [],
    footer: {
      text: [
        `作成: ${schedule.createdBy.username}`,
        schedule.deadline ? `締切: ${formatDate(schedule.deadline.toISOString())}` : null
      ].filter(Boolean).join(' | ')
    },
    timestamp: schedule.createdAt.toISOString()
  };
}

export function createScheduleEmbedWithTable(summary: ScheduleSummary) {
  const { schedule, userResponses, responseCounts, bestDateId } = summary;
  
  // 日程リストを作成（番号付き）
  const dateFields = schedule.dates.map((date, idx) => {
    const count = responseCounts[date.id];
    const isBest = date.id === bestDateId && userResponses.length > 0;
    const dateStr = formatDate(date.datetime);
    
    // 各ユーザーの回答をまとめる
    const responses = userResponses
      .map(ur => {
        const response = ur.responses.find(r => r.dateId === date.id);
        if (!response) return null;
        const comment = response.comment ? ` (${response.comment})` : '';
        return `${STATUS_EMOJI[response.status]} ${ur.userName}${comment}`;
      })
      .filter(Boolean);
    
    return {
      name: `${isBest ? '⭐ ' : ''}${idx + 1}. ${dateStr}`,
      value: [
        `集計: ${STATUS_EMOJI.yes} ${count.yes}人 ${STATUS_EMOJI.maybe} ${count.maybe}人 ${STATUS_EMOJI.no} ${count.no}人`,
        responses.length > 0 ? responses.join(', ') : '回答なし'
      ].join('\n'),
      inline: false
    };
  });
  
  return {
    title: `📅 ${schedule.title}`,
    description: [
      schedule.description || '',
      '',
      `回答者: ${userResponses.length}人`
    ].filter(Boolean).join('\n'),
    color: schedule.status === 'open' ? EMBED_COLORS.OPEN : EMBED_COLORS.CLOSED,
    fields: dateFields.slice(0, 25), // Discord's limit
    footer: {
      text: [
        `作成: ${schedule.createdBy.username}`,
        schedule.deadline ? `締切: ${formatDate(schedule.deadline.toISOString())}` : null
      ].filter(Boolean).join(' | ')
    },
    timestamp: schedule.updatedAt.toISOString()
  };
}

export function createScheduleComponents(schedule: Schedule) {
  if (schedule.status === 'closed') {
    return [];
  }

  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 1, // Primary
          label: '回答する',
          custom_id: createButtonId('response', schedule.id),
          emoji: { name: '✏️' }
        },
        {
          type: 2,
          style: 2, // Secondary
          label: '状況を見る',
          custom_id: createButtonId('status', schedule.id),
          emoji: { name: '📊' }
        },
        {
          type: 2,
          style: 2, // Secondary
          label: '編集',
          custom_id: createButtonId('edit', schedule.id),
          emoji: { name: '⚙️' }
        }
      ]
    }
  ];
}

export function createSimpleScheduleComponents(schedule: Schedule) {
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 1, // Primary
          label: '回答する',
          custom_id: createButtonId('respond', schedule.id),
          emoji: { name: '✏️' }
        },
        {
          type: 2,
          style: 2, // Secondary
          label: '詳細を見る',
          custom_id: createButtonId('details', schedule.id),
          emoji: { name: '📊' }
        },
        {
          type: 2,
          style: 2, // Secondary
          label: '編集',
          custom_id: createButtonId('edit', schedule.id),
          emoji: { name: '⚙️' }
        },
        {
          type: 2,
          style: 2, // Secondary
          label: '締め切る',
          custom_id: createButtonId('close', schedule.id),
          emoji: { name: '🔒' }
        }
      ]
    }
  ];
}
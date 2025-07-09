import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { EMBED_COLORS } from '../types/schedule';

export function createHelpEmbed() {
  return {
    title: '📚 ちょうせいくん - 使い方',
    description: 'Discord上で簡単に日程調整ができるボットです',
    color: EMBED_COLORS.INFO,
    fields: [
      {
        name: '📝 日程調整を作成',
        value: '`/schedule create title:"懇親会" date1:"12/25 19:00" date2:"12/26 18:00"`\n日程は最大10個まで指定できます',
        inline: false
      },
      {
        name: '📋 日程調整一覧を表示',
        value: '`/schedule list`\nチャンネル内の日程調整を一覧表示します',
        inline: false
      },
      {
        name: '📊 集計結果を確認',
        value: '`/schedule status id:"調整ID"`\n指定した日程調整の現在の集計状況を表示します',
        inline: false
      },
      {
        name: '🔒 日程調整を締切',
        value: '`/schedule close id:"調整ID"`\n作成者のみが締切できます',
        inline: false
      },
      {
        name: '🔘 回答方法',
        value: '各日程のボタンをクリックして、○△×で回答してください\n○: 参加可能\n△: 未定・条件付き\n×: 参加不可',
        inline: false
      },
      {
        name: '💡 便利な機能',
        value: '• 回答は何度でも変更可能\n• 「詳細を見る」ボタンで全員の回答を確認\n• 最有力候補は⭐マークで表示\n• CSV形式でエクスポート可能',
        inline: false
      }
    ],
    footer: {
      text: 'ちょうせいくん v1.0.0'
    }
  };
}

export function handleHelpCommand() {
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [createHelpEmbed()],
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
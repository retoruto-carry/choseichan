import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { EMBED_COLORS } from '../types/schedule';

export function createHelpEmbed() {
  return {
    title: '📚 調整ちゃん - 使い方',
    description: 'Discord上で簡単に日程調整ができるボットです',
    color: EMBED_COLORS.INFO,
    fields: [
      {
        name: '📝 日程調整を作成',
        value: '`/choseichan create`\n対話形式で日程調整を作成します',
        inline: false
      },
      {
        name: '📋 日程調整一覧を表示',
        value: '`/choseichan list`\nチャンネル内の日程調整を一覧表示します',
        inline: false
      },
      {
        name: '🆘 ヘルプを表示',
        value: '`/choseichan help`\nこのヘルプメッセージを表示します',
        inline: false
      },
      {
        name: '🔘 回答方法',
        value: '1. 日程調整メッセージの「回答する」ボタンをクリック\n2. 各日程の横にある○△×ボタンで回答\n　○: 参加可能\n　△: 未定・条件付き\n　×: 参加不可',
        inline: false
      },
      {
        name: '📊 回答状況の確認',
        value: '「状況を見る」ボタンで現在の回答状況を表形式で確認できます',
        inline: false
      },
      {
        name: '💡 便利な機能',
        value: '• 回答は何度でも変更可能\n• 個人向けメッセージは自分だけに表示\n• 回答状況は表形式でわかりやすく表示\n• 最有力候補は自動で判定',
        inline: false
      }
    ],
    footer: {
      text: '調整ちゃん v1.0.0'
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
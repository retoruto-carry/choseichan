import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';
import { ModalInteraction, Env } from '../../types/discord';
import { Schedule, ScheduleDate } from '../../types/schedule';
import { StorageServiceV2 as StorageService } from '../../services/storage-v2';
import { generateId } from '../../utils/id';
import { parseUserInputDate } from '../../utils/date';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from '../../utils/embeds';

export async function handleCreateScheduleModal(
  interaction: ModalInteraction,
  storage: StorageService,
  env: Env
): Promise<Response> {
  // Extract form values
  const title = interaction.data.components[0].components[0].value;
  const description = interaction.data.components[1].components[0].value || undefined;
  const datesText = interaction.data.components[2].components[0].value;
  const deadlineStr = interaction.data.components[3]?.components[0].value || undefined;

  // Parse dates
  const dates = datesText.split('\n').filter((line: string) => line.trim());
  if (dates.length === 0) {
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程候補を入力してください。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const scheduleDates: ScheduleDate[] = dates.map((date: string) => ({
    id: generateId(),
    datetime: date.trim()
  }));

  // Parse deadline
  let deadlineDate: Date | undefined = undefined;
  if (deadlineStr && deadlineStr.trim()) {
    const parsedDate = parseUserInputDate(deadlineStr);
    deadlineDate = parsedDate || undefined;
    if (!deadlineDate) {
      return new Response(JSON.stringify({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: '締切日時の形式が正しくありません。',
          flags: InteractionResponseFlags.EPHEMERAL
        }
      }), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  // デフォルトのリマインダー設定（締切がある場合のみ）
  let reminderTimings: string[] | undefined = undefined;
  let reminderMentions: string[] | undefined = undefined;
  
  if (deadlineDate) {
    // デフォルトのリマインダータイミング
    reminderTimings = ['3d', '1d', '8h'];
    // デフォルトの通知先
    reminderMentions = ['@here'];
  }

  const guildId = interaction.guild_id || 'default';
  
  const authorId = interaction.member?.user.id || interaction.user?.id || '';
  
  const schedule: Schedule = {
    id: generateId(),
    title,
    description,
    dates: scheduleDates,
    deadline: deadlineDate,
    status: 'open',
    createdBy: {
      id: authorId,
      username: interaction.member?.user.username || interaction.user?.username || ''
    },
    authorId,
    channelId: interaction.channel_id || '',
    guildId,
    createdAt: new Date(),
    updatedAt: new Date(),
    notificationSent: false,
    reminderSent: false,
    remindersSent: [],
    reminderTimings: deadlineDate ? reminderTimings : undefined,
    reminderMentions: deadlineDate ? reminderMentions : undefined,
    totalResponses: 0
  };

  if (!schedule.guildId) schedule.guildId = guildId;
  await storage.saveSchedule(schedule);

  // Create response
  const summary = await storage.getScheduleSummary(schedule.id, guildId);
  if (!summary) {
    // Fallback
    return new Response(JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: '日程調整を作成しました。',
        flags: InteractionResponseFlags.EPHEMERAL
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  const embed = createScheduleEmbedWithTable(summary, false);
  const components = createSimpleScheduleComponents(schedule, false);

  // メッセージIDを保存するための処理と、リマインダー編集ボタンの送信
  if (env.DISCORD_APPLICATION_ID && env.ctx) {
    env.ctx.waitUntil(
      (async () => {
        try {
          // 作成されたメッセージの情報を取得
          const { getOriginalMessage } = await import('../../utils/discord');
          const message = await getOriginalMessage(env.DISCORD_APPLICATION_ID, interaction.token);
          
          if (message?.id) {
            // メッセージIDを保存
            schedule.messageId = message.id;
            if (!schedule.guildId) schedule.guildId = guildId;
            await storage.saveSchedule(schedule);
          }
          
          // 締切がある場合、リマインダー編集ボタンをフォローアップメッセージで送信
          if (schedule.deadline && schedule.reminderTimings) {
            const timingDisplay = schedule.reminderTimings.map(t => {
              const match = t.match(/^(\d+)([dhm])$/);
              if (!match) return t;
              const value = parseInt(match[1]);
              const unit = match[2];
              if (unit === 'd') return `${value}日前`;
              if (unit === 'h') return `${value}時間前`;
              if (unit === 'm') return `${value}分前`;
              return t;
            }).join(' / ');

            const mentionDisplay = schedule.reminderMentions?.map(m => `\`${m}\``).join(' ') || '`@here`';
            
            const { sendFollowupMessage } = await import('../../utils/discord');
            await sendFollowupMessage(
              env.DISCORD_APPLICATION_ID,
              interaction.token,
              {
                content: `📅 リマインダーが設定されています: ${timingDisplay} | 宛先: ${mentionDisplay}`,
                components: [{
                  type: 1,
                  components: [{
                    type: 2,
                    custom_id: `reminder_edit:${schedule.id}`,
                    label: 'リマインダーを編集',
                    style: 2,
                    emoji: { name: '🔔' }
                  }]
                }],
                flags: InteractionResponseFlags.EPHEMERAL
              }
            );
          }
        } catch (error) {
          console.error('Failed to save message ID or send reminder edit button:', error);
        }
      })()
    );
  }

  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [embed],
      components
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
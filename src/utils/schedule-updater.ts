import { Env } from '../types/discord';
import { StorageService } from '../services/storage';
import { updateOriginalMessage } from './discord';
import { createScheduleEmbedWithTable, createSimpleScheduleComponents } from './embeds';

/**
 * スケジュールのメイン画面を更新する共通関数
 * @param scheduleId スケジュールID
 * @param messageId 更新対象のメッセージID（省略時はschedule.messageIdを使用）
 * @param interactionToken インタラクショントークン
 * @param storage StorageService インスタンス
 * @param env 環境変数
 * @returns 更新が成功したかどうか
 */
export async function updateScheduleMainMessage(
  scheduleId: string,
  messageId: string | undefined,
  interactionToken: string,
  storage: StorageService,
  env: Env
): Promise<boolean> {
  try {
    // 最新のスケジュール情報を取得
    const schedule = await storage.getSchedule(scheduleId);
    if (!schedule) {
      console.error(`Schedule not found for ID: ${scheduleId}`);
      return false;
    }

    // メッセージIDが指定されていない場合は、保存されているIDを使用
    const targetMessageId = messageId || schedule.messageId;
    if (!targetMessageId) {
      console.error(`No message ID found for schedule: ${scheduleId}`);
      return false;
    }

    // 最新のスケジュールサマリーを取得
    const summary = await storage.getScheduleSummary(scheduleId);
    if (!summary) {
      console.error(`Schedule summary not found for ID: ${scheduleId}`);
      return false;
    }

    // Discord Application IDが設定されているか確認
    if (!env.DISCORD_APPLICATION_ID) {
      console.error('DISCORD_APPLICATION_ID is not set');
      return false;
    }

    // メイン画面を更新
    await updateOriginalMessage(
      env.DISCORD_APPLICATION_ID,
      interactionToken,
      targetMessageId,
      {
        embeds: [createScheduleEmbedWithTable(summary)],
        components: createSimpleScheduleComponents(summary.schedule)
      }
    );

    // メッセージIDが新しく指定された場合は保存
    if (messageId && messageId !== schedule.messageId) {
      schedule.messageId = messageId;
      await storage.saveSchedule(schedule);
    }

    return true;
  } catch (error) {
    console.error('Failed to update schedule main message:', error);
    return false;
  }
}

/**
 * インタラクションからメッセージIDを安全に取得する
 * @param interaction インタラクション
 * @returns メッセージID（取得できない場合は空文字）
 */
export function getMessageIdFromInteraction(interaction: any): string {
  // 優先順位：
  // 1. message_reference.message_id (返信元のメッセージ)
  // 2. message.id (インタラクションが発生したメッセージ)
  // 3. 空文字列（取得できない場合）
  
  if (interaction.message?.message_reference?.message_id) {
    return interaction.message.message_reference.message_id;
  }
  
  if (interaction.message?.id) {
    return interaction.message.id;
  }
  
  return '';
}

/**
 * スケジュールにメッセージIDを保存する
 * @param scheduleId スケジュールID
 * @param messageId メッセージID
 * @param storage StorageService インスタンス
 */
export async function saveScheduleMessageId(
  scheduleId: string,
  messageId: string,
  storage: StorageService
): Promise<void> {
  const schedule = await storage.getSchedule(scheduleId);
  if (schedule && schedule.messageId !== messageId) {
    schedule.messageId = messageId;
    await storage.saveSchedule(schedule);
  }
}
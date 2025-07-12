import { InteractionResponseType, InteractionType, verifyKey } from 'discord-interactions';
import { Hono } from 'hono';
import { sendDeadlineReminders } from './infrastructure/cron/deadline-reminder';
import { Logger } from './infrastructure/logging/Logger';
import type { DeadlineReminderTask } from './infrastructure/ports/DeadlineReminderQueuePort';
import type { MessageUpdateTask } from './infrastructure/ports/MessageUpdateQueuePort';
import type { ButtonInteraction, CommandInteraction, Env } from './infrastructure/types/discord';
import { handleDeadlineReminderBatch } from './infrastructure/utils/deadline-reminder-queue';
import { handleMessageUpdateBatch } from './infrastructure/utils/message-update-queue';
import { createButtonInteractionController } from './presentation/controllers/ButtonInteractionController';
import { createCommandController } from './presentation/controllers/CommandController';
import { createModalController } from './presentation/controllers/ModalController';

const app = new Hono<{ Bindings: Env }>();

// Loggerインスタンスを作成
const logger = new Logger('discord-choseisan-main');

// ヘルスチェックエンドポイント
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'Discord Choseisan Bot',
    version: '1.2.1',
    docs: 'https://discord-choseisan.pages.dev',
  });
});

// 締切チェック用のCronエンドポイント
app.post('/cron/deadline-check', async (c) => {
  const cronSecret = c.req.header('X-Cron-Secret');

  // Cronシークレットを検証
  if (!cronSecret || cronSecret !== c.env.CRON_SECRET) {
    return c.text('Unauthorized', 401);
  }

  try {
    logger.info('Starting deadline check cron job', { operation: 'deadline-check' });
    await sendDeadlineReminders(c.env);
    logger.info('Deadline check completed successfully', { operation: 'deadline-check' });
    return c.json({ success: true, message: 'Deadline check completed' });
  } catch (error) {
    logger.error(
      'Deadline check failed',
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'deadline-check',
        useCase: 'cron',
      }
    );
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

app.post('/interactions', async (c) => {
  const { DISCORD_PUBLIC_KEY } = c.env;

  // ボディテキストを最初に取得（一度しか読めない）
  const body = await c.req.text();

  // リクエストを検証
  const signature = c.req.header('X-Signature-Ed25519');
  const timestamp = c.req.header('X-Signature-Timestamp');

  if (!signature || !timestamp) {
    return c.text('Unauthorized', 401);
  }

  const isValidRequest = await verifyKey(body, signature, timestamp, DISCORD_PUBLIC_KEY);

  if (!isValidRequest) {
    return c.text('Unauthorized', 401);
  }

  const interaction = JSON.parse(body);

  // PINGを処理
  if (interaction.type === InteractionType.PING) {
    return c.json({ type: InteractionResponseType.PONG });
  }

  // スラッシュコマンドを処理
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const command = interaction as CommandInteraction;

    switch (command.data.name) {
      case 'choseichan': {
        const envWithContext = { ...c.env, ctx: c.executionCtx };
        const controller = createCommandController(envWithContext);
        const response = await controller.handleChoseichanCommand(command, envWithContext);
        // Honoは生のResponseオブジェクトもそのまま返せる
        return response;
      }

      default:
        return c.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'Unknown command',
          },
        });
    }
  }

  // ボタンインタラクションを処理
  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const button = interaction as ButtonInteraction;
    // 実行コンテキストをenv経由で渡す
    const envWithContext = { ...c.env, ctx: c.executionCtx };
    const buttonController = createButtonInteractionController(envWithContext);
    return buttonController.handleButtonInteraction(button, envWithContext);
  }

  // モーダル送信を処理
  if (interaction.type === InteractionType.MODAL_SUBMIT) {
    const envWithContext = { ...c.env, ctx: c.executionCtx };
    const modalController = createModalController(envWithContext);
    return modalController.handleModalSubmit(interaction, envWithContext);
  }

  return c.text('Unknown interaction type', 400);
});

// Cloudflare Queuesコンシューマー
export async function queue(
  batch: MessageBatch<MessageUpdateTask | DeadlineReminderTask>,
  env: Env,
  _ctx: ExecutionContext
): Promise<void> {
  // キューの名前で処理を分岐
  if (batch.queue === 'message-update-queue') {
    await handleMessageUpdateBatch(batch as MessageBatch<MessageUpdateTask>, env);
  } else if (batch.queue === 'deadline-reminder-queue') {
    await handleDeadlineReminderBatch(batch as MessageBatch<DeadlineReminderTask>, env);
  }
}

export default app;

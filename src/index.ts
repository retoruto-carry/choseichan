import type { MessageBatch } from '@cloudflare/workers-types';
import { InteractionResponseType, InteractionType, verifyKey } from 'discord-interactions';
import { Hono } from 'hono';
import type { DeadlineReminderTask } from './application/ports/DeadlineReminderQueuePort';
import type { MessageUpdateTask } from './application/ports/MessageUpdateQueuePort';
import { sendDeadlineReminders } from './infrastructure/cron/deadline-reminder';
import { Logger } from './infrastructure/logging/Logger';
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
    // 環境変数の検証とデバッグ情報
    const envInfo = {
      hasDiscordToken: !!c.env.DISCORD_TOKEN,
      hasDiscordAppId: !!c.env.DISCORD_APPLICATION_ID,
      hasDB: !!c.env.DB,
      hasMessageUpdateQueue: !!c.env.MESSAGE_UPDATE_QUEUE,
      hasDeadlineReminderQueue: !!c.env.DEADLINE_REMINDER_QUEUE,
      hasCronSecret: !!c.env.CRON_SECRET,
      hasCtx: !!c.env.ctx,
    };

    logger.info('Environment check for cron job', {
      operation: 'deadline-check',
      envInfo,
    });

    const missingVars = [];
    if (!c.env.DISCORD_TOKEN) missingVars.push('DISCORD_TOKEN');
    if (!c.env.DISCORD_APPLICATION_ID) missingVars.push('DISCORD_APPLICATION_ID');
    if (!c.env.DB) missingVars.push('DB');

    if (missingVars.length > 0) {
      logger.error(
        'Missing required environment variables',
        new Error('Environment setup incomplete'),
        {
          operation: 'deadline-check',
          missingVars,
          envInfo,
        }
      );
      return c.json(
        {
          success: false,
          error: 'Configuration error',
          details: `Missing environment variables: ${missingVars.join(', ')}`,
        },
        500
      );
    }

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
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      }
    );
    return c.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
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
      case 'chouseichan': {
        const envWithContext = { ...c.env, ctx: c.executionCtx };
        const controller = createCommandController(envWithContext);
        const response = await controller.handleChouseichanCommand(command, envWithContext);
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

  // ボタンとセレクトメニューインタラクションを処理
  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const component = interaction as ButtonInteraction;
    const envWithContext = { ...c.env, ctx: c.executionCtx };

    // セレクトメニューの場合
    if (component.data.component_type === 3) {
      // SELECT_MENU
      const { createSelectMenuController } = await import(
        './presentation/controllers/SelectMenuController'
      );
      const selectMenuController = createSelectMenuController(envWithContext);
      return selectMenuController.handleSelectMenuInteraction(component, envWithContext);
    }

    // ボタンの場合
    const buttonController = createButtonInteractionController(envWithContext);
    return buttonController.handleButtonInteraction(component, envWithContext);
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
  if (batch.queue === 'chouseichan-message-update-queue') {
    await handleMessageUpdateBatch(batch as MessageBatch<MessageUpdateTask>, env);
  } else if (batch.queue === 'chouseichan-deadline-reminder-queue') {
    await handleDeadlineReminderBatch(batch as MessageBatch<DeadlineReminderTask>, env);
  }
}

export default {
  fetch: app.fetch,
  queue,
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    logger.info('Scheduled cron job triggered', {
      cron: event.cron,
      scheduledTime: event.scheduledTime,
    });

    try {
      await sendDeadlineReminders({ ...env, ctx });
      logger.info('Scheduled deadline check completed successfully');
    } catch (error) {
      logger.error(
        'Scheduled deadline check failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          operation: 'scheduled-deadline-check',
          errorMessage: error instanceof Error ? error.message : String(error),
        }
      );
      throw error;
    }
  },
};

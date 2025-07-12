import { InteractionResponseType, InteractionType, verifyKey } from 'discord-interactions';
import { Hono } from 'hono';
import { sendDeadlineReminders } from './infrastructure/cron/deadline-reminder';
import { Logger } from './infrastructure/logging/Logger';
import type { ButtonInteraction, CommandInteraction, Env } from './infrastructure/types/discord';
import { createButtonInteractionController } from './presentation/controllers/ButtonInteractionController';
import { createCommandController } from './presentation/controllers/CommandController';
import { createModalController } from './presentation/controllers/ModalController';

const app = new Hono<{ Bindings: Env }>();

// Loggerインスタンスを作成
const logger = new Logger('discord-choseisan-main');

// Health check endpoint
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'Discord Choseisan Bot',
    version: '1.2.1',
    docs: 'https://discord-choseisan.pages.dev',
  });
});

// Cron endpoint for deadline checks
app.post('/cron/deadline-check', async (c) => {
  const cronSecret = c.req.header('X-Cron-Secret');

  // Verify cron secret
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

  // Get body text first (can only be read once)
  const body = await c.req.text();

  // Verify the request
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

  // Handle PING
  if (interaction.type === InteractionType.PING) {
    return c.json({ type: InteractionResponseType.PONG });
  }

  // Handle slash commands
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

  // Handle button interactions
  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const button = interaction as ButtonInteraction;
    // Pass execution context through env
    const envWithContext = { ...c.env, ctx: c.executionCtx };
    const buttonController = createButtonInteractionController(envWithContext);
    return buttonController.handleButtonInteraction(button, envWithContext);
  }

  // Handle modal submits
  if (interaction.type === InteractionType.MODAL_SUBMIT) {
    const envWithContext = { ...c.env, ctx: c.executionCtx };
    const modalController = createModalController(envWithContext);
    return modalController.handleModalSubmit(interaction, envWithContext);
  }

  return c.text('Unknown interaction type', 400);
});

export default app;

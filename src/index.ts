import { Hono } from 'hono';
import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';
import { Env, CommandInteraction, ButtonInteraction } from './types/discord';

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => {
  return c.text('Discord Choseisan Bot is running!');
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

  const isValidRequest = await verifyKey(
    body,
    signature,
    timestamp,
    DISCORD_PUBLIC_KEY
  );

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
      case 'schedule':
        const { handleScheduleCommand } = await import('./handlers/commands');
        const envWithContext = { ...c.env, ctx: c.executionCtx };
        return handleScheduleCommand(command, envWithContext);
      
      case 'help':
        const { handleHelpCommand } = await import('./handlers/help');
        return handleHelpCommand();
      
      default:
        return c.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'Unknown command'
          }
        });
    }
  }

  // Handle button interactions
  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const button = interaction as ButtonInteraction;
    const { handleButtonInteraction } = await import('./handlers/buttons');
    // Pass execution context through env
    const envWithContext = { ...c.env, ctx: c.executionCtx };
    return handleButtonInteraction(button, envWithContext);
  }

  // Handle modal submits
  if (interaction.type === InteractionType.MODAL_SUBMIT) {
    const { handleModalSubmit } = await import('./handlers/modals');
    const envWithContext = { ...c.env, ctx: c.executionCtx };
    return handleModalSubmit(interaction, envWithContext);
  }

  return c.text('Unknown interaction type', 400);
});

export default app;
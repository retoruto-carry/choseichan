import { DISCORD_API_CONSTANTS } from '../../infrastructure/constants/DiscordConstants';
import { getLogger } from '../../infrastructure/logging/Logger';
import type { Env } from '../../infrastructure/types/discord';
import type { DiscordComponent } from '../../infrastructure/types/discord-api';

const logger = getLogger();

/**
 * Send a followup message using webhook
 */
export async function sendFollowupMessage(
  applicationId: string,
  interactionToken: string,
  content: string,
  components: DiscordComponent[],
  env: Env
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${env.DISCORD_TOKEN}`,
      },
      body: JSON.stringify({
        content,
        components,
        flags: DISCORD_API_CONSTANTS.FLAGS.EPHEMERAL, // Ephemeral
      }),
    });

    if (!response.ok) {
      logger.error(
        'Failed to send followup message',
        new Error(`HTTP ${response.status}: ${await response.text()}`),
        {
          status: response.status,
          applicationId,
          hasToken: !!interactionToken,
        }
      );
    }
  } catch (error) {
    logger.error(
      'Error sending followup message',
      error instanceof Error ? error : new Error(String(error)),
      {
        applicationId,
        hasToken: !!interactionToken,
      }
    );
  }
}

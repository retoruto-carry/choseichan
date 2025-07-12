import type { Env } from '../../infrastructure/types/discord';
import type { DiscordComponent } from '../../infrastructure/types/discord-api';

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
        flags: 64, // Ephemeral
      }),
    });

    if (!response.ok) {
      console.error('Failed to send followup message:', response.status, await response.text());
    }
  } catch (error) {
    console.error('Error sending followup message:', error);
  }
}

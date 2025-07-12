import { InteractionResponseFlags, InteractionResponseType } from 'discord-interactions';
import type { DiscordComponent, DiscordEmbed } from '../../infrastructure/types/discord-api';

/**
 * Create an ephemeral response
 */
export function createEphemeralResponse(
  content: string,
  embeds?: DiscordEmbed[],
  components?: DiscordComponent[]
): Response {
  return new Response(
    JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content,
        embeds,
        components,
        flags: InteractionResponseFlags.EPHEMERAL,
      },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Create an error response (always ephemeral)
 */
export function createErrorResponse(error: string): Response {
  return createEphemeralResponse(`❌ ${error}`);
}

/**
 * Create a success response
 */
export function createSuccessResponse(message: string, ephemeral: boolean = false): Response {
  return new Response(
    JSON.stringify({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `✅ ${message}`,
        flags: ephemeral ? InteractionResponseFlags.EPHEMERAL : undefined,
      },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Create a deferred update response
 */
export function createDeferredUpdateResponse(): Response {
  return new Response(
    JSON.stringify({
      type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

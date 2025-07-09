import { InteractionResponseType, InteractionResponseFlags } from 'discord-interactions';

/**
 * Create an ephemeral response
 */
export function createEphemeralResponse(content: string, embeds?: any[], components?: any[]): Response {
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      embeds,
      components,
      flags: InteractionResponseFlags.EPHEMERAL
    }
  }), { headers: { 'Content-Type': 'application/json' } });
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
  return new Response(JSON.stringify({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `✅ ${message}`,
      flags: ephemeral ? InteractionResponseFlags.EPHEMERAL : undefined
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

/**
 * Create an update message response
 */
export function createUpdateResponse(content: string, embeds?: any[], components?: any[]): Response {
  return new Response(JSON.stringify({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      content,
      embeds,
      components
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}

/**
 * Create a modal response
 */
export function createModalResponse(modal: any): Response {
  return new Response(JSON.stringify({
    type: InteractionResponseType.MODAL,
    data: modal
  }), { headers: { 'Content-Type': 'application/json' } });
}

/**
 * Create a deferred update response
 */
export function createDeferredUpdateResponse(): Response {
  return new Response(JSON.stringify({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE
  }), { headers: { 'Content-Type': 'application/json' } });
}
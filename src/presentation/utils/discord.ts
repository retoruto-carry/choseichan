export interface UpdateOriginalMessageOptions {
  readonly applicationId: string;
  readonly token: string;
  readonly data: import('../../infrastructure/types/discord-api').DiscordMessageData;
  readonly messageId?: string;
}

export interface GetOriginalMessageOptions {
  readonly applicationId: string;
  readonly token: string;
}

export interface DeleteMessageOptions {
  readonly applicationId: string;
  readonly token: string;
  readonly messageId: string;
}

export interface SendFollowupMessageOptions {
  readonly applicationId: string;
  readonly token: string;
  readonly data: import('../../infrastructure/types/discord-api').DiscordMessageData;
}

export async function updateOriginalMessage(options: UpdateOriginalMessageOptions): Promise<void> {
  const { applicationId, token, data, messageId } = options;
  const url = messageId
    ? `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/${messageId}`
    : `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update message: ${response.status} - ${errorText}`);
  }
}

export async function getOriginalMessage(
  options: GetOriginalMessageOptions
): Promise<{ id?: string }> {
  const { applicationId, token } = options;
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get message: ${response.status}`);
  }

  return response.json();
}

export async function deleteMessage(options: DeleteMessageOptions): Promise<void> {
  const { applicationId, token, messageId } = options;
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/${messageId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete message: ${response.status} - ${errorText}`);
  }
}

export async function sendFollowupMessage(options: SendFollowupMessageOptions): Promise<unknown> {
  const { applicationId, token, data } = options;
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${token}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send followup message: ${response.status} - ${errorText}`);
  }

  return response.json();
}

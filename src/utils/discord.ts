export async function updateOriginalMessage(
  applicationId: string,
  token: string,
  data: import('../types/discord-api').DiscordMessageData,
  messageId?: string
): Promise<void> {
  const url = messageId 
    ? `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/${messageId}`
    : `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update message: ${response.status} - ${errorText}`);
  }
}

export async function getOriginalMessage(
  applicationId: string,
  token: string
): Promise<{ id?: string }> {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to get message: ${response.status}`);
  }
  
  return response.json();
}

export async function deleteMessage(
  applicationId: string,
  token: string,
  messageId: string
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/${messageId}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete message: ${response.status} - ${errorText}`);
  }
}

export async function sendFollowupMessage(
  applicationId: string,
  token: string,
  data: import('../types/discord-api').DiscordMessageData
): Promise<unknown> {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${token}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send followup message: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}
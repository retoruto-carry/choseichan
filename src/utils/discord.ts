export async function updateOriginalMessage(
  applicationId: string,
  token: string,
  messageId: string,
  data: any
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/${messageId}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`Failed to update message: ${response.status}`);
  }
}

export async function sendFollowupMessage(
  applicationId: string,
  token: string,
  data: any
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${token}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`Failed to send followup: ${response.status}`);
  }
}
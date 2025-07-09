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

export async function getOriginalMessage(
  applicationId: string,
  token: string
): Promise<any> {
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
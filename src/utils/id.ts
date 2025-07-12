export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function parseButtonId(customId: string): {
  action: string;
  params: string[];
} {
  const parts = customId.split(':');
  return {
    action: parts[0],
    params: parts.slice(1),
  };
}

export function createButtonId(action: string, ...params: string[]): string {
  return [action, ...params].join(':');
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  
  let result = `${month}/${day}(${dayOfWeek})`;
  
  if (hours !== 0 || minutes !== 0) {
    result += ` ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  return result;
}

export function parseUserInputDate(input: string): Date | null {
  // Support various formats:
  // - "12/25 19:00"
  // - "12/25"
  // - "2024/12/25 19:00"
  // - "2024-12-25T19:00"
  
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Try ISO format first
  const isoDate = new Date(input);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  // Try MM/DD HH:mm format
  const match1 = input.match(/^(\d{1,2})\/(\d{1,2})\s*(\d{1,2}):(\d{2})$/);
  if (match1) {
    const [, month, day, hour, minute] = match1;
    const date = new Date(currentYear, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    
    // If the date is in the past, assume next year
    if (date < now) {
      date.setFullYear(currentYear + 1);
    }
    
    return date;
  }
  
  // Try MM/DD format
  const match2 = input.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (match2) {
    const [, month, day] = match2;
    const date = new Date(currentYear, parseInt(month) - 1, parseInt(day));
    
    // If the date is in the past, assume next year
    if (date < now) {
      date.setFullYear(currentYear + 1);
    }
    
    return date;
  }
  
  // Try YYYY/MM/DD HH:mm format
  const match3 = input.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s*(\d{1,2}):(\d{2})$/);
  if (match3) {
    const [, year, month, day, hour, minute] = match3;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
  }
  
  return null;
}

export function sortDates(dates: string[]): string[] {
  return dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
}
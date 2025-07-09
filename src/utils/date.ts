export function formatDate(dateString: string): string {
  // If it's a valid date format, format it nicely
  const date = new Date(dateString);
  
  if (!isNaN(date.getTime())) {
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
  
  // Otherwise, return as-is
  return dateString;
}

export function parseUserInputDate(input: string): Date | null {
  // Clean up input
  input = input.trim();
  
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Try native Date parsing first (handles many formats)
  const nativeDate = new Date(input);
  if (!isNaN(nativeDate.getTime())) {
    return nativeDate;
  }
  
  // Common Japanese formats
  // MM月DD日 HH:mm
  const matchJp1 = input.match(/^(\d{1,2})月(\d{1,2})日\s*(\d{1,2})[:\s時](\d{2})分?$/);
  if (matchJp1) {
    const [, month, day, hour, minute] = matchJp1;
    const date = new Date(currentYear, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    if (date < now) date.setFullYear(currentYear + 1);
    return date;
  }
  
  // MM月DD日
  const matchJp2 = input.match(/^(\d{1,2})月(\d{1,2})日$/);
  if (matchJp2) {
    const [, month, day] = matchJp2;
    const date = new Date(currentYear, parseInt(month) - 1, parseInt(day));
    if (date < now) date.setFullYear(currentYear + 1);
    return date;
  }
  
  // MM/DD HH:mm or MM-DD HH:mm
  const match1 = input.match(/^(\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2})[:\s](\d{2})$/);
  if (match1) {
    const [, month, day, hour, minute] = match1;
    const date = new Date(currentYear, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    if (date < now) date.setFullYear(currentYear + 1);
    return date;
  }
  
  // MM/DD or MM-DD
  const match2 = input.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (match2) {
    const [, month, day] = match2;
    const date = new Date(currentYear, parseInt(month) - 1, parseInt(day));
    if (date < now) date.setFullYear(currentYear + 1);
    return date;
  }
  
  // YYYY/MM/DD HH:mm or YYYY-MM-DD HH:mm
  const match3 = input.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2})[:\s](\d{2})$/);
  if (match3) {
    const [, year, month, day, hour, minute] = match3;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
  }
  
  // YYYY/MM/DD or YYYY-MM-DD
  const match4 = input.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (match4) {
    const [, year, month, day] = match4;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // Try with chrono-like parsing for natural language
  // "明日 19時", "来週月曜日", etc.
  // For now, return null - could be enhanced later
  
  return null;
}
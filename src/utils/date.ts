export function formatDate(dateString: string): string {
  // If it's a valid date format, format it nicely
  const date = new Date(dateString);
  
  if (!isNaN(date.getTime())) {
    // Get JST offset (UTC+9)
    const jstOffset = 9 * 60; // 9 hours in minutes
    const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
    const jstTime = new Date(utcTime + (jstOffset * 60000));
    
    const month = jstTime.getMonth() + 1;
    const day = jstTime.getDate();
    const hours = jstTime.getHours();
    const minutes = jstTime.getMinutes();
    
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][jstTime.getDay()];
    
    let result = `${month}/${day}(${dayOfWeek})`;
    
    if (hours !== 0 || minutes !== 0) {
      result += ` ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    
    return result;
  }
  
  // Otherwise, return as-is
  return dateString;
}

// Helper function to create UTC date from JST input
function createJSTDate(year: number, month: number, day: number, hour: number = 0, minute: number = 0, second: number = 0): Date {
  // Create date directly in UTC, treating input as JST by subtracting 9 hours
  // Note: Date.UTC handles date rollover automatically (e.g., 23:59 JST becomes 14:59 UTC same day)
  return new Date(Date.UTC(year, month, day, hour - 9, minute, second));
}

export function parseUserInputDate(input: string): Date | null {
  // Clean up input
  input = input.trim();
  
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Common Japanese formats
  // MM月DD日 HH:mm
  const matchJp1 = input.match(/^(\d{1,2})月(\d{1,2})日\s*(\d{1,2})[:\s時](\d{2})分?$/);
  if (matchJp1) {
    const [, month, day, hour, minute] = matchJp1;
    const date = createJSTDate(currentYear, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    if (date < now) {
      return createJSTDate(currentYear + 1, parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    }
    return date;
  }
  
  // MM月DD日
  const matchJp2 = input.match(/^(\d{1,2})月(\d{1,2})日$/);
  if (matchJp2) {
    const [, month, day] = matchJp2;
    const date = createJSTDate(currentYear, parseInt(month) - 1, parseInt(day), 23, 59, 59);
    if (date < now) {
      return createJSTDate(currentYear + 1, parseInt(month) - 1, parseInt(day), 23, 59, 59);
    }
    return date;
  }
  
  // MM/DD HH:mm or MM-DD HH:mm
  const match1 = input.match(/^(\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2})[:\s](\d{2})$/);
  if (match1) {
    const [, month, day, hour, minute] = match1;
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);
    
    // Validate month and day
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      const date = createJSTDate(currentYear, monthNum - 1, dayNum, parseInt(hour), parseInt(minute));
      
      // If the date is in the past, assume next year
      if (date < now) {
        return createJSTDate(currentYear + 1, monthNum - 1, dayNum, parseInt(hour), parseInt(minute));
      }
      
      return date;
    }
  }
  
  // MM/DD or MM-DD
  const match2 = input.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (match2) {
    const [, month, day] = match2;
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);
    
    // Validate month and day
    if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      const date = createJSTDate(currentYear, monthNum - 1, dayNum, 23, 59, 59);
      
      // If the date is in the past, assume next year
      if (date < now) {
        return createJSTDate(currentYear + 1, monthNum - 1, dayNum, 23, 59, 59);
      }
      
      return date;
    }
  }
  
  // YYYY/MM/DD HH:mm or YYYY-MM-DD HH:mm
  const match3 = input.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2})[:\s](\d{2})$/);
  if (match3) {
    const [, year, month, day, hour, minute] = match3;
    return createJSTDate(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
  }
  
  // YYYY/MM/DD or YYYY-MM-DD
  const match4 = input.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (match4) {
    const [, year, month, day] = match4;
    return createJSTDate(parseInt(year), parseInt(month) - 1, parseInt(day), 23, 59, 59);
  }
  
  // Try native Date parsing as last resort, but only for specific formats
  // to avoid parsing "invalid" as a valid date
  if (input.match(/^[a-zA-Z]+ \d{1,2}$/i) || input.match(/^\d{1,2} [a-zA-Z]+$/i)) {
    // Formats like "July 11", "11 Jul"
    const nativeDate = new Date(input + ' ' + currentYear);
    if (!isNaN(nativeDate.getTime())) {
      // If the date is in the past, try next year
      if (nativeDate < now) {
        nativeDate.setFullYear(currentYear + 1);
      }
      // Set time to 23:59:59 for date-only formats and convert to UTC
      const jstDate = createJSTDate(nativeDate.getFullYear(), nativeDate.getMonth(), nativeDate.getDate(), 23, 59, 59);
      return jstDate;
    }
  }
  
  // For ISO dates and other specific formats
  if (input.match(/^\d{4}-\d{2}-\d{2}T/) || input.match(/^\d{4}\/\d{2}\/\d{2}T/)) {
    const nativeDate = new Date(input);
    if (!isNaN(nativeDate.getTime())) {
      return nativeDate;
    }
  }
  
  return null;
}
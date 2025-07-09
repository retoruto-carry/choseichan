import { AppError } from '../middleware/error';

export function validateScheduleTitle(title: string): void {
  if (!title || title.trim().length === 0) {
    throw new AppError('タイトルを入力してください');
  }
  
  if (title.length > 100) {
    throw new AppError('タイトルは100文字以内で入力してください');
  }
}

export function validateScheduleDates(dates: string[]): void {
  if (dates.length === 0) {
    throw new AppError('少なくとも1つの日程を指定してください');
  }
  
  if (dates.length > 20) {
    throw new AppError('日程は最大20個まで指定できます');
  }
  
  // Check for duplicates
  const uniqueDates = new Set(dates);
  if (uniqueDates.size !== dates.length) {
    throw new AppError('重複する日程があります');
  }
}

export function validateResponseStatus(status: string): void {
  const validStatuses = ['○', 'o', 'O', '△', '▲', '?', '×', 'x', 'X'];
  if (!validStatuses.includes(status)) {
    throw new AppError('参加可否は ○、△、× のいずれかで入力してください');
  }
}

export function validateComment(comment: string): void {
  if (comment && comment.length > 200) {
    throw new AppError('コメントは200文字以内で入力してください');
  }
}
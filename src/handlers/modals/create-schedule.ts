/**
 * Create Schedule Modal - Clean Architecture Migration
 * 
 * 既存の日程調整作成モーダルハンドラーをClean Architecture Controllerに委譲
 */

// Re-export all handlers from the adapter
export { handleCreateScheduleModal } from '../adapters/create-schedule-adapter';
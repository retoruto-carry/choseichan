/**
 * Display Handlers - Clean Architecture Migration
 * 
 * 既存の表示関連ハンドラーをClean Architecture Controllerに委譲
 */

// Re-export all handlers from the adapter
export { handleToggleDetailsButton } from './adapters/display-adapter';
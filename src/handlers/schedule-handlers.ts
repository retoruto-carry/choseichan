/**
 * Schedule Handlers - Clean Architecture Migration
 * 
 * 既存のスケジュール関連ハンドラーをClean Architecture Controllerに委譲
 */

// Re-export all handlers from the adapter
export {
  handleStatusButton,
  handleEditButton,
  handleDetailsButton,
  handleCloseButton,
  handleReopenButton,
  handleDeleteButton,
  handleRefreshButton,
  handleHideDetailsButton,
  createResponseTableEmbed
} from './adapters/schedule-adapter';
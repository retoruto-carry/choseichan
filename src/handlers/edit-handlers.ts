/**
 * Edit Handlers - Clean Architecture Migration
 * 
 * 既存のスケジュール編集関連ハンドラーをClean Architecture Controllerに委譲
 */

// Re-export all handlers from the adapter
export {
  handleEditInfoButton,
  handleUpdateDatesButton,
  handleAddDatesButton,
  handleRemoveDatesButton,
  handleConfirmRemoveDateButton,
  handleEditDeadlineButton,
  handleReminderEditButton
} from './adapters/edit-adapter';
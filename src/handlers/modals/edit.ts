/**
 * Edit Modals - Clean Architecture Migration
 * 
 * 既存の編集モーダル関連ハンドラーをClean Architecture Controllerに委譲
 */

// Re-export all handlers from the adapter
export {
  handleEditInfoModal,
  handleUpdateDatesModal,
  handleAddDatesModal,
  handleEditDeadlineModal,
  handleEditReminderModal
} from '../adapters/edit-modal-adapter';
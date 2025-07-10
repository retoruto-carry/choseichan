/**
 * Comment Modals - Clean Architecture Migration
 * 
 * 既存のコメント関連モーダルハンドラーをClean Architecture Controllerに委譲
 */

// Re-export all handlers from the adapter
export {
  handleAddCommentModal,
  handleDateCommentModal
} from '../adapters/comment-adapter';
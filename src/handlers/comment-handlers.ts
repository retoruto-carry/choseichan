/**
 * Comment Handlers - Clean Architecture Migration
 * 
 * 既存のコメント関連ハンドラーをClean Architecture Controllerに委譲
 */

// Re-export all handlers from the adapter
export {
  handleAddCommentButton,
  handleCommentButton
} from './adapters/comment-adapter';
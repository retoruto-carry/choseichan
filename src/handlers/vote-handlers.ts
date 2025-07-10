/**
 * Vote Handlers - Clean Architecture Migration
 * 
 * 既存の投票関連ハンドラーをClean Architecture Controllerに委譲
 */

// Re-export all handlers from the adapter
export {
  handleRespondButton,
  handleDateSelectMenu
} from './adapters/vote-adapter';
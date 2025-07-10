/**
 * Help Handlers - Clean Architecture Migration
 * 
 * 既存のヘルプ関連ハンドラーをClean Architecture Controllerに委譲
 */

// Re-export all handlers from the adapter
export {
  handleHelpCommand,
  createHelpEmbed
} from './adapters/help-adapter';
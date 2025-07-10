/**
 * Commands - Clean Architecture Migration
 * 
 * 既存のコマンド関連ハンドラーをClean Architecture Controllerに委譲
 */

// Re-export all handlers from the adapter
export {
  handleChoseichanCommand
} from './adapters/command-adapter';
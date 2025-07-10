/**
 * Buttons - Clean Architecture Migration
 * 
 * 既存のボタンインタラクション関連ハンドラーをClean Architecture Controllerに委譲
 */

// Re-export all handlers from the adapter
export {
  handleButtonInteraction
} from './adapters/button-adapter';
/**
 * Modal Index - Clean Architecture Migration
 * 
 * 既存のモーダルルーターをClean Architecture Controllerに委譲
 */

// Re-export all handlers from the adapter
export { handleModalSubmit } from '../adapters/modal-adapter';
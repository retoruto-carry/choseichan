/**
 * Help Handler Adapter
 * 
 * 既存のhelp handler関数をClean Architecture Controllerに委譲するアダプター
 */

import { Env } from '../../types/discord';
import { createHelpController } from '../../presentation/controllers/HelpController';

/**
 * ヘルプコマンド処理
 */
export async function handleHelpCommand(): Promise<Response> {
  // Help command doesn't need env since it's static content, but we provide a dummy env for consistency
  const dummyEnv = {} as Env;
  const controller = createHelpController(dummyEnv);
  return controller.handleHelpCommand();
}

/**
 * ヘルプEmbed作成（下位互換性のため）
 */
export function createHelpEmbed() {
  const { HelpUIBuilder } = require('../../presentation/builders/HelpUIBuilder');
  const uiBuilder = new HelpUIBuilder();
  return uiBuilder.createHelpEmbed();
}
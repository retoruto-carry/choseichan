import { describe, expect, it } from 'vitest';
import type {
  ButtonInteraction,
  CommandInteraction,
  ModalInteraction,
} from '../../infrastructure/types/discord';
import { getDisplayName, getUserId } from './discord-helpers';

describe('discord-helpers', () => {
  describe('getDisplayName', () => {
    it('サーバーニックネームを最優先で返す', () => {
      const interaction = {
        member: {
          nick: 'サーバーニックネーム',
          user: {
            id: 'user123',
            username: 'testuser',
            global_name: 'グローバル表示名',
          },
        },
      } as CommandInteraction;

      expect(getDisplayName(interaction)).toBe('サーバーニックネーム');
    });

    it('ニックネームがない場合はグローバル表示名を返す', () => {
      const interaction = {
        member: {
          nick: null,
          user: {
            id: 'user123',
            username: 'testuser',
            global_name: 'グローバル表示名',
          },
        },
      } as unknown as CommandInteraction;

      expect(getDisplayName(interaction)).toBe('グローバル表示名');
    });

    it('ニックネームとグローバル表示名がない場合はユーザー名を返す', () => {
      const interaction = {
        member: {
          nick: null,
          user: {
            id: 'user123',
            username: 'testuser',
            global_name: null,
          },
        },
      } as unknown as CommandInteraction;

      expect(getDisplayName(interaction)).toBe('testuser');
    });

    it('memberがなくuserのみの場合も正しく動作する', () => {
      const interaction = {
        user: {
          id: 'user123',
          username: 'directuser',
          global_name: 'ダイレクトユーザー',
        },
      } as ButtonInteraction;

      expect(getDisplayName(interaction)).toBe('ダイレクトユーザー');
    });

    it('すべての情報がない場合はデフォルト値を返す', () => {
      const interaction = {} as ModalInteraction;

      expect(getDisplayName(interaction)).toBe('Unknown User');
    });

    it('空文字のニックネームは無視される', () => {
      const interaction = {
        member: {
          nick: '',
          user: {
            id: 'user123',
            username: 'testuser',
            global_name: 'グローバル表示名',
          },
        },
      } as CommandInteraction;

      expect(getDisplayName(interaction)).toBe('グローバル表示名');
    });

    it('ButtonInteractionでも正しく動作する', () => {
      const interaction = {
        member: {
          nick: 'ボタンユーザー',
          user: {
            id: 'user123',
            username: 'buttonuser',
          },
        },
      } as ButtonInteraction;

      expect(getDisplayName(interaction)).toBe('ボタンユーザー');
    });

    it('ModalInteractionでも正しく動作する', () => {
      const interaction = {
        member: {
          nick: 'モーダルユーザー',
          user: {
            id: 'user123',
            username: 'modaluser',
          },
        },
      } as ModalInteraction;

      expect(getDisplayName(interaction)).toBe('モーダルユーザー');
    });
  });

  describe('getUserId', () => {
    it('memberからユーザーIDを取得できる', () => {
      const interaction = {
        member: {
          user: {
            id: 'user123',
            username: 'testuser',
          },
        },
      } as CommandInteraction;

      expect(getUserId(interaction)).toBe('user123');
    });

    it('memberがない場合はuserから取得する', () => {
      const interaction = {
        user: {
          id: 'user456',
          username: 'directuser',
        },
      } as ButtonInteraction;

      expect(getUserId(interaction)).toBe('user456');
    });

    it('どちらもない場合はundefinedを返す', () => {
      const interaction = {} as ModalInteraction;

      expect(getUserId(interaction)).toBeUndefined();
    });

    it('memberはあるがuserがない場合はundefinedを返す', () => {
      const interaction = {
        member: {} as any,
      } as CommandInteraction;

      expect(getUserId(interaction)).toBeUndefined();
    });

    it('ButtonInteractionでも正しく動作する', () => {
      const interaction = {
        member: {
          user: {
            id: 'button123',
            username: 'buttonuser',
          },
        },
      } as ButtonInteraction;

      expect(getUserId(interaction)).toBe('button123');
    });

    it('ModalInteractionでも正しく動作する', () => {
      const interaction = {
        user: {
          id: 'modal789',
          username: 'modaluser',
        },
      } as ModalInteraction;

      expect(getUserId(interaction)).toBe('modal789');
    });
  });
});
